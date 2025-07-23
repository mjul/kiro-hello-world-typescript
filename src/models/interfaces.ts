// Core interfaces for the SSO Web Application

export interface User {
  id: string;
  username: string;
  email: string;
  provider: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  provider: 'microsoft' | 'github';
}

export interface OAuthConfig {
  microsoft: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
  github: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
}

// Error types and interfaces
export enum ErrorType {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  OAUTH_ERROR = 'OAUTH_ERROR',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export interface AppError {
  type: ErrorType;
  message: string;
  statusCode: number;
  details?: any;
}