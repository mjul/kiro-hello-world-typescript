import { getConfig, loadConfig, validateConfig, getEnvironmentConfig } from '../../src/config/app';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../src/config/test';

describe('App Configuration', () => {
  beforeAll(() => {
    setupTestEnvironment();
  });

  afterAll(() => {
    cleanupTestEnvironment();
  });

  describe('loadConfig', () => {
    it('should load configuration from environment variables', () => {
      const config = loadConfig();
      
      expect(config.server.nodeEnv).toBe('test');
      expect(config.server.port).toBe(3001);
      expect(config.server.baseUrl).toBe('http://localhost:3001');
      expect(config.database.path).toBe(':memory:');
      expect(config.session.secret).toBeDefined();
      expect(config.oauth.microsoft.clientId).toBeDefined();
      expect(config.oauth.github.clientId).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const config = loadConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw error for invalid port', () => {
      const config = loadConfig();
      config.server.port = -1;
      expect(() => validateConfig(config)).toThrow('Invalid port: -1');
    });

    it('should throw error for empty database path', () => {
      const config = loadConfig();
      config.database.path = '';
      expect(() => validateConfig(config)).toThrow('Database path is required');
    });

    it('should throw error for invalid base URL', () => {
      const config = loadConfig();
      config.server.baseUrl = 'invalid-url';
      expect(() => validateConfig(config)).toThrow('Invalid base URL: invalid-url');
    });
  });

  describe('getConfig', () => {
    it('should return validated configuration', () => {
      const config = getConfig();
      expect(config).toBeDefined();
      expect(config.server.nodeEnv).toBe('test');
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return test environment configuration', () => {
      const envConfig = getEnvironmentConfig();
      expect(envConfig.logging.level).toBe('error');
      expect(envConfig.logging.requests).toBe(false);
      expect(envConfig.security.strictSSL).toBe(false);
    });
  });
});