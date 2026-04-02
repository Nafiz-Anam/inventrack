import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendDeleted, sendPaginated } from '../utils/apiResponse';
import restockService from '../services/restock.service';
import { Request, Response } from 'express';

const getRestockQueue = catchAsync(async (req: Request, res: Response) => {
  const result = await restockService.getRestockQueue(req.query as any);
  return sendPaginated(
    res,
    result.items,
    {
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      totalResults: result.totalResults,
      hasNext: result.page < result.totalPages,
      hasPrev: result.page > 1,
    },
    'Restock queue retrieved successfully',
    (req as any).requestId
  );
});

const restockProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await restockService.restockProduct(
    req.params.restockId as string,
    req.body.quantity,
    (req as any).user?.id
  );
  return sendSuccess(res, { restock: result }, 'Product restocked successfully', undefined, (req as any).requestId);
});

const deleteRestockEntry = catchAsync(async (req: Request, res: Response) => {
  await restockService.deleteRestockEntry(req.params.restockId as string, (req as any).user?.id);
  return sendDeleted(res, 'Restock entry removed successfully', (req as any).requestId);
});

export default { getRestockQueue, restockProduct, deleteRestockEntry };
