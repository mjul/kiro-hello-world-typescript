import { 
  User, 
  Session, 
  UserProfile, 
  OAuthConfig, 
  ErrorType, 
  AppError 
} from '../../src/models/interfaces';

describe('Interfaces', () => {
  describe('User Interface', () => {
    it('should define the correct User interface structure', () => {
      const user: User = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github',
        providerId: 'github123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.provider).toBeDefined();
      expect(user.providerId).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Session Interface', () => {
    it('should define the correct Session interface structure', () => {
      const session: Session = {
        id: 'session-id',
        userId: 'user-id',
        createdAt: new Date(),
        expiresAt: new Date()
      };

      expect(session.id).toBeDefined();
      expect(session.userId).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('UserProfile Interface', () => {
    it('should define the correct UserProfile interface structure', () => {
      const profile: UserProfile = {
        id: 'profile-id',
        username: 'profileuser',
        email: 'profile@example.com',
        provider: 'microsoft'
      };

      expect(profile.id).toBeDefined();
      expect(profile.username).toBeDefined();
      expect(profile.email).toBeDefined();
      expect(profile.provider).toBeDefined();
      expect(['microsoft', 'github']).toContain(profile.provider);
    });

    it('should only allow microsoft or github as provider', () => {
      const microsoftProfile: UserProfile = {
        id: 'ms-id',
        username: 'msuser',
        email: 'ms@example.com',
        provider: 'microsoft'
      };

      const githubProfile: UserProfile = {
        id: 'gh-id',
        username: 'ghuser',
        email: 'gh@example.com',
        provider: 'github'
      };

      expect(microsoftProfile.provider).toBe('microsoft');
      expect(githubProfile.provider).toBe('github');
    });
  });

  describe('OAuthConfig Interface', () => {
    it('should define the correct OAuthConfig interface structure', () => {
      const config: OAuthConfig = {
        microsoft: {
          clientId: 'ms-client-id',
          clientSecret: 'ms-client-secret',
          redirectUri: 'http://localhost:3000/auth/microsoft/callback',
          scope: ['openid', 'profile', 'email']
        },
        github: {
          clientId: 'gh-client-id',
          clientSecret: 'gh-client-secret',
          redirectUri: 'http://localhost:3000/auth/github/callback',
          scope: ['user:email']
        }
      };

      expect(config.microsoft).toBeDefined();
      expect(config.github).toBeDefined();
      
      expect(config.microsoft.clientId).toBeDefined();
      expect(config.microsoft.clientSecret).toBeDefined();
      expect(config.microsoft.redirectUri).toBeDefined();
      expect(Array.isArray(config.microsoft.scope)).toBe(true);
      
      expect(config.github.clientId).toBeDefined();
      expect(config.github.clientSecret).toBeDefined();
      expect(config.github.redirectUri).toBeDefined();
      expect(Array.isArray(config.github.scope)).toBe(true);
    });
  });

  describe('ErrorType Enum', () => {
    it('should define all required error types', () => {
      expect(ErrorType.AUTHENTICATION_FAILED).toBe('AUTHENTICATION_FAILED');
      expect(ErrorType.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
      expect(ErrorType.USER_NOT_FOUND).toBe('USER_NOT_FOUND');
      expect(ErrorType.DATABASE_ERROR).toBe('DATABASE_ERROR');
      expect(ErrorType.OAUTH_ERROR).toBe('OAUTH_ERROR');
      expect(ErrorType.TEMPLATE_ERROR).toBe('TEMPLATE_ERROR');
      expect(ErrorType.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    });

    it('should have all error types as string values', () => {
      Object.values(ErrorType).forEach(errorType => {
        expect(typeof errorType).toBe('string');
      });
    });
  });

  describe('AppError Interface', () => {
    it('should define the correct AppError interface structure', () => {
      const error: AppError = {
        type: ErrorType.VALIDATION_ERROR,
        message: 'Test error message',
        statusCode: 400,
        details: { field: 'username' }
      };

      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.message).toBeDefined();
      expect(typeof error.statusCode).toBe('number');
      expect(error.details).toBeDefined();
    });

    it('should allow AppError without details', () => {
      const error: AppError = {
        type: ErrorType.DATABASE_ERROR,
        message: 'Database connection failed',
        statusCode: 500
      };

      expect(error.type).toBe(ErrorType.DATABASE_ERROR);
      expect(error.message).toBeDefined();
      expect(error.statusCode).toBe(500);
      expect(error.details).toBeUndefined();
    });

    it('should work with all error types', () => {
      Object.values(ErrorType).forEach(errorType => {
        const error: AppError = {
          type: errorType,
          message: `Test message for ${errorType}`,
          statusCode: 400
        };

        expect(error.type).toBe(errorType);
        expect(error.message).toContain(errorType);
      });
    });
  });

  describe('Type Compatibility', () => {
    it('should allow UserProfile to be used for User creation', () => {
      const profile: UserProfile = {
        id: 'profile-id',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github'
      };

      // This should compile without issues
      const userData: Partial<User> = {
        username: profile.username,
        email: profile.email,
        provider: profile.provider,
        providerId: profile.id
      };

      expect(userData.username).toBe(profile.username);
      expect(userData.email).toBe(profile.email);
      expect(userData.provider).toBe(profile.provider);
      expect(userData.providerId).toBe(profile.id);
    });
  });
});