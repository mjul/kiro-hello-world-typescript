/**
 * Configuration Module
 * 
 * This module provides comprehensive configuration management for the SSO Web App,
 * including OAuth2 configuration, application settings, and logging.
 * 
 * Usage:
 * ```typescript
 * import { getConfig, logger } from './config';
 * 
 * const config = getConfig();
 * logger.info('Application starting', { port: config.server.port });
 * ```
 */

// Application configuration
export { 
  getConfig, 
  loadConfig, 
  validateConfig, 
  getEnvironmentConfig,
  developmentConfig,
  productionConfig,
  testConfig
} from './app';
export type { 
  AppConfig, 
  ServerConfig, 
  DatabaseConfig, 
  SessionConfig, 
  OAuthConfig, 
  OAuthProviderConfig 
} from './app';

// Logging
export { 
  logger, 
  createLogger, 
  requestLoggingMiddleware, 
  Logger, 
  LogLevel 
} from './logger';
export type { LogEntry } from './logger';

// OAuth configuration
export { loadOAuthConfig, normalizeProfile } from './oauth';
export { configurePassport, generateOAuthState } from './passport';
export { 
  OAuthErrorType, 
  createOAuthError, 
  handleOAuthError, 
  validateOAuthState, 
  validateOAuthConfig 
} from './oauthErrors';

// Test configuration
export { 
  getTestConfig, 
  setupTestEnvironment, 
  cleanupTestEnvironment 
} from './test';