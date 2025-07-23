import { initializeApp, gracefulShutdown } from './app';
import { getConfig, logger } from './config';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    // Load and validate configuration
    const config = getConfig();

    logger.info('Starting SSO Web App', {
      nodeEnv: config.server.nodeEnv,
      port: config.server.port,
      baseUrl: config.server.baseUrl
    });

    // Initialize application
    const app = await initializeApp();

    // Start server
    const server = app.listen(config.server.port, () => {
      logger.info('Server started successfully', {
        port: config.server.port,
        environment: config.server.nodeEnv,
        url: `http://localhost:${config.server.port}`
      });
    });

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info('Shutdown signal received', { signal });
      
      server.close(async (err) => {
        if (err) {
          logger.error('Error closing server', err);
          process.exit(1);
        }
        
        try {
          await gracefulShutdown();
          logger.info('Server shut down successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', error);
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', new Error(String(reason)), { promise });
      shutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start application', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    logger.error('Application startup failed', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  });
}