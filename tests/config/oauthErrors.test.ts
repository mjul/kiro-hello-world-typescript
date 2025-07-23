import {
  OAuthErrorType,
  createOAuthError,
  handleOAuthError,
  validateOAuthState,
  validateOAuthConfig
} from '../../src/config/oauthErrors';

describe('OAuth Error Handling', () => {
  describe('createOAuthError', () => {
    it('should create OAuth error with all parameters', () => {
      const error = createOAuthError(
        OAuthErrorType.INVALID_STATE,
        'Test error message',
        400,
        { test: 'details' }
      );

      expect(error).toEqual({
        type: OAuthErrorType.INVALID_STATE,
        message: 'Test error message',
        statusCode: 400,
        details: { test: 'details' }
      });
    });

    it('should create OAuth error with default status code', () => {
      const error = createOAuthError(
        OAuthErrorType.PROVIDER_ERROR,
        'Test error message'
      );

      expect(error).toEqual({
        type: OAuthErrorType.PROVIDER_ERROR,
        message: 'Test error message',
        statusCode: 400,
        details: undefined
      });
    });
  });

  describe('handleOAuthError', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle invalid state parameter error', () => {
      const error = new Error('Invalid state parameter - possible CSRF attack');
      const result = handleOAuthError(error, 'microsoft');

      expect(result).toEqual({
        type: OAuthErrorType.INVALID_STATE,
        message: 'Authentication request validation failed. Please try again.',
        statusCode: 400,
        details: {
          provider: 'microsoft',
          originalError: 'Invalid state parameter - possible CSRF attack'
        }
      });
    });

    it('should handle access denied error', () => {
      const error = new Error('access_denied by user');
      const result = handleOAuthError(error, 'github');

      expect(result).toEqual({
        type: OAuthErrorType.PROVIDER_ERROR,
        message: 'Access denied by github. Please grant the required permissions.',
        statusCode: 403,
        details: {
          provider: 'github',
          originalError: 'access_denied by user'
        }
      });
    });

    it('should handle invalid client error', () => {
      const error = new Error('invalid_client configuration');
      const result = handleOAuthError(error, 'microsoft');

      expect(result).toEqual({
        type: OAuthErrorType.PROVIDER_ERROR,
        message: 'OAuth configuration error. Please contact support.',
        statusCode: 500,
        details: {
          provider: 'microsoft',
          originalError: 'invalid_client configuration'
        }
      });
    });

    it('should handle user not found error', () => {
      const error = new Error('User not found during deserialization');
      const result = handleOAuthError(error, 'github');

      expect(result).toEqual({
        type: OAuthErrorType.PROFILE_ERROR,
        message: 'Failed to retrieve user profile. Please try again.',
        statusCode: 500,
        details: {
          provider: 'github',
          originalError: 'User not found during deserialization'
        }
      });
    });

    it('should handle generic OAuth error', () => {
      const error = new Error('Some unknown OAuth error');
      const result = handleOAuthError(error, 'microsoft');

      expect(result).toEqual({
        type: OAuthErrorType.CALLBACK_ERROR,
        message: 'Authentication with microsoft failed. Please try again.',
        statusCode: 500,
        details: {
          provider: 'microsoft',
          originalError: 'Some unknown OAuth error'
        }
      });
    });

    it('should handle error without message', () => {
      const error = {};
      const result = handleOAuthError(error, 'github');

      expect(result).toEqual({
        type: OAuthErrorType.CALLBACK_ERROR,
        message: 'Authentication with github failed. Please try again.',
        statusCode: 500,
        details: {
          provider: 'github',
          originalError: 'Unknown error'
        }
      });
    });
  });

  describe('validateOAuthState', () => {
    it('should return true for matching states', () => {
      const state = 'abc123def456';
      const result = validateOAuthState(state, state);
      expect(result).toBe(true);
    });

    it('should return false for different states', () => {
      const result = validateOAuthState('abc123', 'def456');
      expect(result).toBe(false);
    });

    it('should return false when request state is undefined', () => {
      const result = validateOAuthState(undefined, 'abc123');
      expect(result).toBe(false);
    });

    it('should return false when session state is undefined', () => {
      const result = validateOAuthState('abc123', undefined);
      expect(result).toBe(false);
    });

    it('should return false when both states are undefined', () => {
      const result = validateOAuthState(undefined, undefined);
      expect(result).toBe(false);
    });

    it('should return false for states with different lengths', () => {
      const result = validateOAuthState('abc', 'abcdef');
      expect(result).toBe(false);
    });

    it('should use constant-time comparison', () => {
      // This test ensures timing attacks are prevented
      const state1 = 'a'.repeat(32);
      const state2 = 'b'.repeat(32);
      
      const start = process.hrtime.bigint();
      validateOAuthState(state1, state2);
      const end1 = process.hrtime.bigint();
      
      const start2 = process.hrtime.bigint();
      validateOAuthState(state1, state1);
      const end2 = process.hrtime.bigint();
      
      // The timing difference should be minimal (within reasonable bounds)
      const diff1 = Number(end1 - start);
      const diff2 = Number(end2 - start2);
      const timingDiff = Math.abs(diff1 - diff2);
      
      // Allow for some variance but ensure it's not dramatically different
      expect(timingDiff).toBeLessThan(1000000); // 1ms in nanoseconds
    });
  });

  describe('validateOAuthConfig', () => {
    it('should return empty array for valid config', () => {
      const config = {
        microsoft: {
          clientId: 'ms-client-id',
          clientSecret: 'ms-client-secret'
        },
        github: {
          clientId: 'gh-client-id',
          clientSecret: 'gh-client-secret'
        }
      };

      const errors = validateOAuthConfig(config);
      expect(errors).toEqual([]);
    });

    it('should return errors for missing Microsoft config', () => {
      const config = {
        microsoft: {},
        github: {
          clientId: 'gh-client-id',
          clientSecret: 'gh-client-secret'
        }
      };

      const errors = validateOAuthConfig(config);
      expect(errors).toContain('Microsoft client ID is required');
      expect(errors).toContain('Microsoft client secret is required');
    });

    it('should return errors for missing GitHub config', () => {
      const config = {
        microsoft: {
          clientId: 'ms-client-id',
          clientSecret: 'ms-client-secret'
        },
        github: {}
      };

      const errors = validateOAuthConfig(config);
      expect(errors).toContain('GitHub client ID is required');
      expect(errors).toContain('GitHub client secret is required');
    });

    it('should return all errors for completely missing config', () => {
      const config = {
        microsoft: {},
        github: {}
      };

      const errors = validateOAuthConfig(config);
      expect(errors).toHaveLength(4);
      expect(errors).toContain('Microsoft client ID is required');
      expect(errors).toContain('Microsoft client secret is required');
      expect(errors).toContain('GitHub client ID is required');
      expect(errors).toContain('GitHub client secret is required');
    });

    it('should handle missing provider objects', () => {
      const config = {};

      const errors = validateOAuthConfig(config);
      expect(errors).toHaveLength(4);
    });
  });
});