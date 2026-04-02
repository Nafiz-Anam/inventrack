import prisma from '../client';

const logActivity = async (
  action: string,
  entityType: string,
  description: string,
  entityId?: string,
  metadata?: any,
  userId?: string
) => {
  return prisma.inventoryActivity.create({
    data: {
      action,
      entityType,
      entityId,
      description,
      metadata,
      userId,
    },
  });
};

const getRecentActivities = async (limit = 10) => {
  return prisma.inventoryActivity.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });
};

const getActivities = async (options: {
  page?: number | string;
  limit?: number | string;
  entityType?: string;
}) => {
  const page = Number(options.page) || 1;
  const limit = Number(options.limit) || 10;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (options.entityType) where.entityType = options.entityType;

  const [activities, total] = await Promise.all([
    prisma.inventoryActivity.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.inventoryActivity.count({ where }),
  ]);

  return {
    activities,
    totalResults: total,
    totalPages: Math.ceil(total / limit),
    page,
    limit,
  };
};

export default {
  logActivity,
  getRecentActivities,
  getActivities,
};
