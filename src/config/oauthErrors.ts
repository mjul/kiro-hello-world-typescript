import { ErrorType, AppError } from '../models/interfaces';

/**
 * OAuth-specific error types
 */
export enum OAuthErrorType {
  INVALID_STATE = 'OAUTH_INVALID_STATE',
  PROVIDER_ERROR = 'OAUTH_PROVIDER_ERROR',
  PROFILE_ERROR = 'OAUTH_PROFILE_ERROR',
  TOKEN_ERROR = 'OAUTH_TOKEN_ERROR',
  CALLBACK_ERROR = 'OAUTH_CALLBACK_ERROR'
}

/**
 * Create OAuth error with proper typing
 */
export function createOAuthError(
  type: OAuthErrorType,
  message: string,
  statusCode: number = 400,
  details?: any
): AppError {
  return {
    type: type as any, // Cast to ErrorType for compatibility
    message,
    statusCode,
    details
  };
}

/**
 * Handle OAuth errors and convert to user-friendly messages
 */
export function handleOAuthError(error: any, provider: 'microsoft' | 'github'): AppError {
  console.error(`OAuth error for ${provider}:`, error);
  
  // Handle specific OAuth error types
  if (error.message?.includes('Invalid state parameter')) {
    return createOAuthError(
      OAuthErrorType.INVALID_STATE,
      'Authentication request validation failed. Please try again.',
      400,
      { provider, originalError: error.message }
    );
  }
  
  if (error.message?.includes('access_denied')) {
    return createOAuthError(
      OAuthErrorType.PROVIDER_ERROR,
      `Access denied by ${provider}. Please grant the required permissions.`,
      403,
      { provider, originalError: error.message }
    );
  }
  
  if (error.message?.includes('invalid_client')) {
    return createOAuthError(
      OAuthErrorType.PROVIDER_ERROR,
      'OAuth configuration error. Please contact support.',
      500,
      { provider, originalError: error.message }
    );
  }
  
  if (error.message?.includes('User not found')) {
    return createOAuthError(
      OAuthErrorType.PROFILE_ERROR,
      'Failed to retrieve user profile. Please try again.',
      500,
      { provider, originalError: error.message }
    );
  }
  
  // Generic OAuth error
  return createOAuthError(
    OAuthErrorType.CALLBACK_ERROR,
    `Authentication with ${provider} failed. Please try again.`,
    500,
    { provider, originalError: error.message || 'Unknown error' }
  );
}

/**
 * Validate OAuth state parameter
 */
export function validateOAuthState(requestState: string | undefined, sessionState: string | undefined): boolean {
  if (!requestState || !sessionState) {
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  if (requestState.length !== sessionState.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < requestState.length; i++) {
    result |= requestState.charCodeAt(i) ^ sessionState.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * OAuth provider configuration validation
 */
export function validateOAuthConfig(config: any): string[] {
  const errors: string[] = [];
  
  if (!config.microsoft?.clientId) {
    errors.push('Microsoft client ID is required');
  }
  
  if (!config.microsoft?.clientSecret) {
    errors.push('Microsoft client secret is required');
  }
  
  if (!config.github?.clientId) {
    errors.push('GitHub client ID is required');
  }
  
  if (!config.github?.clientSecret) {
    errors.push('GitHub client secret is required');
  }
  
  return errors;
}