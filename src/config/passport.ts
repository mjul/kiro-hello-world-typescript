import passport from 'passport';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { loadOAuthConfig, normalizeProfile, OAuthProfile } from './oauth';
import { UserService } from '../services/UserService';
import { handleOAuthError, validateOAuthState } from './oauthErrors';

/**
 * Configure passport strategies and serialization
 */
export function configurePassport(userService: UserService): void {
  const oauthConfig = loadOAuthConfig();
  
  // Configure Microsoft OAuth2 strategy
  passport.use('microsoft', new MicrosoftStrategy({
    clientID: oauthConfig.microsoft.clientId,
    clientSecret: oauthConfig.microsoft.clientSecret,
    callbackURL: oauthConfig.microsoft.redirectUri,
    scope: oauthConfig.microsoft.scope,
    tenant: 'common', // Allow both personal and work accounts
    passReqToCallback: true
  }, async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // Validate state parameter to prevent CSRF attacks
      if (!validateOAuthState(req.query.state, req.session?.oauthState)) {
        const error = handleOAuthError(new Error('Invalid state parameter - possible CSRF attack'), 'microsoft');
        return done(error);
      }
      
      const normalizedProfile = normalizeProfile('microsoft', profile);
      const user = await handleOAuthCallback(userService, normalizedProfile);
      
      // Clear the state from session after successful authentication
      if (req.session?.oauthState) {
        delete req.session.oauthState;
      }
      
      return done(null, user);
    } catch (error) {
      const oauthError = handleOAuthError(error, 'microsoft');
      return done(oauthError);
    }
  }));
  
  // Configure GitHub OAuth2 strategy
  passport.use('github', new GitHubStrategy({
    clientID: oauthConfig.github.clientId,
    clientSecret: oauthConfig.github.clientSecret,
    callbackURL: oauthConfig.github.redirectUri,
    scope: oauthConfig.github.scope,
    passReqToCallback: true
  }, async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // Validate state parameter to prevent CSRF attacks
      if (!validateOAuthState(req.query.state, req.session?.oauthState)) {
        const error = handleOAuthError(new Error('Invalid state parameter - possible CSRF attack'), 'github');
        return done(error);
      }
      
      const normalizedProfile = normalizeProfile('github', profile);
      const user = await handleOAuthCallback(userService, normalizedProfile);
      
      // Clear the state from session after successful authentication
      if (req.session?.oauthState) {
        delete req.session.oauthState;
      }
      
      return done(null, user);
    } catch (error) {
      const oauthError = handleOAuthError(error, 'github');
      return done(oauthError);
    }
  }));
  
  // Serialize user for session storage
  passport.serializeUser((user: any, done) => {
    try {
      // Store only the user ID in the session
      done(null, user.id);
    } catch (error) {
      console.error('User serialization error:', error);
      done(error);
    }
  });
  
  // Deserialize user from session
  passport.deserializeUser(async (userId: string, done) => {
    try {
      // Retrieve full user object from database using ID
      const user = await userService.findById(userId);
      if (!user) {
        return done(new Error('User not found during deserialization'));
      }
      done(null, user);
    } catch (error) {
      console.error('User deserialization error:', error);
      done(error);
    }
  });
}

/**
 * Handle OAuth callback by finding or creating user
 */
async function handleOAuthCallback(userService: UserService, profile: OAuthProfile) {
  try {
    // Try to find existing user by provider ID
    let user = await userService.findByProviderId(profile.id, profile.provider);
    
    if (!user) {
      // Create new user if not found
      user = await userService.createUser({
        id: profile.id,
        username: profile.username,
        email: profile.email,
        provider: profile.provider
      });
      console.log(`Created new user: ${user.username} (${user.provider})`);
    } else {
      // Update existing user profile if needed
      const needsUpdate = user.username !== profile.username || user.email !== profile.email;
      if (needsUpdate) {
        user = await userService.updateUser(user.id, {
          username: profile.username,
          email: profile.email
        });
        console.log(`Updated user profile: ${user.username} (${user.provider})`);
      }
    }
    
    return user;
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    throw new Error('Failed to process OAuth authentication');
  }
}

/**
 * Generate secure state parameter for OAuth2 CSRF protection
 */
export function generateOAuthState(): string {
  return require('crypto').randomBytes(32).toString('hex');
}