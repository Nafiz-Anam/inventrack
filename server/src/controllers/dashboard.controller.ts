import catchAsync from '../utils/catchAsync';
import { sendSuccess } from '../utils/apiResponse';
import dashboardService from '../services/dashboard.service';
import { Request, Response } from 'express';

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await dashboardService.getDashboardStats();
  return sendSuccess(res, stats, 'Dashboard stats retrieved successfully', undefined, (req as any).requestId);
});

export default { getDashboardStats };
