import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendCreated, sendUpdated, sendDeleted, sendPaginated } from '../utils/apiResponse';
import productService from '../services/product.service';
import { Request, Response } from 'express';

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await productService.createProduct(req.body, (req as any).user?.id);
  return sendCreated(res, { product }, 'Product created successfully', (req as any).requestId);
});

const getProducts = catchAsync(async (req: Request, res: Response) => {
  const result = await productService.getProducts(req.query as any);
  return sendPaginated(
    res,
    result.products,
    {
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      totalResults: result.totalResults,
      hasNext: result.page < result.totalPages,
      hasPrev: result.page > 1,
    },
    'Products retrieved successfully',
    (req as any).requestId
  );
});

const getProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await productService.getProductById(req.params.productId as string);
  return sendSuccess(res, { product }, 'Product retrieved successfully', undefined, (req as any).requestId);
});

const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await productService.updateProduct(req.params.productId as string, req.body, (req as any).user?.id);
  return sendUpdated(res, { product }, 'Product updated successfully', (req as any).requestId);
});

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  await productService.deleteProduct(req.params.productId as string, (req as any).user?.id);
  return sendDeleted(res, 'Product deleted successfully', (req as any).requestId);
});

export default { createProduct, getProducts, getProduct, updateProduct, deleteProduct };
