import { AuthServiceImpl } from '../../src/services/AuthService';
import { UserService } from '../../src/services/UserService';
import { SessionManager } from '../../src/services/SessionManager';
import { User } from '../../src/models/User';
import { Session } from '../../src/models/Session';
import { UserProfile, ErrorType } from '../../src/models/interfaces';
import { OAuthErrorType } from '../../src/config/oauthErrors';

// Mock dependencies
jest.mock('../../src/services/UserService');
jest.mock('../../src/services/SessionManager');
jest.mock('../../src/config/oauth');
jest.mock('../../src/config/passport');

// Mock fetch for OAuth token exchange
global.fetch = jest.fn();

describe('AuthService', () => {
  let authService: AuthServiceImpl;
  let mockUserService: jest.Mocked<UserService>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockUserService = new UserService() as jest.Mocked<UserService>;
    mockSessionManager = new SessionManager() as jest.Mocked<SessionManager>;
    
    // Create AuthService instance with mocked dependencies
    authService = new AuthServiceImpl(mockUserService, mockSessionManager);

    // Mock OAuth config
    const mockOAuthConfig = {
      microsoft: {
        clientId: 'test-ms-client-id',
        clientSecret: 'test-ms-client-secret',
        redirectUri: 'http://localhost:3000/auth/callback/microsoft',
        scope: ['openid', 'profile', 'email']
      },
      github: {
        clientId: 'test-gh-client-id',
        clientSecret: 'test-gh-client-secret',
        redirectUri: 'http://localhost:3000/auth/callback/github',
        scope: ['user:email']
      }
    };

    require('../../src/config/oauth').loadOAuthConfig = jest.fn().mockReturnValue(mockOAuthConfig);
    require('../../src/config/passport').configurePassport = jest.fn();
    require('../../src/config/passport').generateOAuthState = jest.fn().mockReturnValue('test-state-123');
  });

  describe('initializeOAuth', () => {
    it('should initialize OAuth configuration successfully', () => {
      expect(() => authService.initializeOAuth()).not.toThrow();
      expect(require('../../src/config/oauth').loadOAuthConfig).toHaveBeenCalled();
      expect(require('../../src/config/passport').configurePassport).toHaveBeenCalledWith(mockUserService);
    });

    it('should throw error if OAuth configuration fails', () => {
      require('../../src/config/oauth').loadOAuthConfig = jest.fn().mockImplementation(() => {
        throw new Error('Missing environment variables');
      });

      expect(() => authService.initializeOAuth()).toThrow();
    });
  });

  describe('handleMicrosoftCallback', () => {
    beforeEach(() => {
      authService.initializeOAuth();
    });

    it('should handle Microsoft OAuth callback successfully', async () => {
      const mockUser = new User({
        id: 'user-123',
        username: 'Test User',
        email: 'test@example.com',
        provider: 'microsoft',
        providerId: 'ms-123'
      });

      // Mock successful token exchange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'test-token' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'ms-123',
            displayName: 'Test User',
            mail: 'test@example.com'
          })
        });

      // Mock normalizeProfile function
      require('../../src/config/oauth').normalizeProfile = jest.fn().mockReturnValue({
        id: 'ms-123',
        username: 'Test User',
        email: 'test@example.com',
        provider: 'microsoft'
      });

      mockUserService.findByProviderId.mockResolvedValue(null);
      mockUserService.createUser.mockResolvedValue(mockUser);

      const result = await authService.handleMicrosoftCallback('test-code');

      expect(result).toEqual({
        id: 'ms-123',
        username: 'Test User',
        email: 'test@example.com',
        provider: 'microsoft'
      });
      expect(mockUserService.createUser).toHaveBeenCalled();
    });

    it('should update existing user profile if needed', async () => {
      const existingUser = new User({
        id: 'user-123',
        username: 'oldusername',
        email: 'old@example.com',
        provider: 'microsoft',
        providerId: 'ms-123'
      });

      const updatedUser = new User({
        id: 'user-123',
        username: 'New Username',
        email: 'new@example.com',
        provider: 'microsoft',
        providerId: 'ms-123'
      });

      // Mock successful token exchange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'test-token' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'ms-123',
            displayName: 'New Username',
            mail: 'new@example.com'
          })
        });

      // Mock normalizeProfile function
      require('../../src/config/oauth').normalizeProfile = jest.fn().mockReturnValue({
        id: 'ms-123',
        username: 'New Username',
        email: 'new@example.com',
        provider: 'microsoft'
      });

      mockUserService.findByProviderId.mockResolvedValue(existingUser);
      mockUserService.updateUser.mockResolvedValue(updatedUser);

      const result = await authService.handleMicrosoftCallback('test-code');

      expect(result.username).toBe('New Username');
      expect(result.email).toBe('new@example.com');
      expect(mockUserService.updateUser).toHaveBeenCalled();
    });

    it('should throw error for missing authorization code', async () => {
      await expect(authService.handleMicrosoftCallback('')).rejects.toMatchObject({
        message: 'Authentication with microsoft failed. Please try again.',
        statusCode: 500
      });
    });

    it('should validate state parameter for CSRF protection', async () => {
      await expect(
        authService.handleMicrosoftCallback('test-code', 'invalid-state', 'valid-state')
      ).rejects.toMatchObject({
        message: 'Authentication request validation failed. Please try again.',
        statusCode: 400
      });
    });

    it('should handle token exchange failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Token exchange failed')
      });

      await expect(authService.handleMicrosoftCallback('test-code')).rejects.toMatchObject({
        message: expect.stringContaining('Authentication with microsoft failed')
      });
    });

    it('should throw error if OAuth not initialized', async () => {
      const uninitializedService = new AuthServiceImpl(mockUserService, mockSessionManager);
      
      await expect(uninitializedService.handleMicrosoftCallback('test-code')).rejects.toMatchObject({
        message: 'Authentication with microsoft failed. Please try again.',
        statusCode: 500
      });
    });
  });

  describe('handleGitHubCallback', () => {
    beforeEach(() => {
      authService.initializeOAuth();
    });

    it('should handle GitHub OAuth callback successfully', async () => {
      const mockUser = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github',
        providerId: '123'
      });

      // Mock successful token exchange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'test-token' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 123,
            login: 'testuser',
            name: 'Test User'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { email: 'test@example.com', primary: true }
          ])
        });

      // Mock normalizeProfile function
      require('../../src/config/oauth').normalizeProfile = jest.fn().mockReturnValue({
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github'
      });

      mockUserService.findByProviderId.mockResolvedValue(null);
      mockUserService.createUser.mockResolvedValue(mockUser);

      const result = await authService.handleGitHubCallback('test-code');

      expect(result).toEqual({
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github'
      });
      expect(mockUserService.createUser).toHaveBeenCalled();
    });

    it('should throw error for missing authorization code', async () => {
      await expect(authService.handleGitHubCallback('')).rejects.toMatchObject({
        message: 'Authentication with github failed. Please try again.',
        statusCode: 500
      });
    });

    it('should validate state parameter for CSRF protection', async () => {
      await expect(
        authService.handleGitHubCallback('test-code', 'invalid-state', 'valid-state')
      ).rejects.toMatchObject({
        message: 'Authentication request validation failed. Please try again.',
        statusCode: 400
      });
    });

    it('should handle token exchange failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Token exchange failed')
      });

      await expect(authService.handleGitHubCallback('test-code')).rejects.toMatchObject({
        message: expect.stringContaining('Authentication with github failed')
      });
    });
  });

  describe('createSession', () => {
    beforeEach(() => {
      authService.initializeOAuth();
    });

    it('should create session successfully', async () => {
      const mockSession = new Session({
        id: 'session-123',
        userId: 'user-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      mockSessionManager.create.mockResolvedValue(mockSession);

      const sessionId = await authService.createSession('user-123');

      expect(sessionId).toBe('session-123');
      expect(mockSessionManager.create).toHaveBeenCalledWith('user-123');
    });

    it('should throw error for empty user ID', async () => {
      await expect(authService.createSession('')).rejects.toMatchObject({
        type: ErrorType.VALIDATION_ERROR,
        message: 'User ID is required to create session',
        statusCode: 400
      });
    });

    it('should handle session creation failure', async () => {
      mockSessionManager.create.mockRejectedValue(new Error('Database error'));

      await expect(authService.createSession('user-123')).rejects.toMatchObject({
        type: ErrorType.AUTHENTICATION_FAILED,
        message: 'Failed to create authentication session',
        statusCode: 500
      });
    });
  });

  describe('validateSession', () => {
    beforeEach(() => {
      authService.initializeOAuth();
    });

    it('should validate session and return user', async () => {
      const mockSession = new Session({
        id: 'session-123',
        userId: 'user-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      const mockUser = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'microsoft',
        providerId: 'ms-123'
      });

      mockSessionManager.validate.mockResolvedValue(mockSession);
      mockUserService.findById.mockResolvedValue(mockUser);

      const result = await authService.validateSession('session-123');

      expect(result).toEqual(mockUser);
      expect(mockSessionManager.validate).toHaveBeenCalledWith('session-123');
      expect(mockUserService.findById).toHaveBeenCalledWith('user-123');
    });

    it('should return null for invalid session', async () => {
      mockSessionManager.validate.mockResolvedValue(null);

      const result = await authService.validateSession('invalid-session');

      expect(result).toBeNull();
    });

    it('should return null for empty session ID', async () => {
      const result = await authService.validateSession('');

      expect(result).toBeNull();
    });

    it('should clean up orphaned session when user not found', async () => {
      const mockSession = new Session({
        id: 'session-123',
        userId: 'user-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      mockSessionManager.validate.mockResolvedValue(mockSession);
      mockUserService.findById.mockResolvedValue(null);
      mockSessionManager.destroy.mockResolvedValue();

      const result = await authService.validateSession('session-123');

      expect(result).toBeNull();
      expect(mockSessionManager.destroy).toHaveBeenCalledWith('session-123');
    });

    it('should handle validation errors gracefully', async () => {
      mockSessionManager.validate.mockRejectedValue(new Error('Database error'));

      const result = await authService.validateSession('session-123');

      expect(result).toBeNull();
    });
  });

  describe('destroySession', () => {
    beforeEach(() => {
      authService.initializeOAuth();
    });

    it('should destroy session successfully', async () => {
      mockSessionManager.destroy.mockResolvedValue();

      await authService.destroySession('session-123');

      expect(mockSessionManager.destroy).toHaveBeenCalledWith('session-123');
    });

    it('should throw error for empty session ID', async () => {
      await expect(authService.destroySession('')).rejects.toMatchObject({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Session ID is required to destroy session',
        statusCode: 400
      });
    });

    it('should handle session destruction failure', async () => {
      mockSessionManager.destroy.mockRejectedValue(new Error('Database error'));

      await expect(authService.destroySession('session-123')).rejects.toMatchObject({
        type: ErrorType.AUTHENTICATION_FAILED,
        message: 'Failed to destroy session',
        statusCode: 500
      });
    });
  });

  describe('generateState', () => {
    it('should generate OAuth state parameter', () => {
      const state = authService.generateState();

      expect(state).toBe('test-state-123');
      expect(require('../../src/config/passport').generateOAuthState).toHaveBeenCalled();
    });
  });

  describe('getMicrosoftAuthUrl', () => {
    beforeEach(() => {
      authService.initializeOAuth();
    });

    it('should generate Microsoft OAuth authorization URL', () => {
      const url = authService.getMicrosoftAuthUrl('test-state');

      expect(url).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(url).toContain('client_id=test-ms-client-id');
      expect(url).toContain('state=test-state');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback%2Fmicrosoft');
    });
  });

  describe('getGitHubAuthUrl', () => {
    beforeEach(() => {
      authService.initializeOAuth();
    });

    it('should generate GitHub OAuth authorization URL', () => {
      const url = authService.getGitHubAuthUrl('test-state');

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-gh-client-id');
      expect(url).toContain('state=test-state');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback%2Fgithub');
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      authService.initializeOAuth();
    });

    it('should handle complete authentication flow', async () => {
      // Mock successful Microsoft OAuth flow
      const mockUser = new User({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'microsoft',
        providerId: 'ms-123'
      });

      const mockSession = new Session({
        id: 'session-123',
        userId: 'user-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      // Mock token exchange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'test-token' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'ms-123',
            displayName: 'Test User',
            mail: 'test@example.com'
          })
        });

      // Mock normalizeProfile function
      require('../../src/config/oauth').normalizeProfile = jest.fn().mockReturnValue({
        id: 'ms-123',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'microsoft'
      });

      mockUserService.findByProviderId.mockResolvedValue(null);
      mockUserService.createUser.mockResolvedValue(mockUser);
      mockSessionManager.create.mockResolvedValue(mockSession);
      mockSessionManager.validate.mockResolvedValue(mockSession);
      mockUserService.findById.mockResolvedValue(mockUser);

      // 1. Handle OAuth callback
      const profile = await authService.handleMicrosoftCallback('test-code');
      expect(profile.provider).toBe('microsoft');

      // 2. Create session
      const sessionId = await authService.createSession(mockUser.id);
      expect(sessionId).toBe('session-123');

      // 3. Validate session
      const validatedUser = await authService.validateSession(sessionId);
      expect(validatedUser).toEqual(mockUser);

      // 4. Destroy session
      mockSessionManager.destroy.mockResolvedValue();
      await authService.destroySession(sessionId);
      expect(mockSessionManager.destroy).toHaveBeenCalledWith(sessionId);
    });

    it('should handle authentication errors gracefully', async () => {
      // Test various error scenarios
      const scenarios = [
        {
          name: 'Invalid authorization code',
          code: '',
          expectedError: 'Authentication with microsoft failed'
        },
        {
          name: 'Token exchange failure',
          code: 'valid-code',
          mockFetch: () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
              ok: false,
              text: () => Promise.resolve('Invalid client')
            });
          },
          expectedError: 'Authentication with microsoft failed'
        }
      ];

      for (const scenario of scenarios) {
        if (scenario.mockFetch) {
          scenario.mockFetch();
        }

        await expect(authService.handleMicrosoftCallback(scenario.code))
          .rejects.toMatchObject({
            message: expect.stringContaining(scenario.expectedError)
          });
      }
    });
  });
});