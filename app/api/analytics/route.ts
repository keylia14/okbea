
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = "force-dynamic";

// GET - Analytics data
export async function GET() {
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

    // Get all campaigns for the user
    const campaigns = await prisma.campaign.findMany({
      where: { userId: user.id },
      include: {
        clicks: true,
        conversions: true
      }
    })

    // Calculate metrics
    const totalClicks = campaigns.reduce((sum, campaign) => sum + campaign.clicks.length, 0)
    const totalConversions = campaigns.reduce((sum, campaign) => sum + campaign.conversions.length, 0)
    const totalRevenue = campaigns.reduce((sum, campaign) => 
      sum + campaign.conversions.reduce((convSum, conv) => convSum + conv.revenue, 0), 0
    )
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0

    // Get clicks over time (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const clicksOverTime = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const clicksForDay = campaigns.reduce((sum, campaign) => 
        sum + campaign.clicks.filter(click => 
          click.clickedAt.toISOString().split('T')[0] === dateStr
        ).length, 0
      )

      clicksOverTime.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        clicks: clicksForDay
      })
    }

    // Get revenue by campaign
    const revenueByCampaign = campaigns.map(campaign => {
      const revenue = campaign.conversions.reduce((sum, conv) => sum + conv.revenue, 0)
      const clicks = campaign.clicks.length
      const conversions = campaign.conversions.length
      
      return {
        name: campaign.name.length > 15 ? campaign.name.substring(0, 15) + '...' : campaign.name,
        revenue: Math.round(revenue * 100) / 100,
        clicks,
        conversions
      }
    }).sort((a, b) => b.revenue - a.revenue)

    const analytics = {
      metrics: {
        totalClicks,
        totalConversions,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100
      },
      clicksOverTime,
      revenueByCampaign
    }

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('GET /api/analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
