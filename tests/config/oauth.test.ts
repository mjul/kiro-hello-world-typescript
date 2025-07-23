import { loadOAuthConfig, normalizeProfile, OAuthProfile } from '../../src/config/oauth';

describe('OAuth Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadOAuthConfig', () => {
    it('should load OAuth configuration from environment variables', () => {
      // Set up environment variables
      process.env.MICROSOFT_CLIENT_ID = 'test-ms-client-id';
      process.env.MICROSOFT_CLIENT_SECRET = 'test-ms-client-secret';
      process.env.GITHUB_CLIENT_ID = 'test-gh-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-gh-client-secret';
      process.env.BASE_URL = 'https://example.com';

      const config = loadOAuthConfig();

      expect(config).toEqual({
        microsoft: {
          clientId: 'test-ms-client-id',
          clientSecret: 'test-ms-client-secret',
          redirectUri: 'https://example.com/auth/callback/microsoft',
          scope: ['openid', 'profile', 'email']
        },
        github: {
          clientId: 'test-gh-client-id',
          clientSecret: 'test-gh-client-secret',
          redirectUri: 'https://example.com/auth/callback/github',
          scope: ['user:email']
        }
      });
    });

    it('should use default BASE_URL when not provided', () => {
      process.env.MICROSOFT_CLIENT_ID = 'test-ms-client-id';
      process.env.MICROSOFT_CLIENT_SECRET = 'test-ms-client-secret';
      process.env.GITHUB_CLIENT_ID = 'test-gh-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-gh-client-secret';
      delete process.env.BASE_URL;

      const config = loadOAuthConfig();

      expect(config.microsoft.redirectUri).toBe('http://localhost:3000/auth/callback/microsoft');
      expect(config.github.redirectUri).toBe('http://localhost:3000/auth/callback/github');
    });

    it('should throw error when required environment variables are missing', () => {
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;

      expect(() => loadOAuthConfig()).toThrow(
        'Missing required environment variables: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET'
      );
    });

    it('should throw error when some required environment variables are missing', () => {
      process.env.MICROSOFT_CLIENT_ID = 'test-ms-client-id';
      delete process.env.MICROSOFT_CLIENT_SECRET;
      delete process.env.GITHUB_CLIENT_ID;
      process.env.GITHUB_CLIENT_SECRET = 'test-gh-client-secret';

      expect(() => loadOAuthConfig()).toThrow(
        'Missing required environment variables: MICROSOFT_CLIENT_SECRET, GITHUB_CLIENT_ID'
      );
    });
  });

  describe('normalizeProfile', () => {
    it('should normalize Microsoft profile correctly', () => {
      const microsoftProfile = {
        id: 'ms-user-123',
        displayName: 'John Doe',
        emails: [{ value: 'john.doe@example.com' }]
      };

      const normalized = normalizeProfile('microsoft', microsoftProfile);

      expect(normalized).toEqual({
        id: 'ms-user-123',
        username: 'John Doe',
        email: 'john.doe@example.com',
        provider: 'microsoft'
      });
    });

    it('should normalize Microsoft profile with email as username fallback', () => {
      const microsoftProfile = {
        id: 'ms-user-123',
        emails: [{ value: 'john.doe@example.com' }]
      };

      const normalized = normalizeProfile('microsoft', microsoftProfile);

      expect(normalized).toEqual({
        id: 'ms-user-123',
        username: 'john.doe',
        email: 'john.doe@example.com',
        provider: 'microsoft'
      });
    });

    it('should normalize Microsoft profile with Unknown username fallback', () => {
      const microsoftProfile = {
        id: 'ms-user-123'
      };

      const normalized = normalizeProfile('microsoft', microsoftProfile);

      expect(normalized).toEqual({
        id: 'ms-user-123',
        username: 'Unknown',
        email: '',
        provider: 'microsoft'
      });
    });

    it('should normalize GitHub profile correctly', () => {
      const githubProfile = {
        id: 'gh-user-456',
        username: 'johndoe',
        displayName: 'John Doe',
        emails: [{ value: 'john.doe@example.com' }]
      };

      const normalized = normalizeProfile('github', githubProfile);

      expect(normalized).toEqual({
        id: 'gh-user-456',
        username: 'johndoe',
        email: 'john.doe@example.com',
        provider: 'github'
      });
    });

    it('should normalize GitHub profile with displayName fallback', () => {
      const githubProfile = {
        id: 'gh-user-456',
        displayName: 'John Doe',
        emails: [{ value: 'john.doe@example.com' }]
      };

      const normalized = normalizeProfile('github', githubProfile);

      expect(normalized).toEqual({
        id: 'gh-user-456',
        username: 'John Doe',
        email: 'john.doe@example.com',
        provider: 'github'
      });
    });

    it('should normalize GitHub profile with Unknown username fallback', () => {
      const githubProfile = {
        id: 'gh-user-456'
      };

      const normalized = normalizeProfile('github', githubProfile);

      expect(normalized).toEqual({
        id: 'gh-user-456',
        username: 'Unknown',
        email: '',
        provider: 'github'
      });
    });

    it('should throw error for unsupported provider', () => {
      const profile = { id: 'test-123' };

      expect(() => normalizeProfile('unsupported' as any, profile)).toThrow(
        'Unsupported OAuth provider: unsupported'
      );
    });
  });
});