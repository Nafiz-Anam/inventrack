import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { deviceService } from '../services';
import ApiError from '../utils/ApiError';
import { Request, Response } from 'express';
import { User } from '@prisma/client';

/**
 * Get user devices
 * @route GET /v1/devices
 * @access Private
 */
const getUserDevices = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const devices = await deviceService.getUserDevices(user.id);
  res.send(devices);
});

/**
 * Get device sessions
 * @route GET /v1/devices/sessions
 * @access Private
 */
const getDeviceSessions = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const sessions = await deviceService.getDeviceSessions(user.id);
  res.status(httpStatus.OK).send(sessions);
});

/**
 * Trust device
 * @route POST /v1/devices/:deviceId/trust
 * @access Private
 */
const trustDevice = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const device = await deviceService.trustDevice(user.id, req.params.deviceId as string);
  res.status(httpStatus.OK).send(device);
});

/**
 * Remove device
 * @route DELETE /v1/devices/:deviceId
 * @access Private
 */
const removeDevice = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  await deviceService.removeDevice(user.id, req.params.deviceId as string);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Remove all other devices
 * @route DELETE /v1/devices
 * @access Private
 */
const removeAllOtherDevices = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const { currentDeviceId } = req.body;

  if (!currentDeviceId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Current device ID is required');
  }

  const removedCount = await deviceService.removeAllOtherDevices(user.id, currentDeviceId);
  res.status(httpStatus.OK).send({ removedCount });
});

/**
 * Check device limit
 * @route GET /v1/devices/limit
 * @access Private
 */
const checkDeviceLimit = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as User;
  const { limit } = req.query;
  const hasReachedLimit = await deviceService.hasReachedDeviceLimit(user.id, Number(limit));
  res.status(httpStatus.OK).send({ hasReachedLimit });
});

export default {
  getUserDevices,
  getDeviceSessions,
  trustDevice,
  removeDevice,
  removeAllOtherDevices,
  checkDeviceLimit,
};
