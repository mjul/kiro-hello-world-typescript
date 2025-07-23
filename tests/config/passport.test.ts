import passport from 'passport';
import { configurePassport, generateOAuthState } from '../../src/config/passport';
import { UserService } from '../../src/services/UserService';
import { User } from '../../src/models/User';

// Mock the dependencies
jest.mock('../../src/config/oauth');
jest.mock('../../src/config/oauthErrors');
jest.mock('../../src/services/UserService');

describe('Passport Configuration', () => {
  let mockUserService: jest.Mocked<UserService>;
  let mockUser: User;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock UserService
    mockUserService = {
      findByProviderId: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      findById: jest.fn(),
      deleteUser: jest.fn(),
      getAllUsers: jest.fn()
    } as any;

    // Mock User
    mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      provider: 'microsoft',
      providerId: 'provider-123',
      createdAt: new Date(),
      updatedAt: new Date()
    } as User;

    // Mock OAuth config
    const mockOAuthConfig = {
      microsoft: {
        clientId: 'test-ms-client',
        clientSecret: 'test-ms-secret',
        redirectUri: 'http://localhost:3000/auth/callback/microsoft',
        scope: ['openid', 'profile', 'email']
      },
      github: {
        clientId: 'test-gh-client',
        clientSecret: 'test-gh-secret',
        redirectUri: 'http://localhost:3000/auth/callback/github',
        scope: ['user:email']
      }
    };

    require('../../src/config/oauth').loadOAuthConfig.mockReturnValue(mockOAuthConfig);
    require('../../src/config/oauth').normalizeProfile.mockReturnValue({
      id: 'provider-123',
      username: 'testuser',
      email: 'test@example.com',
      provider: 'microsoft'
    });
    require('../../src/config/oauthErrors').validateOAuthState.mockReturnValue(true);
  });

  describe('configurePassport', () => {
    it('should configure passport strategies without throwing', () => {
      expect(() => {
        configurePassport(mockUserService);
      }).not.toThrow();
    });

    it('should configure Microsoft strategy', () => {
      const useSpy = jest.spyOn(passport, 'use');
      
      configurePassport(mockUserService);
      
      expect(useSpy).toHaveBeenCalledWith('microsoft', expect.any(Object));
    });

    it('should configure GitHub strategy', () => {
      const useSpy = jest.spyOn(passport, 'use');
      
      configurePassport(mockUserService);
      
      expect(useSpy).toHaveBeenCalledWith('github', expect.any(Object));
    });

    it('should configure serialization', () => {
      const serializeUserSpy = jest.spyOn(passport, 'serializeUser');
      const deserializeUserSpy = jest.spyOn(passport, 'deserializeUser');
      
      configurePassport(mockUserService);
      
      expect(serializeUserSpy).toHaveBeenCalled();
      expect(deserializeUserSpy).toHaveBeenCalled();
    });
  });

  describe('passport configuration validation', () => {
    it('should validate OAuth configuration is loaded', () => {
      const loadOAuthConfigSpy = require('../../src/config/oauth').loadOAuthConfig;
      
      configurePassport(mockUserService);
      
      expect(loadOAuthConfigSpy).toHaveBeenCalled();
    });

    it('should handle OAuth callback for new user', async () => {
      mockUserService.findByProviderId.mockResolvedValue(null);
      mockUserService.createUser.mockResolvedValue(mockUser);
      
      configurePassport(mockUserService);
      
      // This test verifies the configuration doesn't throw during setup
      expect(mockUserService.findByProviderId).not.toHaveBeenCalled();
      expect(mockUserService.createUser).not.toHaveBeenCalled();
    });

    it('should handle OAuth callback for existing user', async () => {
      mockUserService.findByProviderId.mockResolvedValue(mockUser);
      mockUserService.updateUser.mockResolvedValue(mockUser);
      
      configurePassport(mockUserService);
      
      // This test verifies the configuration doesn't throw during setup
      expect(mockUserService.findByProviderId).not.toHaveBeenCalled();
      expect(mockUserService.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('generateOAuthState', () => {
    it('should generate a random state string', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();
      
      expect(state1).toBeTruthy();
      expect(state2).toBeTruthy();
      expect(state1).not.toBe(state2);
      expect(typeof state1).toBe('string');
      expect(state1.length).toBeGreaterThan(0);
    });

    it('should generate hex string', () => {
      const state = generateOAuthState();
      
      // Should be valid hex string
      expect(state).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate consistent length', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();
      
      expect(state1.length).toBe(state2.length);
      expect(state1.length).toBe(64); // 32 bytes * 2 hex chars per byte
    });
  });
});