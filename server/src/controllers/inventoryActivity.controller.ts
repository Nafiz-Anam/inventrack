import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import inventoryActivityService from '../services/inventoryActivity.service';
import { Request, Response } from 'express';

const getActivities = catchAsync(async (req: Request, res: Response) => {
  const result = await inventoryActivityService.getActivities(req.query as any);
  return sendPaginated(
    res,
    result.activities,
    {
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      totalResults: result.totalResults,
      hasNext: result.page < result.totalPages,
      hasPrev: result.page > 1,
    },
    'Activity log retrieved successfully',
    (req as any).requestId
  );
});

const getRecentActivities = catchAsync(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const activities = await inventoryActivityService.getRecentActivities(limit);
  return sendSuccess(res, { activities }, 'Recent activities retrieved successfully', undefined, (req as any).requestId);
});

export default { getActivities, getRecentActivities };
