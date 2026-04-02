import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import inventoryActivityService from './inventoryActivity.service';

const createCategory = async (data: { name: string; description?: string }, userId?: string) => {
  const existing = await prisma.category.findUnique({ where: { name: data.name } });
  if (existing) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Category with this name already exists');
  }

  const category = await prisma.category.create({
    data: {
      name: data.name,
      description: data.description,
      createdBy: userId,
    },
  });

  await inventoryActivityService.logActivity(
    'CREATE',
    'Category',
    `Category "${category.name}" created`,
    category.id,
    undefined,
    userId
  );

  return category;
};

const getCategories = async (options: {
  page?: number | string;
  limit?: number | string;
  search?: string;
  isActive?: string;
  sortBy?: string;
  order?: string;
}) => {
  const page = Number(options.page) || 1;
  const limit = Number(options.limit) || 10;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (options.search) {
    where.name = { contains: options.search, mode: 'insensitive' };
  }
  if (options.isActive !== undefined) {
    where.isActive = options.isActive === 'true';
  }

  const orderBy: any = {};
  const sortField = options.sortBy || 'createdAt';
  orderBy[sortField] = options.order || 'desc';

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        _count: { select: { products: true } },
      },
    }),
    prisma.category.count({ where }),
  ]);

  return {
    categories,
    totalResults: total,
    totalPages: Math.ceil(total / limit),
    page,
    limit,
  };
};

const getCategoryById = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: { select: { products: true } },
    },
  });
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }
  return category;
};

const updateCategory = async (
  categoryId: string,
  data: { name?: string; description?: string; isActive?: boolean },
  userId?: string
) => {
  const category = await getCategoryById(categoryId);

  if (data.name && data.name !== category.name) {
    const existing = await prisma.category.findUnique({ where: { name: data.name } });
    if (existing) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Category with this name already exists');
    }
  }

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data,
  });

  await inventoryActivityService.logActivity(
    'UPDATE',
    'Category',
    `Category "${updated.name}" updated`,
    updated.id,
    undefined,
    userId
  );

  return updated;
};

/**
 * Delete category with atomic check — product count + delete in one transaction.
 */
const deleteCategory = async (categoryId: string, userId?: string) => {
  const category = await prisma.$transaction(async (tx: any) => {
    const cat = await tx.category.findUnique({ where: { id: categoryId } });
    if (!cat) throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');

    const productCount = await tx.product.count({ where: { categoryId } });
    if (productCount > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot delete category with ${productCount} associated product(s). Remove products first.`
      );
    }

    await tx.category.delete({ where: { id: categoryId } });
    return cat;
  });

  await inventoryActivityService.logActivity(
    'DELETE', 'Category', `Category "${category.name}" deleted`, categoryId, undefined, userId
  );
};

export default {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
