import { Router, Request, Response, NextFunction } from 'express';
import { AuthServiceImpl } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { SessionManager } from '../services/SessionManager';
import { User } from '../models/User';
import { ErrorType, AppError } from '../models/interfaces';

// Initialize services - these will be overridden in tests
let userService = new UserService();
let sessionManager = new SessionManager();
let authService = new AuthServiceImpl(userService, sessionManager);

// Initialize OAuth
try {
  authService.initializeOAuth();
} catch (error) {
  console.error('Failed to initialize OAuth in routes:', error);
}

const router = Router();

/**
 * Authentication middleware for protected routes
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get session ID from cookie
    const sessionId = req.session?.sessionId;
    
    if (!sessionId) {
      return res.redirect('/');
    }

    // Validate session and get user
    const user = await authService.validateSession(sessionId);
    
    if (!user) {
      // Clear invalid session
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });
      return res.redirect('/');
    }

    // Attach user to request for use in route handlers
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.redirect('/');
  }
};

/**
 * Login route handler - renders login page
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    // Check if user is already authenticated
    const sessionId = req.session?.sessionId;
    if (sessionId) {
      // Redirect to dashboard if already logged in
      return res.redirect('/dashboard');
    }

    // Render login page
    res.render('login', { 
      error: req.query.error || null 
    });
  } catch (error) {
    console.error('Login route error:', error);
    res.render('error', {
      error: 'Failed to load login page',
      statusCode: 500
    });
  }
});

/**
 * Dashboard route handler - renders user dashboard
 */
router.get('/dashboard', requireAuth, (req: Request, res: Response): void => {
  try {
    const user = (req as any).user as User;
    
    // Render dashboard with user data
    res.render('dashboard', {
      user: {
        username: user.username,
        email: user.email,
        provider: user.provider
      }
    });
  } catch (error) {
    console.error('Dashboard route error:', error);
    res.render('error', {
      error: 'Failed to load dashboard',
      statusCode: 500
    });
  }
});

/**
 * Microsoft OAuth initiation route
 */
router.get('/auth/microsoft', (req: Request, res: Response): void => {
  try {
    // Generate state parameter for CSRF protection
    const state = authService.generateState();
    
    // Store state in session for validation
    req.session.oauthState = state;
    
    // Get Microsoft authorization URL
    const authUrl = authService.getMicrosoftAuthUrl(state);
    
    // Redirect to Microsoft OAuth
    res.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft OAuth initiation error:', error);
    res.redirect('/?error=' + encodeURIComponent('Failed to initiate Microsoft authentication'));
  }
});

/**
 * GitHub OAuth initiation route
 */
router.get('/auth/github', (req: Request, res: Response): void => {
  try {
    // Generate state parameter for CSRF protection
    const state = authService.generateState();
    
    // Store state in session for validation
    req.session.oauthState = state;
    
    // Get GitHub authorization URL
    const authUrl = authService.getGitHubAuthUrl(state);
    
    // Redirect to GitHub OAuth
    res.redirect(authUrl);
  } catch (error) {
    console.error('GitHub OAuth initiation error:', error);
    res.redirect('/?error=' + encodeURIComponent('Failed to initiate GitHub authentication'));
  }
});

/**
 * Microsoft OAuth callback route handler
 */
router.get('/auth/microsoft/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error } = req.query;
    
    // Handle OAuth errors
    if (error) {
      console.error('Microsoft OAuth error:', error);
      return res.redirect('/?error=' + encodeURIComponent('Microsoft authentication failed'));
    }
    
    // Validate required parameters
    if (!code || typeof code !== 'string') {
      return res.redirect('/?error=' + encodeURIComponent('Invalid authorization code'));
    }
    
    // Get stored state from session
    const sessionState = req.session?.oauthState;
    
    // Handle Microsoft OAuth callback
    const userProfile = await authService.handleMicrosoftCallback(
      code,
      state as string,
      sessionState
    );
    
    // Create session for authenticated user
    const sessionId = await authService.createSession(userProfile.id);
    
    // Store session ID in cookie
    req.session.sessionId = sessionId;
    
    // Clear OAuth state
    delete req.session.oauthState;
    
    // Redirect to dashboard
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Microsoft OAuth callback error:', error);
    
    // Handle specific error types
    if (isAppError(error)) {
      const errorMessage = error.type === ErrorType.OAUTH_ERROR 
        ? 'Microsoft authentication failed' 
        : 'Authentication error occurred';
      return res.redirect('/?error=' + encodeURIComponent(errorMessage));
    }
    
    res.redirect('/?error=' + encodeURIComponent('Microsoft authentication failed'));
  }
});

/**
 * GitHub OAuth callback route handler
 */
router.get('/auth/github/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error } = req.query;
    
    // Handle OAuth errors
    if (error) {
      console.error('GitHub OAuth error:', error);
      return res.redirect('/?error=' + encodeURIComponent('GitHub authentication failed'));
    }
    
    // Validate required parameters
    if (!code || typeof code !== 'string') {
      return res.redirect('/?error=' + encodeURIComponent('Invalid authorization code'));
    }
    
    // Get stored state from session
    const sessionState = req.session?.oauthState;
    
    // Handle GitHub OAuth callback
    const userProfile = await authService.handleGitHubCallback(
      code,
      state as string,
      sessionState
    );
    
    // Create session for authenticated user
    const sessionId = await authService.createSession(userProfile.id);
    
    // Store session ID in cookie
    req.session.sessionId = sessionId;
    
    // Clear OAuth state
    delete req.session.oauthState;
    
    // Redirect to dashboard
    res.redirect('/dashboard');
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    
    // Handle specific error types
    if (isAppError(error)) {
      const errorMessage = error.type === ErrorType.OAUTH_ERROR 
        ? 'GitHub authentication failed' 
        : 'Authentication error occurred';
      return res.redirect('/?error=' + encodeURIComponent(errorMessage));
    }
    
    res.redirect('/?error=' + encodeURIComponent('GitHub authentication failed'));
  }
});

/**
 * Logout route handler - destroys session and redirects to login
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.session?.sessionId;
    
    if (sessionId) {
      // Destroy session in database
      await authService.destroySession(sessionId);
    }
    
    // Destroy Express session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      
      // Clear session cookie
      res.clearCookie('connect.sid');
      
      // Redirect to login page
      res.redirect('/');
    });
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if there's an error, still try to redirect to login
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session during error handling:', err);
      }
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('Route error:', error);
  
  // Handle specific error types
  if (isAppError(error)) {
    res.status(error.statusCode).render('error', {
      error: error.message,
      statusCode: error.statusCode
    });
    return;
  }
  
  // Handle generic errors
  res.status(500).render('error', {
    error: 'An unexpected error occurred',
    statusCode: 500
  });
});

/**
 * Type guard for AppError
 */
function isAppError(error: any): error is AppError {
  return error && typeof error === 'object' && 'type' in error && 'message' in error && 'statusCode' in error;
}

export default router;