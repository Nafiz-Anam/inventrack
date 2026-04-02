import express from 'express';
import validate from '../../middlewares/validate';
import { ipSecurityController } from '../../controllers';
import auth from '../../middlewares/auth';
import { ipSecurityValidation } from '../../validations';

const router = express.Router();

/**
 * @swagger
 * /ip-security/rules:
 *   post:
 *     summary: Create IP security rule
 *     description: Create a new IP security rule for whitelisting or blacklisting IP addresses
 *     tags: [IP Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ipAddress
 *               - ruleType
 *               - reason
 *             properties:
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 example: "192.168.1.100"
 *               cidrRange:
 *                 type: string
 *                 example: "192.168.1.0/24"
 *               ruleType:
 *                 type: string
 *                 enum: [WHITELIST, BLACKLIST]
 *                 example: "WHITELIST"
 *               reason:
 *                 type: string
 *                 example: "Internal network access"
 *     responses:
 *       201:
 *         description: IP security rule created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clv1abcde0001xyz1234"
 *                 ipAddress:
 *                   type: string
 *                   example: "192.168.1.100"
 *                 ruleType:
 *                   type: string
 *                   example: "WHITELIST"
 *       400:
 *         description: Bad request - invalid input
 *       401:
 *         description: Unauthorized - admin access required
 *       409:
 *         description: Conflict - IP rule already exists
 */
router.post(
  '/rules',
  auth('manageUsers'),
  validate(ipSecurityValidation.createIPRule),
  ipSecurityController.createIPRule
);

/**
 * @swagger
 * /ip-security/rules:
 *   get:
 *     summary: Get all IP security rules
 *     description: Retrieve a paginated list of all IP security rules
 *     tags: [IP Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ruleType
 *         schema:
 *           type: string
 *           enum: [WHITELIST, BLACKLIST]
 *         description: Filter by rule type
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of IP security rules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/IPSecurityRule'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized - admin access required
 */
router.get('/rules', auth('manageUsers'), ipSecurityController.getIPRules);

/**
 * @route PUT /v1/ip-security/rules/:id
 * @desc Update IP security rule
 * @access Private (Admin)
 */
router.put(
  '/rules/:id',
  auth('manageUsers'),
  validate(ipSecurityValidation.updateIPRule),
  ipSecurityController.updateIPRule
);

/**
 * @route DELETE /v1/ip-security/rules/:id
 * @desc Delete IP security rule
 * @access Private (Admin)
 */
router.delete('/rules/:id', auth('manageUsers'), ipSecurityController.deleteIPRule);

/**
 * @route GET /v1/ip-security/stats
 * @desc Get IP security statistics
 * @access Private (Admin)
 */
router.get('/stats', auth('manageUsers'), ipSecurityController.getIPStats);

/**
 * @route POST /v1/ip-security/clear-cache
 * @desc Clear IP security cache
 * @access Private (Admin)
 */
router.post('/clear-cache', auth('manageUsers'), ipSecurityController.clearIPCache);

export default router;
