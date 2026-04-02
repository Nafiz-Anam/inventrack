import { z } from 'zod';

export const password = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters' })
  .regex(/[a-zA-Z]/, { message: 'Password must contain at least 1 letter' })
  .regex(/\d/, { message: 'Password must contain at least 1 number' });
