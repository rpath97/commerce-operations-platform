import { prisma } from '../lib/prisma.js'
import { toAdminDashboardRecentOrderDto } from './admin.mapper.js'

const OPEN_STATUSES = ['PENDING', 'PAID', 'PROCESSING'] as const

export async function getAdminDashboard() {
  const [
    customers,
    activeProducts,
    archivedProducts,
    categories,
    totalOrders,
    openOrders,
    lowStockRows,
    recentOrders,
  ] = await prisma.$transaction([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: false } }),
    prisma.category.count(),
    prisma.order.count(),
    prisma.order.count({
      where: { status: { in: [...OPEN_STATUSES] } },
    }),
    prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*)::int AS count
      FROM "Product" p
      INNER JOIN "Inventory" i ON i."productId" = p.id
      WHERE p."isActive" = true
        AND i.quantity <= i."lowStockThreshold"
    `,
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        items: true,
        user: true,
      },
    }),
  ])

  const lowStockProducts = Number(lowStockRows[0]?.count ?? 0)

  return {
    data: {
      counts: {
        customers,
        activeProducts,
        archivedProducts,
        categories,
        totalOrders,
        openOrders,
        lowStockProducts,
      },
      recentOrders: recentOrders.map(toAdminDashboardRecentOrderDto),
    },
  }
}
