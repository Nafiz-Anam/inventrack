import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import { rbacValidation } from '../../validations';
import {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
  assignPermissionsToRole,
  removePermissionFromRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  getUserPermissions,
  checkUserPermission,
} from '../../controllers/role.controller';

const router = express.Router();

// All routes require authentication
router.use(auth());

/**
 * @route POST /v1/roles
 * @desc Create a new role
 * @access Private (Admin only)
 */
router.post('/', validate({ body: rbacValidation.createRole }), createRole);

/**
 * @route GET /v1/roles
 * @desc Get all roles
 * @access Private (Admin only)
 */
router.get('/', getRoles);

/**
 * @route GET /v1/roles/:roleId
 * @desc Get role by ID
 * @access Private (Admin only)
 */
router.get('/:roleId', getRoleById);

/**
 * @route PUT /v1/roles/:roleId
 * @desc Update role
 * @access Private (Admin only)
 */
router.put('/:roleId', validate({ body: rbacValidation.updateRole }), updateRole);

/**
 * @route DELETE /v1/roles/:roleId
 * @desc Delete role
 * @access Private (Admin only)
 */
router.delete('/:roleId', deleteRole);

/**
 * @route POST /v1/roles/:roleId/permissions
 * @desc Assign permissions to role
 * @access Private (Admin only)
 */
router.post(
  '/:roleId/permissions',
  validate({ body: rbacValidation.assignPermissions }),
  assignPermissionsToRole
);

router.delete('/:roleId/permissions/:permissionId', removePermissionFromRole);

/**
 * @route POST /v1/users/:userId/roles
 * @desc Assign role to user
 * @access Private (Admin only)
 */
router.post(
  '/users/:userId/roles',
  validate({ body: rbacValidation.assignRoleToUser }),
  assignRoleToUser
);

/**
 * @route DELETE /v1/users/:userId/roles/:roleId
 * @desc Remove role from user
 * @access Private (Admin only)
 */
router.delete('/users/:userId/roles/:roleId', removeRoleFromUser);

/**
 * @route GET /v1/users/:userId/roles
 * @desc Get user's roles
 * @access Private (Admin or self)
 */
router.get('/users/:userId/roles', getUserRoles);

/**
 * @route GET /v1/users/:userId/permissions
 * @desc Get user's permissions
 * @access Private (Admin or self)
 */
router.get('/users/:userId/permissions', getUserPermissions);

/**
 * @route GET /v1/users/:userId/permissions/check
 * @desc Check if user has specific permission
 * @access Private (Admin or self)
 */
router.get('/users/:userId/permissions/check', checkUserPermission);

export default router;
