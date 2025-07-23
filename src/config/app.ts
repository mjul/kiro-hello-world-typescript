/**
 * Application Configuration Module
 * 
 * This module handles loading and validating environment variables
 * and provides typed configuration objects for the application.
 */

import path from 'path';

export interface DatabaseConfig {
  path: string;
}

export interface ServerConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  baseUrl: string;
}

export interface SessionConfig {
  secret: string;
  maxAge: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
}

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface OAuthConfig {
  microsoft: OAuthProviderConfig;
  github: OAuthProviderConfig;
}

export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  session: SessionConfig;
  oauth: OAuthConfig;
}

/**
 * Load and validate environment variables
 */
export function loadConfig(): AppConfig {
  // Load environment variables from .env file if in development
  if (process.env.NODE_ENV !== 'production') {
    try {
      require('dotenv').config();
    } catch (error) {
      // dotenv is optional, continue without it
      console.warn('dotenv not available, using environment variables directly');
    }
  }

  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const port = parseInt(process.env.PORT || '3000', 10);
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

  // Validate required environment variables
  const requiredEnvVars = [
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'SESSION_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0 && nodeEnv !== 'test') {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Server configuration
  const server: ServerConfig = {
    port,
    nodeEnv,
    baseUrl
  };

  // Database configuration
  const database: DatabaseConfig = {
    path: process.env.DATABASE_PATH || 'data/app.db'
  };

  // Session configuration
  const session: SessionConfig = {
    secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: nodeEnv === 'production',
    httpOnly: true,
    sameSite: 'lax'
  };

  // OAuth configuration
  const oauth: OAuthConfig = {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      redirectUri: `${baseUrl}/auth/microsoft/callback`,
      scope: ['openid', 'profile', 'email']
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      redirectUri: `${baseUrl}/auth/github/callback`,
      scope: ['user:email']
    }
  };

  return {
    server,
    database,
    session,
    oauth
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: AppConfig): void {
  // Validate port
  if (isNaN(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
    throw new Error(`Invalid port: ${config.server.port}`);
  }

  // Validate database path
  if (!config.database.path) {
    throw new Error('Database path is required');
  }

  // Validate session secret
  if (config.session.secret.length < 32) {
    console.warn('Session secret should be at least 32 characters long for security');
  }

  // Validate OAuth configuration (skip in test environment)
  if (config.server.nodeEnv !== 'test') {
    if (!config.oauth.microsoft.clientId || !config.oauth.microsoft.clientSecret) {
      throw new Error('Microsoft OAuth configuration is incomplete');
    }

    if (!config.oauth.github.clientId || !config.oauth.github.clientSecret) {
      throw new Error('GitHub OAuth configuration is incomplete');
    }
  }

  // Validate base URL format
  try {
    new URL(config.server.baseUrl);
  } catch (error) {
    throw new Error(`Invalid base URL: ${config.server.baseUrl}`);
  }
}

/**
 * Get configuration with validation
 */
export function getConfig(): AppConfig {
  const config = loadConfig();
  validateConfig(config);
  return config;
}

/**
 * Environment-specific configurations
 */
export const developmentConfig = {
  logging: {
    level: 'debug',
    requests: true,
    errors: true
  },
  security: {
    strictSSL: false,
    trustProxy: false
  }
};

export const productionConfig = {
  logging: {
    level: 'info',
    requests: false,
    errors: true
  },
  security: {
    strictSSL: true,
    trustProxy: true
  }
};

export const testConfig = {
  logging: {
    level: 'error',
    requests: false,
    errors: false
  },
  security: {
    strictSSL: false,
    trustProxy: false
  }
};

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  switch (nodeEnv) {
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    default:
      return developmentConfig;
  }
}