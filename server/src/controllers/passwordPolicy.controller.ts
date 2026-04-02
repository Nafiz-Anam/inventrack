import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { sendSuccess, sendError, ErrorCode } from '../utils/apiResponse';
import { Request, Response } from 'express';
import PasswordPolicyService from '../services/passwordPolicy.service';

const passwordPolicyService = new PasswordPolicyService();

/**
 * Get active password policy
 * @route GET /v1/password-policies/active
 * @access Private (Admin only)
 */
const getActivePolicy = catchAsync(async (req: Request, res: Response) => {
  try {
    const policy = await passwordPolicyService.getActivePolicy();

    if (!policy) {
      return sendError(res, ErrorCode.NOT_FOUND, 'No active password policy found');
    }

    return sendSuccess(res, { policy }, 'Active password policy retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve password policy');
  }
});

/**
 * Create password policy
 * @route POST /v1/password-policies
 * @access Private (Admin only)
 */
const createPolicy = catchAsync(async (req: Request, res: Response) => {
  const policyData = req.body;

  try {
    const policy = await passwordPolicyService.createPolicy(policyData);

    return sendSuccess(res, { policy }, 'Password policy created successfully');
  } catch (error: any) {
    return sendError(res, ErrorCode.CONFLICT, error.message);
  }
});

/**
 * Update password policy
 * @route PUT /v1/password-policies/:policyId
 * @access Private (Admin only)
 */
const updatePolicy = catchAsync(async (req: Request, res: Response) => {
  const { policyId } = req.params;
  const policyData = req.body;

  try {
    const policy = await passwordPolicyService.updatePolicy(policyId as string, policyData);

    return sendSuccess(res, { policy }, 'Password policy updated successfully');
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return sendError(res, ErrorCode.NOT_FOUND, error.message);
    }
    return sendError(res, ErrorCode.CONFLICT, error.message);
  }
});

/**
 * Delete password policy
 * @route DELETE /v1/password-policies/:policyId
 * @access Private (Admin only)
 */
const deletePolicy = catchAsync(async (req: Request, res: Response) => {
  const { policyId } = req.params;

  try {
    await passwordPolicyService.deletePolicy(policyId as string);

    return sendSuccess(res, null, 'Password policy deleted successfully');
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return sendError(res, ErrorCode.NOT_FOUND, error.message);
    }
    return sendError(res, ErrorCode.CONFLICT, error.message);
  }
});

/**
 * Get all password policies
 * @route GET /v1/password-policies
 * @access Private (Admin only)
 */
const getAllPolicies = catchAsync(async (req: Request, res: Response) => {
  try {
    const policies = await passwordPolicyService.getAllPolicies();

    return sendSuccess(res, { policies }, 'Password policies retrieved successfully');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to retrieve password policies');
  }
});

/**
 * Validate password against policy
 * @route POST /v1/password-policies/validate
 * @access Private
 */
const validatePassword = catchAsync(async (req: Request, res: Response) => {
  const { password, userInfo } = req.body;

  if (!password) {
    return sendError(res, ErrorCode.INVALID_INPUT, 'Password is required');
  }

  try {
    const result = await passwordPolicyService.validatePassword(password, userInfo);

    return sendSuccess(res, result, 'Password validation completed');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to validate password');
  }
});

/**
 * Get password requirements for UI
 * @route GET /v1/password-policies/requirements
 * @access Private
 */
const getPasswordRequirements = catchAsync(async (req: Request, res: Response) => {
  try {
    const requirements = await passwordPolicyService.getPasswordRequirements();

    return sendSuccess(res, { requirements }, 'Password requirements retrieved successfully');
  } catch (error) {
    return sendError(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to retrieve password requirements'
    );
  }
});

/**
 * Check if user needs to change password
 * @route GET /v1/password-policies/check-expiry/:userId
 * @access Private (Admin or self)
 */
const checkPasswordExpiry = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const currentUserId = (req.user as any)?.id;
  const currentUserRole = (req.user as any)?.role;

  // Users can only check their own password expiry unless they're admin
  if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
    return sendError(res, ErrorCode.FORBIDDEN, 'Insufficient permissions');
  }

  try {
    const needsChange = await passwordPolicyService.shouldPasswordBeChanged(userId as string);
    const expiryDate = await passwordPolicyService.getPasswordExpiryDate(userId as string);

    return sendSuccess(res, { needsChange, expiryDate }, 'Password expiry check completed');
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to check password expiry');
  }
});

/**
 * Get password strength score
 * @route POST /v1/password-policies/strength
 * @access Private
 */
const getPasswordStrength = catchAsync(async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    return sendError(res, ErrorCode.INVALID_INPUT, 'Password is required');
  }

  try {
    const result = await passwordPolicyService.validatePassword(password);

    return sendSuccess(
      res,
      { score: result.score, strength: result.strength },
      'Password strength calculated'
    );
  } catch (error) {
    return sendError(res, ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to calculate password strength');
  }
});

export {
  getActivePolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getAllPolicies,
  validatePassword,
  getPasswordRequirements,
  checkPasswordExpiry,
  getPasswordStrength,
};
