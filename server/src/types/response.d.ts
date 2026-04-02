import { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: PrismaUser;
    }
  }
}

export interface TokenResponse {
  token: string;
  expires: Date;
}

export interface DeviceInfo {
  id: string;
  name: string;
}

export interface AuthTokensResponse {
  access: TokenResponse;
  refresh?: TokenResponse;
  device?: DeviceInfo;
  user?: PrismaUser;
  session?: {
    id: string;
    expires: Date;
  };
}

export interface UserWithPassword extends PrismaUser {
  isPasswordMatch(password: string): Promise<boolean>;
}

// Re-export the Prisma User type as User for consistency
export type User = PrismaUser;
