import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.promotion.deleteMany()
  await prisma.auditLog.deleteMany()

  const electronics = await prisma.category.create({
    data: {
      name: 'Electronics',
      slug: 'electronics',
      description: 'Audio, computing accessories, and everyday gadgets.',
    },
  })

  const fitness = await prisma.category.create({
    data: {
      name: 'Fitness',
      slug: 'fitness',
      description: 'Home training equipment and recovery essentials.',
    },
  })

  const homeLifestyle = await prisma.category.create({
    data: {
      name: 'Home & Lifestyle',
      slug: 'home-lifestyle',
      description: 'Kitchen and living products for daily use.',
    },
  })

  await prisma.product.create({
    data: {
      name: 'Aether Noise-Cancelling Headphones',
      slug: 'aether-noise-cancelling-headphones',
      description:
        'Over-ear wireless headphones with active noise cancellation and 30-hour battery life.',
      sku: 'EL-HD-001',
      price: '249.00',
      categoryId: electronics.id,
      inventory: {
        create: {
          quantity: 42,
          lowStockThreshold: 8,
        },
      },
    },
  })

  await prisma.product.create({
    data: {
      name: 'Pulse Compact Bluetooth Speaker',
      slug: 'pulse-compact-bluetooth-speaker',
      description:
        'Water-resistant portable speaker with 12-hour playback and USB-C charging.',
      sku: 'EL-SP-002',
      price: '79.00',
      categoryId: electronics.id,
      inventory: {
        create: {
          quantity: 12,
          lowStockThreshold: 10,
        },
      },
    },
  })

  await prisma.product.create({
    data: {
      name: 'Nexus 7-in-1 USB-C Hub',
      slug: 'nexus-7-in-1-usb-c-hub',
      description:
        'Aluminium USB-C hub with HDMI 4K, SD card reader, and 100W pass-through charging.',
      sku: 'EL-HB-003',
      price: '49.00',
      categoryId: electronics.id,
      inventory: {
        create: {
          quantity: 64,
          lowStockThreshold: 10,
        },
      },
    },
  })

  await prisma.product.create({
    data: {
      name: 'Forge Adjustable Dumbbell Pair',
      slug: 'forge-adjustable-dumbbell-pair',
      description:
        'Space-saving adjustable dumbbells covering 2.5 kg to 24 kg per hand.',
      sku: 'FT-DB-001',
      price: '189.00',
      categoryId: fitness.id,
      inventory: {
        create: {
          quantity: 18,
          lowStockThreshold: 5,
        },
      },
    },
  })

  await prisma.product.create({
    data: {
      name: 'Stride TPE Yoga Mat',
      slug: 'stride-tpe-yoga-mat',
      description:
        '6 mm non-slip yoga mat with alignment markers and a carrying strap.',
      sku: 'FT-YM-002',
      price: '39.00',
      categoryId: fitness.id,
      inventory: {
        create: {
          quantity: 4,
          lowStockThreshold: 8,
        },
      },
    },
  })

  await prisma.product.create({
    data: {
      name: 'Harbour Ceramic Pour-Over Kettle',
      slug: 'harbour-ceramic-pour-over-kettle',
      description:
        '900 ml gooseneck kettle with a thermometer lid for controlled brewing.',
      sku: 'HL-KT-001',
      price: '64.00',
      categoryId: homeLifestyle.id,
      inventory: {
        create: {
          quantity: 27,
          lowStockThreshold: 6,
        },
      },
    },
  })
}

seed()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
