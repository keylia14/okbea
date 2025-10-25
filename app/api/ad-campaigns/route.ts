
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaigns = await prisma.adCampaign.findMany({
      where: { userId: parseInt(session.user.id) },
      include: {
        performance: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Get ad campaigns error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const {
      name,
      productName,
      productUrl,
      affiliateLink,
      dailyBudget,
      targetAudience,
      adCopy,
      adHeadline,
      launchNow,
    } = data;

    // Get user's Meta access token
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      select: { metaAccessToken: true, metaAdAccountId: true },
    });

    if (!user?.metaAccessToken || !user?.metaAdAccountId) {
      return NextResponse.json({ 
        error: 'Please connect your Meta Ads account first' 
      }, { status: 400 });
    }

    // Create campaign in database
    const campaign = await prisma.adCampaign.create({
      data: {
        userId: parseInt(session.user.id),
        name,
        productName,
        productUrl,
        affiliateLink,
        dailyBudget: parseFloat(dailyBudget),
        targetAudience,
        adCopy,
        adHeadline,
        status: launchNow ? 'PENDING' : 'DRAFT',
      },
    });

    // If launch now, create campaign on Meta
    if (launchNow) {
      try {
        // Create campaign on Meta Ads
        const metaCampaignResponse = await fetch(
          `https://graph.facebook.com/v24.0/${user.metaAdAccountId}/campaigns`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: user.metaAccessToken,
              name: name,
              objective: 'OUTCOME_TRAFFIC',
              status: 'PAUSED', // Start paused for safety
              special_ad_categories: [],
            }),
          }
        );

        const metaCampaignData = await metaCampaignResponse.json();

        if (metaCampaignData.id) {
          // Update campaign with Meta ID
          await prisma.adCampaign.update({
            where: { id: campaign.id },
            data: {
              metaCampaignId: metaCampaignData.id,
              status: 'ACTIVE',
            },
          });
        } else {
          console.error('Meta campaign creation failed:', metaCampaignData);
        }
      } catch (metaError) {
        console.error('Meta Ads API error:', metaError);
        // Campaign created in DB but not on Meta - user can retry
      }
    }

    return NextResponse.json({ 
      success: true, 
      campaign: {
        ...campaign,
        id: campaign.id.toString(),
      }
    });
  } catch (error) {
    console.error('Create ad campaign error:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
