import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendCreated, sendUpdated, sendDeleted, sendPaginated } from '../utils/apiResponse';
import categoryService from '../services/category.service';
import { Request, Response } from 'express';

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.body, (req as any).user?.id);
  return sendCreated(res, { category }, 'Category created successfully', (req as any).requestId);
});

const getCategories = catchAsync(async (req: Request, res: Response) => {
  const result: any = await categoryService.getCategories(req.query as any);
  return sendPaginated(
    res,
    result.categories,
    {
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      totalResults: result.totalResults,
      hasNext: result.page < result.totalPages,
      hasPrev: result.page > 1,
    },
    'Categories retrieved successfully',
    (req as any).requestId
  );
});

const getCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.getCategoryById(req.params.categoryId as string);
  return sendSuccess(res, { category }, 'Category retrieved successfully', undefined, (req as any).requestId);
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.updateCategory(req.params.categoryId as string, req.body, (req as any).user?.id);
  return sendUpdated(res, { category }, 'Category updated successfully', (req as any).requestId);
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  await categoryService.deleteCategory(req.params.categoryId as string, (req as any).user?.id);
  return sendDeleted(res, 'Category deleted successfully', (req as any).requestId);
});

export default { createCategory, getCategories, getCategory, updateCategory, deleteCategory };
