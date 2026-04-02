import prisma from '../client';
import inventoryActivityService from './inventoryActivity.service';

const getDashboardStats = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    totalOrdersToday,
    pendingOrders,
    completedOrders,
    revenueResult,
    productSummary,
    recentActivities,
    totalProducts,
    totalCategories,
    allActiveProducts,
    ordersByStatusRaw,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.order.count({
      where: { status: 'PENDING' },
    }),
    prisma.order.count({
      where: { status: 'DELIVERED' },
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        status: { not: 'CANCELLED' },
      },
    }),
    prisma.product.findMany({
      take: 10,
      orderBy: { stock: 'asc' },
      select: {
        id: true,
        name: true,
        stock: true,
        minStockThreshold: true,
        status: true,
        category: { select: { name: true } },
      },
    }),
    inventoryActivityService.getRecentActivities(10),
    prisma.product.count(),
    prisma.category.count({ where: { isActive: true } }),
    // Fetch active products to compute low stock count in JS
    prisma.product.findMany({
      where: { status: 'ACTIVE', stock: { gt: 0 } },
      select: { stock: true, minStockThreshold: true },
    }),
    // Orders grouped by status
    prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    // Recent orders
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  // Compute low stock count by comparing each product's stock to its own threshold
  const lowStockItems = allActiveProducts.filter(
    (p) => p.stock <= p.minStockThreshold
  ).length;

  // Format orders by status for chart
  const ordersByStatus = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(
    (status) => ({
      status,
      count: ordersByStatusRaw.find((r: any) => r.status === status)?._count?.status || 0,
    })
  );

  // Last 7 days revenue + pending vs completed
  const last7Days: { date: string; revenue: number; pending: number; completed: number; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dateFilter = { createdAt: { gte: dayStart, lte: dayEnd } };

    const [dayRevenue, dayPending, dayCompleted, dayTotal] = await Promise.all([
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { ...dateFilter, status: { not: 'CANCELLED' } },
      }),
      prisma.order.count({
        where: { ...dateFilter, status: 'PENDING' },
      }),
      prisma.order.count({
        where: { ...dateFilter, status: 'DELIVERED' },
      }),
      prisma.order.count({ where: dateFilter }),
    ]);

    last7Days.push({
      date: dayStart.toISOString().slice(0, 10),
      revenue: Number(dayRevenue._sum.totalAmount || 0),
      pending: dayPending,
      completed: dayCompleted,
      total: dayTotal,
    });
  }

  return {
    totalOrdersToday,
    pendingOrders,
    completedOrders,
    lowStockItems,
    revenueToday: revenueResult._sum.totalAmount || 0,
    productSummary,
    recentActivities,
    totalProducts,
    totalCategories,
    ordersByStatus,
    revenueChart: last7Days,
    recentOrders,
  };
};

export default { getDashboardStats };
