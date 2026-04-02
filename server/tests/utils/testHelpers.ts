import { faker } from '@faker-js/faker';
import { User, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import config from '../../src/config/config';
import prisma from '../../src/client';

export const generateTestUser = (overrides: Partial<User> = {}): Partial<User> => ({
  email: faker.internet.email(),
  password: faker.internet.password(),
  name: faker.person.fullName(),
  role: Role.USER,
  isEmailVerified: true,
  ...overrides,
});

export const createTestUser = async (overrides: Partial<User> = {}): Promise<User> => {
  const userData = generateTestUser(overrides);
  const hashedPassword = await bcrypt.hash(userData.password!, 10);

  return prisma.user.create({
    data: {
      ...userData,
      password: hashedPassword,
    } as any,
  });
};

export const generateAuthToken = (user: User): string => {
  return jwt.sign({ sub: user.id }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpirationMinutes * 60,
  });
};

export const createAuthenticatedRequest = (user: User) => {
  const token = generateAuthToken(user);
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const cleanupTestData = async () => {
  await prisma.token.deleteMany();
  await prisma.user.deleteMany();
};

export const waitForDatabase = async (maxAttempts = 10): Promise<void> => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

export const mockRequest = (overrides: any = {}) => ({
  body: {},
  query: {},
  params: {},
  headers: {},
  ...overrides,
});

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};
