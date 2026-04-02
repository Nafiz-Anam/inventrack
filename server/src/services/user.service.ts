import httpStatus from 'http-status';
import { User, Role } from '@prisma/client';
import ApiError from '../utils/ApiError';
import prisma from '../client';
import { encryptPassword, isPasswordMatch } from '../utils/encryption';
import exclude from '../utils/exclude';
import pick from '../utils/pick';

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody: any) => {
  if (await getUserByEmail(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  const hashedPassword = await encryptPassword(userBody.password);
  const user = await prisma.user.create({
    data: {
      ...userBody,
      password: hashedPassword,
      role: userBody.role || Role.USER,
      isActive: true,
    },
  });
  return user;
};

/**
 * Get user by id
 * @param {string} id
 * @param {Array<string>} keys
 * @returns {Promise<Pick<User, 'id' | 'email' | 'name' | 'role'> | null>}
 */
const getUserById = async (id: string, keys?: string[]) => {
  if (keys && keys.length > 0) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: keys.reduce((obj, key) => ({ ...obj, [key]: true }), {}),
    });
    return user;
  }

  // Return full user object if no keys specified
  const user = await prisma.user.findUnique({
    where: { id },
  });
  return user as User | null;
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User | null>}
 */
const getUserByEmail = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  return user as User | null;
};

/**
 * Update user by id
 * @param {string} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId: string, updateBody: any) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await getUserByEmail(updateBody.email)).id !== userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateBody,
  });
  return updatedUser;
};

/**
 * Delete user by id
 * @param {string} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId: string) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await prisma.user.delete({ where: { id: userId } });
  return user;
};

/**
 * Query for users with advanced filtering, search, and pagination
 * @param {Object} filter - Filter criteria
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @param {string} [options.search] - Global search across name, email, phone
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter: any = {}, options: any = {}) => {
  options.page = Number(options.page) || 1;
  options.limit = Number(options.limit) || 10;
  // Build where clause with advanced filtering
  let whereClause: any = {};

  // Basic filters
  if (filter.name) {
    whereClause.name = { contains: filter.name, mode: 'insensitive' };
  }
  if (filter.email) {
    whereClause.email = { contains: filter.email, mode: 'insensitive' };
  }
  if (filter.role) {
    whereClause.role = filter.role;
  }
  if (filter.isActive !== undefined) {
    whereClause.isActive = filter.isActive;
  }
  if (filter.isEmailVerified !== undefined) {
    whereClause.isEmailVerified = filter.isEmailVerified;
  }

  // New profile field filters
  if (filter.country) {
    whereClause.country = { contains: filter.country, mode: 'insensitive' };
  }
  if (filter.state) {
    whereClause.state = { contains: filter.state, mode: 'insensitive' };
  }
  if (filter.city) {
    whereClause.city = { contains: filter.city, mode: 'insensitive' };
  }
  if (filter.phone) {
    whereClause.phone = { contains: filter.phone };
  }
  if (filter.gender) {
    whereClause.gender = filter.gender;
  }

  // Global search across multiple fields
  if (options.search) {
    whereClause.OR = [
      { name: { contains: options.search, mode: 'insensitive' } },
      { email: { contains: options.search, mode: 'insensitive' } },
      { phone: { contains: options.search } },
      { country: { contains: options.search, mode: 'insensitive' } },
      { state: { contains: options.search, mode: 'insensitive' } },
      { city: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isEmailVerified: true,
      isActive: true,
      isLocked: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      // Include new profile fields
      phone: true,
      phoneCode: true,
      country: true,
      state: true,
      city: true,
      address: true,
      profilePicture: true,
      dateOfBirth: true,
      gender: true,
    },
    orderBy: options.sortBy
      ? { [options.sortBy]: options.sortOrder || 'desc' }
      : { createdAt: 'desc' },
    skip: (options.page - 1) * options.limit,
    take: options.limit,
  });

  const total = await prisma.user.count({ where: whereClause });

  return {
    results: users,
    page: options.page,
    limit: options.limit,
    totalPages: Math.ceil(total / options.limit),
    totalResults: total,
  };
};

/**
 * Get user profile
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      profilePicture: true,
      phone: true,
      phoneCode: true,
      country: true,
      state: true,
      city: true,
      address: true,
      dateOfBirth: true,
      gender: true,
      isEmailVerified: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      preferences: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const privacySettings = user.preferences || {};

  return {
    ...user,
    preferences: privacySettings,
  };
};

/**
 * Update user profile
 * @param {string} userId
 * @param {Object} updateBody
 * @returns {Promise<Object>}
 */
