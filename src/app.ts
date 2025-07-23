import express, { Application, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import path from 'path';
import { database } from './database/database';
import routes from './routes/index';
import { ErrorType, AppError } from './models/interfaces';
import { getConfig, logger, requestLoggingMiddleware, getEnvironmentConfig } from './config';

// Import SQLite session store
const SQLiteStore = require('connect-sqlite3')(session);

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();
  const config = getConfig();
  const envConfig = getEnvironmentConfig();

  logger.info('Creating Express application', { 
    nodeEnv: config.server.nodeEnv,
    port: config.server.port 
  });

  // Security middleware - helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' }
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Session middleware with SQLite store
  app.use(session({
    store: new SQLiteStore({
      db: 'sessions.db',
      table: 'sessions',
      dir: path.dirname(config.database.path)
    }),
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    name: 'sessionId',
    cookie: {
      secure: config.session.secure,
      httpOnly: config.session.httpOnly,
      maxAge: config.session.maxAge,
      sameSite: config.session.sameSite
    },
    rolling: true // Reset expiration on activity
  }));

  // Configure EJS as template engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../templates'));

  // Static file serving
  app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: config.server.nodeEnv === 'production' ? '1d' : '0',
    etag: true,
    lastModified: true
  }));

  // Request logging middleware
  if (envConfig.logging.requests) {
    app.use(requestLoggingMiddleware());
  }

  // Routes
  app.use('/', routes);

  // 404 handler - must come after all routes
  app.use((req: Request, res: Response) => {
    res.status(404).render('error', {
      error: 'Page not found',
      statusCode: 404
    });
  });

  // Global error handling middleware - must be last
  app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Global error handler', error, { 
      url: req.url, 
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    // Handle specific error types
    if (isAppError(error)) {
      return res.status(error.statusCode).render('error', {
        error: error.message,
        statusCode: error.statusCode
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).render('error', {
        error: 'Invalid input provided',
        statusCode: 400
      });
    }

    // Handle database errors
    if (error.code === 'SQLITE_ERROR' || error.code?.startsWith('SQLITE_')) {
      logger.error('Database error', error);
      return res.status(500).render('error', {
        error: 'Database error occurred',
        statusCode: 500
      });
    }

    // Handle session errors
    if (error.message?.includes('session')) {
      return res.status(401).render('error', {
        error: 'Session error - please log in again',
        statusCode: 401
      });
    }

    // Handle OAuth errors
    if (error.message?.includes('OAuth') || error.message?.includes('authentication')) {
      return res.status(401).render('error', {
        error: 'Authentication failed',
        statusCode: 401
      });
    }

    // Handle template errors
    if (error.message?.includes('template') || error.message?.includes('render')) {
      logger.error('Template error', error);
      return res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Template Error</h1>
            <p>There was an error rendering the page. Please try again.</p>
            <a href="/">Go Home</a>
          </body>
        </html>
      `);
    }

    // Generic error handler
    const statusCode = error.status || error.statusCode || 500;
    const message = config.server.nodeEnv === 'production' 
      ? 'An unexpected error occurred' 
      : error.message || 'Unknown error';

    res.status(statusCode).render('error', {
      error: message,
      statusCode: statusCode
    });
  });

  return app;
}

/**
 * Initialize the application with database
 */
export async function initializeApp(): Promise<Application> {
  try {
    const config = getConfig();
    
    logger.info('Initializing application', { 
      nodeEnv: config.server.nodeEnv,
      databasePath: config.database.path 
    });

    // Initialize database
    await database.initialize();
    logger.info('Database initialized successfully');

    // Create and configure Express app
    const app = createApp();
    logger.info('Express application configured successfully');

    return app;
  } catch (error) {
    logger.error('Failed to initialize application', error);
    throw error;
  }
}

/**
 * Type guard for AppError
 */
function isAppError(error: any): error is AppError {
  return error && typeof error === 'object' && 'type' in error && 'message' in error && 'statusCode' in error;
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(): Promise<void> {
  try {
    logger.info('Shutting down gracefully...');
    
    // Close database connection
    await database.close();
    logger.info('Database connection closed');
    
    logger.info('Graceful shutdown completed');
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    throw error;
  }
}