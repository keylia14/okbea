
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await request.json();
    const campaignId = parseInt(params.id);

    // Get campaign
    const campaign = await prisma.adCampaign.findFirst({
      where: {
        id: campaignId,
        userId: parseInt(session.user.id),
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Update campaign status
    const updatedCampaign = await prisma.adCampaign.update({
      where: { id: campaignId },
      data: { status },
    });

    // If campaign has Meta ID, update on Meta too
    if (campaign.metaCampaignId) {
      const user = await prisma.user.findUnique({
        where: { id: parseInt(session.user.id) },
        select: { metaAccessToken: true },
      });

      if (user?.metaAccessToken) {
        try {
          const metaStatus = status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
          await fetch(
            `https://graph.facebook.com/v24.0/${campaign.metaCampaignId}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                access_token: user.metaAccessToken,
                status: metaStatus,
              }),
            }
          );
        } catch (metaError) {
          console.error('Meta status update error:', metaError);
        }
      }
    }

    return NextResponse.json({ success: true, campaign: updatedCampaign });
  } catch (error) {
    console.error('Update campaign error:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = parseInt(params.id);

    await prisma.adCampaign.delete({
      where: {
        id: campaignId,
        userId: parseInt(session.user.id),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete campaign error:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
