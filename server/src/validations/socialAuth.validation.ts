import { z } from 'zod';

const linkSocialAccount = z.object({
  provider: z.enum(['google', 'github']),
  providerId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  scope: z.string().optional(),
});

const updateSocialTokens = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  scope: z.string().optional(),
});

export const socialAuthValidation = {
  linkSocialAccount,
  updateSocialTokens,
};
