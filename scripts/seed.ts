
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create admin user with hashed password
  const hashedPassword = await bcrypt.hash('admin123', 12)
  
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hashedPassword,
    },
  })

  console.log('👤 Created admin user:', adminUser.username)

  // Create sample campaigns
  const campaigns = [
    {
      name: 'Fitness Tracker Pro',
      affiliateNetwork: 'Amazon Associates',
      productName: 'FitBit Charge 5',
      originalUrl: 'https://amazon.com/dp/B09372YVPV?tag=affiliate123',
      shortCode: 'FT5P2K'
    },
    {
      name: 'Web Design Course',
      affiliateNetwork: 'ClickBank',
      productName: 'Ultimate Web Design Masterclass',
      originalUrl: 'https://clickbank.com/affiliate/webdesign101',
      shortCode: 'WEB4DX'
    },
    {
      name: 'Crypto Trading Bot',
      affiliateNetwork: 'ShareASale',
      productName: 'AutoTrade Pro',
      originalUrl: 'https://shareasale.com/r.cfm?b=123456&u=789&m=12345',
      shortCode: 'CRY7BT'
    },
    {
      name: 'Home Coffee Maker',
      affiliateNetwork: 'CJ Affiliate',
      productName: 'Keurig K-Elite',
      originalUrl: 'https://cj.com/affiliate/coffee-maker-elite',
      shortCode: 'COF3MK'
    },
    {
      name: 'Online Marketing Course',
      affiliateNetwork: 'Impact',
      productName: 'Digital Marketing Secrets',
      originalUrl: 'https://impact.com/marketing-secrets-2024',
      shortCode: 'MKT8SC'
    }
  ]

  for (const campaign of campaigns) {
    const createdCampaign = await prisma.campaign.upsert({
      where: { shortCode: campaign.shortCode },
      update: {},
      create: {
        ...campaign,
        userId: adminUser.id,
      },
    })

    console.log('📈 Created campaign:', createdCampaign.name)

    // Add some sample clicks for each campaign
    const clickCount = Math.floor(Math.random() * 50) + 10 // 10-60 clicks
    for (let i = 0; i < clickCount; i++) {
      const daysAgo = Math.floor(Math.random() * 30) // Last 30 days
      const clickedAt = new Date()
      clickedAt.setDate(clickedAt.getDate() - daysAgo)
      
      await prisma.click.create({
        data: {
          campaignId: createdCampaign.id,
          referrer: Math.random() > 0.5 ? 'https://google.com' : 'https://facebook.com',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          clickedAt,
        },
      })
    }

    // Add some sample conversions (about 2-5% conversion rate)
    const conversionCount = Math.floor(clickCount * (0.02 + Math.random() * 0.03))
    for (let i = 0; i < conversionCount; i++) {
      const daysAgo = Math.floor(Math.random() * 30)
      const convertedAt = new Date()
      convertedAt.setDate(convertedAt.getDate() - daysAgo)
      
      const revenue = Math.random() * 200 + 10 // $10-$210
      
      await prisma.conversion.create({
        data: {
          campaignId: createdCampaign.id,
          revenue: Math.round(revenue * 100) / 100, // Round to 2 decimal places
          notes: Math.random() > 0.7 ? 'Great conversion from social media traffic' : null,
          convertedAt,
        },
      })
    }
  }

  console.log('✅ Database seeding completed!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
