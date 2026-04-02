// Authentication Module Types

export interface LoginRequest {
  email: string;
  password: string;
  captchaToken?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  captchaToken?: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    tokens?: {
      access: {
        token: string;
        expires: Date;
      };
      refresh: {
        token: string;
        expires: Date;
      };
    };
    user?: {
      id: string;
      email: string;
      name?: string;
      role: string;
    };
  };
  message?: string;
}

export interface SecurityEvent {
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  eventType: string;
  details?: any;
  success: boolean;
  timestamp: Date;
}

export interface UserActivity {
  userId: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details?: any;
}

export interface DeviceInfo {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  lastSeen: Date;
  isActive: boolean;
}

export interface SessionInfo {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}
