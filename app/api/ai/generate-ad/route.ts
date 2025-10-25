
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productName, productDescription, targetAudience } = await request.json();

    // Use OpenRouter API for AI generation
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'X-Title': 'Okbea AI',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'You are an expert copywriter specializing in high-converting Facebook and Instagram ad copy. Create compelling, benefit-focused ad copy that drives clicks and conversions.',
          },
          {
            role: 'user',
            content: `Create 3 Facebook/Instagram ad variations for this product:

Product: ${productName}
Description: ${productDescription || 'High-quality product'}
Target Audience: ${targetAudience || 'General audience'}

For each variation, provide:
1. Headline (max 40 characters)
2. Primary text (max 125 characters)
3. Description (max 30 characters)

Format as JSON:
{
  "variations": [
    {
      "headline": "...",
      "primaryText": "...",
      "description": "..."
    }
  ]
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('AI generation failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    
    // Try to parse JSON from the response
    let adVariations;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      adVariations = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      // Fallback if JSON parsing fails
      adVariations = {
        variations: [
          {
            headline: `${productName.slice(0, 37)}...`,
            primaryText: `Discover ${productName} - Limited time offer! Click to learn more and start your journey today. 🚀`,
            description: 'Shop now and save!',
          },
          {
            headline: 'Transform Your Life Today',
            primaryText: `Get ${productName} now! Join thousands of satisfied customers. Don't miss out on this opportunity! ⭐`,
            description: 'Limited time only',
          },
          {
            headline: 'Special Offer Inside',
            primaryText: `${productName} is here! Exclusive deals for new customers. Click now to claim your discount! 💎`,
            description: 'Claim your discount',
          },
        ],
      };
    }

    return NextResponse.json(adVariations);
  } catch (error) {
    console.error('AI generation error:', error);
    
    // Return fallback ad copy
    const { productName = 'Amazing Product' } = await request.json().catch(() => ({}));
    
    return NextResponse.json({
      variations: [
        {
          headline: `Get ${productName.slice(0, 33)} Now`,
          primaryText: `Discover the best ${productName} - Limited time offer! Click to learn more and start your journey today.`,
          description: 'Shop now and save!',
        },
      ],
    });
  }
}
