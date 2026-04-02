import { z } from 'zod';
import { IPSecurityRuleType } from '../types/ipSecurity.types';

export const createIPRule = z.object({
  ipAddress: z
    .string()
    .refine(val => /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(val), {
      message: 'Invalid IP address format',
    }),
  cidrRange: z
    .string()
    .refine(val => /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\/[0-9]{1,2}$/.test(val), {
      message: 'Invalid CIDR range format',
    })
    .optional(),
  ruleType: z.nativeEnum(IPSecurityRuleType),
  reason: z.string().min(1, { message: 'Reason is required' }),
});

export const updateIPRule = z.object({
  ipAddress: z
    .string()
    .refine(val => /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(val), {
      message: 'Invalid IP address format',
    })
    .optional(),
  cidrRange: z
    .string()
    .refine(val => /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\/[0-9]{1,2}$/.test(val), {
      message: 'Invalid CIDR range format',
    })
    .optional(),
  ruleType: z.nativeEnum(IPSecurityRuleType).optional(),
  reason: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const getIPRules = z.object({
  ruleType: z.nativeEnum(IPSecurityRuleType).optional(),
  isActive: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ipSecurityValidation = {
  createIPRule: { body: createIPRule },
  updateIPRule: { body: updateIPRule },
  getIPRules: { query: getIPRules },
};
