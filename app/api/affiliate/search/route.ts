
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network') || 'cj';
    const query = searchParams.get('query') || '';
    const category = searchParams.get('category') || '';

    if (network === 'cj') {
      // CJ Affiliate API
      const cjUrl = `https://advertiser-lookup.api.cj.com/v2/advertiser-lookup?keywords=${encodeURIComponent(query)}`;
      const cjResponse = await fetch(cjUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.CJ_API_KEY}`,
        },
      });
      
      if (!cjResponse.ok) {
        return NextResponse.json({ 
          error: 'CJ API error',
          products: [] 
        });
      }

      const cjData = await cjResponse.json();
      
      // Transform CJ data to common format
      const products = (cjData.advertisers || []).slice(0, 20).map((adv: any) => ({
        id: adv.advertiserId,
        name: adv.advertiserName,
        category: adv.primaryCategory,
        commission: `${adv.networkEarnings || 'Varies'}`,
        description: adv.description || 'No description available',
        url: adv.programUrl,
        network: 'CJ',
      }));

      return NextResponse.json({ products });
    } else if (network === 'clickbank') {
      // ClickBank API (Note: ClickBank API is limited, returning sample data)
      // In production, you'd integrate with their actual API
      const products = [
        {
          id: 'cb1',
          name: 'Digital Marketing Course',
          category: 'E-learning',
          commission: '50% - $97',
          description: 'Complete digital marketing training program',
          url: 'https://clickbank.com/product-link',
          network: 'ClickBank',
        },
        {
          id: 'cb2',
          name: 'Health & Fitness Guide',
          category: 'Health',
          commission: '75% - $47',
          description: 'Comprehensive fitness and nutrition guide',
          url: 'https://clickbank.com/product-link',
          network: 'ClickBank',
        },
      ].filter(p => 
        !query || p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase())
      );

      return NextResponse.json({ products });
    }

    return NextResponse.json({ products: [] });
  } catch (error) {
    console.error('Affiliate search error:', error);
    return NextResponse.json({ error: 'Search failed', products: [] });
  }
}
