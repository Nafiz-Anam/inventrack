import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendCreated, sendUpdated, sendDeleted, sendPaginated } from '../utils/apiResponse';
import orderService from '../services/order.service';
import { Request, Response } from 'express';

const createOrder = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.createOrder(req.body, (req as any).user?.id);
  return sendCreated(res, { order }, 'Order created successfully', (req as any).requestId);
});

const getOrders = catchAsync(async (req: Request, res: Response) => {
  const result: any = await orderService.getOrders(req.query as any);
  return sendPaginated(
    res,
    result.orders,
    {
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      totalResults: result.totalResults,
      hasNext: result.page < result.totalPages,
      hasPrev: result.page > 1,
    },
    'Orders retrieved successfully',
    (req as any).requestId
  );
});

const getOrder = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.getOrderById(req.params.orderId as string);
  return sendSuccess(res, { order }, 'Order retrieved successfully', undefined, (req as any).requestId);
});

const updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.updateOrderStatus(req.params.orderId as string, req.body.status, (req as any).user?.id);
  return sendUpdated(res, { order }, 'Order status updated successfully', (req as any).requestId);
});

const cancelOrder = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.cancelOrder(req.params.orderId as string, (req as any).user?.id);
  return sendUpdated(res, { order }, 'Order cancelled successfully', (req as any).requestId);
});

const deleteOrder = catchAsync(async (req: Request, res: Response) => {
  await orderService.deleteOrder(req.params.orderId as string, (req as any).user?.id);
  return sendDeleted(res, 'Order deleted successfully', (req as any).requestId);
});

export default { createOrder, getOrders, getOrder, updateOrderStatus, cancelOrder, deleteOrder };
