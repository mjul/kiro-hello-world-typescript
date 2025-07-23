/**
 * Test Configuration Module
 * 
 * This module provides test-specific configuration overrides
 * to ensure tests run without requiring environment variables.
 */

import { AppConfig } from './app';

/**
 * Get test configuration with safe defaults
 */
export function getTestConfig(): AppConfig {
  return {
    server: {
      port: 3001,
      nodeEnv: 'test',
      baseUrl: 'http://localhost:3001'
    },
    database: {
      path: ':memory:' // Use in-memory database for tests
    },
    session: {
      secret: 'test-session-secret-that-is-long-enough-for-validation',
      maxAge: 24 * 60 * 60 * 1000,
      secure: false,
      httpOnly: true,
      sameSite: 'lax'
    },
    oauth: {
      microsoft: {
        clientId: 'test-microsoft-client-id',
        clientSecret: 'test-microsoft-client-secret',
        redirectUri: 'http://localhost:3001/auth/microsoft/callback',
        scope: ['openid', 'profile', 'email']
      },
      github: {
        clientId: 'test-github-client-id',
        clientSecret: 'test-github-client-secret',
        redirectUri: 'http://localhost:3001/auth/github/callback',
        scope: ['user:email']
      }
    }
  };
}

/**
 * Set up test environment variables
 */
export function setupTestEnvironment(): void {
  const testConfig = getTestConfig();
  
  // Set environment variables for tests
  process.env.NODE_ENV = 'test';
  process.env.PORT = testConfig.server.port.toString();
  process.env.BASE_URL = testConfig.server.baseUrl;
  process.env.DATABASE_PATH = testConfig.database.path;
  process.env.SESSION_SECRET = testConfig.session.secret;
  process.env.MICROSOFT_CLIENT_ID = testConfig.oauth.microsoft.clientId;
  process.env.MICROSOFT_CLIENT_SECRET = testConfig.oauth.microsoft.clientSecret;
  process.env.GITHUB_CLIENT_ID = testConfig.oauth.github.clientId;
  process.env.GITHUB_CLIENT_SECRET = testConfig.oauth.github.clientSecret;
}

/**
 * Clean up test environment
 */
export function cleanupTestEnvironment(): void {
  delete process.env.PORT;
  delete process.env.BASE_URL;
  delete process.env.DATABASE_PATH;
  delete process.env.SESSION_SECRET;
  delete process.env.MICROSOFT_CLIENT_ID;
  delete process.env.MICROSOFT_CLIENT_SECRET;
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
}