import { User } from '../models/User';
import { Session } from '../models/Session';
import { UserProfile, ErrorType, AppError } from '../models/interfaces';
import { UserService } from './UserService';
import { SessionManager } from './SessionManager';
import { loadOAuthConfig, normalizeProfile, OAuthProfile } from '../config/oauth';
import { handleOAuthError, validateOAuthState, OAuthErrorType, createOAuthError } from '../config/oauthErrors';
import { configurePassport, generateOAuthState } from '../config/passport';
import passport from 'passport';
import { randomBytes } from 'crypto';

export interface AuthService {
  initializeOAuth(): void;
  handleMicrosoftCallback(code: string, state?: string, sessionState?: string): Promise<UserProfile>;
  handleGitHubCallback(code: string, state?: string, sessionState?: string): Promise<UserProfile>;
  createSession(userId: string): Promise<string>;
  validateSession(sessionId: string): Promise<User | null>;
  destroySession(sessionId: string): Promise<void>;
}

export class AuthServiceImpl implements AuthService {
  private userService: UserService;
  private sessionManager: SessionManager;
  private isInitialized: boolean = false;

  constructor(userService?: UserService, sessionManager?: SessionManager) {
    this.userService = userService || new UserService();
    this.sessionManager = sessionManager || new SessionManager();
  }

  /**
   * Initialize OAuth2 configuration and passport strategies
   */
  public initializeOAuth(): void {
    try {
      // Load and validate OAuth configuration
      const oauthConfig = loadOAuthConfig();
      
      // Configure passport strategies
      configurePassport(this.userService);
      
      this.isInitialized = true;
      console.log('OAuth2 authentication service initialized successfully');
    } catch (error) {
      const authError = createOAuthError(
        OAuthErrorType.PROVIDER_ERROR,
        'Failed to initialize OAuth2 configuration',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      
      console.error('OAuth initialization failed:', authError);
      throw authError;
    }
  }

  /**
   * Handle Microsoft OAuth2 callback
   */
  public async handleMicrosoftCallback(
    code: string, 
    state?: string, 
    sessionState?: string
  ): Promise<UserProfile> {
    try {
      this.ensureInitialized();
      
      // Validate required parameters
      if (!code) {
        throw createOAuthError(
          OAuthErrorType.CALLBACK_ERROR,
          'Authorization code is required for Microsoft OAuth callback',
          400,
          { provider: 'microsoft' }
        );
      }

      // Validate state parameter if provided (CSRF protection)
      if (state && sessionState && !validateOAuthState(state, sessionState)) {
        throw createOAuthError(
          OAuthErrorType.INVALID_STATE,
          'Invalid state parameter - possible CSRF attack',
          400,
          { provider: 'microsoft' }
        );
      }

      // Exchange authorization code for access token and get user profile
      const profile = await this.exchangeCodeForProfile('microsoft', code);
      
      // Find or create user
      const user = await this.findOrCreateUser(profile);
      
      console.log(`Microsoft OAuth callback successful for user: ${user.username}`);
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        provider: 'microsoft'
      };
    } catch (error) {
      const oauthError = handleOAuthError(error, 'microsoft');
      console.error('Microsoft OAuth callback failed:', oauthError);
      throw oauthError;
    }
  }