const updateUserProfile = async (userId: string, updateBody: any) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      profilePicture: true,
      phone: true,
      phoneCode: true,
      country: true,
      state: true,
      city: true,
      address: true,
      dateOfBirth: true,
      gender: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateBody,
    select: {
      id: true,
      email: true,
      name: true,
      profilePicture: true,
      phone: true,
      phoneCode: true,
      country: true,
      state: true,
      city: true,
      address: true,
      dateOfBirth: true,
      gender: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

/**
 * Get user preferences
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const getUserPreferences = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      emailNotifications: true,
      preferences: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return {
    emailNotifications: user.emailNotifications || {},
    preferences: user.preferences || {},
  };
};

/**
 * Update user preferences
 * @param {string} userId
 * @param {Object} updateBody
 * @returns {Promise<Object>}
 */
const updateUserPreferences = async (userId: string, updateBody: any) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      emailNotifications: true,
      preferences: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateBody,
    select: {
      emailNotifications: true,
      preferences: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

/**
 * Get user statistics
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const getUserStats = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Get counts from related tables
  const [activityCount, deviceCount, sessionCount] = await Promise.all([
    prisma.userActivity.count({ where: { userId } }),
    prisma.device.count({ where: { userId } }),
    prisma.userSession.count({ where: { userId } }),
  ]);

  return {
    totalActivities: activityCount,
    totalDevices: deviceCount,
    activeSessions: sessionCount,
    accountAge: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    lastLogin: user.lastLoginAt,
    isEmailVerified: user.isEmailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
  };
};

/**
 * Get users with expiring passwords
 * @param {Object} filter
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const getUsersWithExpiringPasswords = async (filter: any, options: any) => {
  const users = await prisma.user.findMany({
    where: {
      ...filter,
      passwordChangedAt: {
        lte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      passwordChangedAt: true,
      lastLoginAt: true,
    },
    orderBy: options.sortBy
      ? { [options.sortBy]: options.sortOrder || 'desc' }
      : { passwordChangedAt: 'asc' },
    skip: (options.page - 1) * options.limit,
    take: options.limit,
  });

  const total = await prisma.user.count({
    where: {
      ...filter,
      passwordChangedAt: {
        lte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    results: users,
    page: options.page,
    limit: options.limit,
    totalPages: Math.ceil(total / options.limit),
    totalResults: total,
  };
};

/**
 * Get locked users
 * @param {Object} filter
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const getLockedUsers = async (filter: any, options: any) => {
  const users = await prisma.user.findMany({
    where: {
      ...filter,
      isLocked: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isLocked: true,
      failedLoginAttempts: true,
      lockoutUntil: true,
      lastLoginAt: true,
    },
    orderBy: options.sortBy
      ? { [options.sortBy]: options.sortOrder || 'desc' }
      : { lastLoginAt: 'desc' },
    skip: (options.page - 1) * options.limit,
    take: options.limit,
  });

  const total = await prisma.user.count({
    where: {
      ...filter,
      isLocked: true,
    },
  });

  return {
    results: users,
    page: options.page,
    limit: options.limit,
    totalPages: Math.ceil(total / options.limit),
    totalResults: total,
  };
};

/**
 * Unlock user account
 * @param {string} userId
 * @returns {Promise<User>}
 */
const unlockUserAccount = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isLocked: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.isLocked) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User account is not locked');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      isLocked: false,
      failedLoginAttempts: 0,
      lockoutUntil: null,
    },
  });

  return updatedUser;
};

/**
 * Force password change
 * @param {string} userId
 * @returns {Promise<User>}
 */
const forcePasswordChange = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      forcePasswordChange: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      forcePasswordChange: true,
    },
  });

  return updatedUser;
};

export default {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  getUserProfile,
  updateUserProfile,
  getUserPreferences,
  updateUserPreferences,
  getUserStats,
  getUsersWithExpiringPasswords,
  getLockedUsers,
  unlockUserAccount,
  forcePasswordChange,
};
