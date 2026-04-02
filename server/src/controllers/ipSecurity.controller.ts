import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { ipSecurityService } from '../services';
import { Request, Response } from 'express';
import { IPSecurityRuleType } from '@prisma/client';

/**
 * Create IP security rule
 */
const createIPRule = catchAsync(async (req: Request, res: Response) => {
  const rule = await ipSecurityService.createIPRule({
    ...req.body,
    createdBy: (req.user as any)?.id,
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    data: rule,
    message: 'IP security rule created successfully',
  });
});

/**
 * Get all IP security rules
 */
const getIPRules = catchAsync(async (req: Request, res: Response) => {
  const { ruleType, isActive, page = 1, limit = 50 } = req.query;

  const filters: any = {};
  if (ruleType) filters.ruleType = ruleType as IPSecurityRuleType;
  if (isActive !== undefined) filters.isActive = isActive === 'true';

  const result = await ipSecurityService.getIPRules({
    ...filters,
    page: parseInt(page as string),
    limit: parseInt(limit as string),
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Update IP security rule
 */
const updateIPRule = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const ruleId = Array.isArray(id) ? id[0] : id;
  const rule = await ipSecurityService.updateIPRule(ruleId, {
    ...req.body,
    updatedBy: (req.user as any)?.id,
  });

  res.json({
    success: true,
    data: rule,
    message: 'IP security rule updated successfully',
  });
});

/**
 * Delete IP security rule
 */
const deleteIPRule = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const ruleId = Array.isArray(id) ? id[0] : id;
  await ipSecurityService.deleteIPRule(ruleId, (req.user as any)?.id);

  res.json({
    success: true,
    message: 'IP security rule deleted successfully',
  });
});

/**
 * Get IP security statistics
 */
const getIPStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await ipSecurityService.getIPStats();

  res.json({
    success: true,
    data: stats,
  });
});

/**
 * Clear IP security cache
 */
const clearIPCache = catchAsync(async (req: Request, res: Response) => {
  ipSecurityService.clearCache();

  res.json({
    success: true,
    message: 'IP security cache cleared successfully',
  });
});

export { createIPRule, getIPRules, updateIPRule, deleteIPRule, getIPStats, clearIPCache };