  /**
   * Handle GitHub OAuth2 callback
   */
  public async handleGitHubCallback(
    code: string, 
    state?: string, 
    sessionState?: string
  ): Promise<UserProfile> {
    try {
      this.ensureInitialized();
      
      // Validate required parameters
      if (!code) {
        throw createOAuthError(
          OAuthErrorType.CALLBACK_ERROR,
          'Authorization code is required for GitHub OAuth callback',
          400,
          { provider: 'github' }
        );
      }

      // Validate state parameter if provided (CSRF protection)
      if (state && sessionState && !validateOAuthState(state, sessionState)) {
        throw createOAuthError(
          OAuthErrorType.INVALID_STATE,
          'Invalid state parameter - possible CSRF attack',
          400,
          { provider: 'github' }
        );
      }

      // Exchange authorization code for access token and get user profile
      const profile = await this.exchangeCodeForProfile('github', code);
      
      // Find or create user
      const user = await this.findOrCreateUser(profile);
      
      console.log(`GitHub OAuth callback successful for user: ${user.username}`);
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        provider: 'github'
      };
    } catch (error) {
      const oauthError = handleOAuthError(error, 'github');
      console.error('GitHub OAuth callback failed:', oauthError);
      throw oauthError;
    }
  }

  /**
   * Create a new session for authenticated user
   */
  public async createSession(userId: string): Promise<string> {
    try {
      // Validate user ID
      if (!userId || userId.trim().length === 0) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'User ID is required to create session',
          statusCode: 400,
          details: { userId }
        } as AppError;
      }

      // Create session using SessionManager
      const session = await this.sessionManager.create(userId);
      
      console.log(`Session created for user ${userId}: ${session.id}`);
      
      return session.id;
    } catch (error) {
      if (this.isAppError(error)) {
        throw error;
      }
      
      throw {
        type: ErrorType.AUTHENTICATION_FAILED,
        message: 'Failed to create authentication session',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Validate session and return user if valid
   */
  public async validateSession(sessionId: string): Promise<User | null> {
    try {
      // Validate session ID
      if (!sessionId || sessionId.trim().length === 0) {
        return null;
      }

      // Validate session using SessionManager
      const session = await this.sessionManager.validate(sessionId);
      if (!session) {
        return null;
      }

      // Get user associated with the session
      const user = await this.userService.findById(session.userId);
      if (!user) {
        // Clean up orphaned session
        await this.sessionManager.destroy(sessionId);
        return null;
      }

      return user;
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  /**
   * Destroy session (logout)
   */
  public async destroySession(sessionId: string): Promise<void> {
    try {
      // Validate session ID
      if (!sessionId || sessionId.trim().length === 0) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'Session ID is required to destroy session',
          statusCode: 400,
          details: { sessionId }
        } as AppError;
      }

      // Destroy session using SessionManager
      await this.sessionManager.destroy(sessionId);
      
      console.log(`Session destroyed: ${sessionId}`);
    } catch (error) {
      if (this.isAppError(error)) {
        throw error;
      }
      
      throw {
        type: ErrorType.AUTHENTICATION_FAILED,
        message: 'Failed to destroy session',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Generate OAuth state parameter for CSRF protection
   */
  public generateState(): string {
    return generateOAuthState();
  }

  /**
   * Get OAuth authorization URL for Microsoft
   */
  public getMicrosoftAuthUrl(state: string): string {
    const config = loadOAuthConfig();
    const params = new URLSearchParams({
      client_id: config.microsoft.clientId,
      response_type: 'code',
      redirect_uri: config.microsoft.redirectUri,
      scope: config.microsoft.scope.join(' '),
      state: state,
      response_mode: 'query'
    });
    
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Get OAuth authorization URL for GitHub
   */
  public getGitHubAuthUrl(state: string): string {
    const config = loadOAuthConfig();
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.redirectUri,
      scope: config.github.scope.join(' '),
      state: state
    });
    
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token and user profile
   */
  private async exchangeCodeForProfile(provider: 'microsoft' | 'github', code: string): Promise<OAuthProfile> {
    try {
      const config = loadOAuthConfig();
      
      if (provider === 'microsoft') {
        return await this.exchangeMicrosoftCode(code, config.microsoft);
      } else if (provider === 'github') {
        return await this.exchangeGitHubCode(code, config.github);
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      throw createOAuthError(
        OAuthErrorType.TOKEN_ERROR,
        `Failed to exchange authorization code for ${provider}`,
        500,
        { provider, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Exchange Microsoft authorization code for profile
   */
  private async exchangeMicrosoftCode(code: string, config: any): Promise<OAuthProfile> {
    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${errorData}`);
      }

      const tokenData = await tokenResponse.json() as { access_token: string };
      const accessToken = tokenData.access_token;

      // Get user profile
      const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!profileResponse.ok) {
        const errorData = await profileResponse.text();
        throw new Error(`Profile fetch failed: ${errorData}`);
      }

      const profileData = await profileResponse.json() as {
        id: string;
        displayName: string;
        mail?: string;
        userPrincipalName?: string;
      };
      
      return normalizeProfile('microsoft', {
        id: profileData.id,
        displayName: profileData.displayName,
        emails: [{ value: profileData.mail || profileData.userPrincipalName || '' }]
      });
    } catch (error) {
      throw new Error(`Microsoft token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Exchange GitHub authorization code for profile
   */
  private async exchangeGitHubCode(code: string, config: any): Promise<OAuthProfile> {
    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: code,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${errorData}`);
      }

      const tokenData = await tokenResponse.json() as { access_token: string };
      const accessToken = tokenData.access_token;

      // Get user profile
      const profileResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'SSO-Web-App',
        },
      });

      if (!profileResponse.ok) {
        const errorData = await profileResponse.text();
        throw new Error(`Profile fetch failed: ${errorData}`);
      }

      const profileData = await profileResponse.json() as {
        id: number;
        login: string;
        name?: string;
      };

      // Get user email (might be private)
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'SSO-Web-App',
        },
      });

      let email = '';
      if (emailResponse.ok) {
        const emailData = await emailResponse.json() as Array<{ email: string; primary: boolean }>;
        const primaryEmail = emailData.find((e) => e.primary) || emailData[0];
        email = primaryEmail?.email || '';
      }

      return normalizeProfile('github', {
        id: profileData.id.toString(),
        username: profileData.login,
        displayName: profileData.name || profileData.login,
        emails: [{ value: email }]
      });
    } catch (error) {
      throw new Error(`GitHub token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find existing user or create new one from OAuth profile
   */
  private async findOrCreateUser(profile: OAuthProfile): Promise<User> {
    try {
      // Try to find existing user
      let user = await this.userService.findByProviderId(profile.id, profile.provider);
      
      if (!user) {
        // Create new user
        user = await this.userService.createUser(profile);
        console.log(`Created new user: ${user.username} (${user.provider})`);
      } else {
        // Update existing user profile if needed
        const needsUpdate = user.username !== profile.username || user.email !== profile.email;
        if (needsUpdate) {
          user = await this.userService.updateUser(user.id, {
            username: profile.username,
            email: profile.email
          });
          console.log(`Updated user profile: ${user.username} (${user.provider})`);
        }
      }
      
      return user;
    } catch (error) {
      throw createOAuthError(
        OAuthErrorType.PROFILE_ERROR,
        'Failed to process user profile',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Ensure OAuth is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw createOAuthError(
        OAuthErrorType.PROVIDER_ERROR,
        'OAuth service not initialized. Call initializeOAuth() first.',
        500
      );
    }
  }

  /**
   * Type guard for AppError
   */
  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'type' in error && 'message' in error && 'statusCode' in error;
  }
}