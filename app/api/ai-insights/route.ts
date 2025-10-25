
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = "force-dynamic";

// POST - AI Q&A
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { username: session.user.name || '' }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { question } = body

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Get user's campaign data
    const campaigns = await prisma.campaign.findMany({
      where: { userId: user.id },
      include: {
        clicks: {
          select: {
            referrer: true,
            clickedAt: true
          }
        },
        conversions: {
          select: {
            revenue: true,
            convertedAt: true,
            notes: true
          }
        }
      }
    })

    // Prepare data summary for AI
    const totalClicks = campaigns.reduce((sum, campaign) => sum + campaign.clicks.length, 0)
    const totalConversions = campaigns.reduce((sum, campaign) => sum + campaign.conversions.length, 0)
    const totalRevenue = campaigns.reduce((sum, campaign) => 
      sum + campaign.conversions.reduce((convSum, conv) => convSum + conv.revenue, 0), 0
    )
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0

    const campaignSummary = campaigns.map(campaign => ({
      name: campaign.name,
      network: campaign.affiliateNetwork,
      product: campaign.productName,
      clicks: campaign.clicks.length,
      conversions: campaign.conversions.length,
      revenue: campaign.conversions.reduce((sum, conv) => sum + conv.revenue, 0),
      conversionRate: campaign.clicks.length > 0 ? (campaign.conversions.length / campaign.clicks.length) * 100 : 0,
      createdAt: campaign.createdAt
    }))

    // Prepare context for AI
    const context = `
You are an AI assistant for an affiliate marketing platform called Okbea AI. You have access to the user's campaign data and should provide helpful insights and recommendations.

CURRENT DATA SUMMARY:
- Total Campaigns: ${campaigns.length}
- Total Clicks: ${totalClicks}
- Total Conversions: ${totalConversions}  
- Total Revenue: $${totalRevenue.toFixed(2)}
- Overall Conversion Rate: ${conversionRate.toFixed(2)}%

CAMPAIGN DETAILS:
${campaignSummary.map(c => 
  `• ${c.name} (${c.network}): ${c.clicks} clicks, ${c.conversions} conversions, $${c.revenue.toFixed(2)} revenue, ${c.conversionRate.toFixed(2)}% rate`
).join('\n')}

USER QUESTION: ${question}

Please provide a helpful, data-driven response based on the user's actual campaign data. Be specific and actionable in your recommendations. If the user asks about data that doesn't exist or you don't have enough data, say so clearly.
`

    // Call LLM API
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'user',
            content: context
          }
        ],
        stream: true,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error('LLM API request failed')
    }

    // Stream the response back to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()

        try {
          while (true) {
            const { done, value } = await reader?.read() || {}
            if (done) break
            
            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  controller.close()
                  return
                }
                
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content || ''
                  if (content) {
                    controller.enqueue(encoder.encode(content))
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('POST /api/ai-insights error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
