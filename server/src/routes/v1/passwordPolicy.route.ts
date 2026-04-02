import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import { rbacValidation } from '../../validations';
import {
  getActivePolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getAllPolicies,
  validatePassword,
  getPasswordRequirements,
  checkPasswordExpiry,
  getPasswordStrength,
} from '../../controllers/passwordPolicy.controller';

const router = express.Router();

// All routes require authentication
router.use(auth());

/**
 * @route GET /v1/password-policies/active
 * @desc Get active password policy
 * @access Private (Admin only)
 */
router.get('/active', getActivePolicy);

/**
 * @route POST /v1/password-policies
 * @desc Create password policy
 * @access Private (Admin only)
 */
router.post('/', validate({ body: rbacValidation.createRole }), createPolicy);

/**
 * @route PUT /v1/password-policies/:policyId
 * @desc Update password policy
 * @access Private (Admin only)
 */
router.put('/:policyId', validate({ body: rbacValidation.updateRole }), updatePolicy);

/**
 * @route DELETE /v1/password-policies/:policyId
 * @desc Delete password policy
 * @access Private (Admin only)
 */
router.delete('/:policyId', deletePolicy);

/**
 * @route GET /v1/password-policies
 * @desc Get all password policies
 * @access Private (Admin only)
 */
router.get('/', getAllPolicies);

/**
 * @route POST /v1/password-policies/validate
 * @desc Validate password against policy
 * @access Private
 */
router.post('/validate', validatePassword);

/**
 * @route GET /v1/password-policies/requirements
 * @desc Get password requirements for UI
 * @access Private
 */
router.get('/requirements', getPasswordRequirements);

/**
 * @route GET /v1/password-policies/check-expiry/:userId
 * @desc Check if user needs to change password
 * @access Private (Admin or self)
 */
router.get('/check-expiry/:userId', checkPasswordExpiry);

/**
 * @route POST /v1/password-policies/strength
 * @desc Get password strength score
 * @access Private
 */
router.post('/strength', getPasswordStrength);

export default router;
