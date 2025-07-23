/**
 * Application Logging Module
 * 
 * This module provides structured logging functionality for the application
 * with different log levels and environment-specific configurations.
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  error?: Error | undefined;
}

export class Logger {
  private level: LogLevel;
  private enableRequestLogging: boolean;
  private enableErrorLogging: boolean;

  constructor(
    level: LogLevel = LogLevel.INFO,
    enableRequestLogging: boolean = true,
    enableErrorLogging: boolean = true
  ) {
    this.level = level;
    this.enableRequestLogging = enableRequestLogging;
    this.enableErrorLogging = enableErrorLogging;
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, data?: any): void {
    if (this.level >= LogLevel.ERROR && this.enableErrorLogging) {
      const errorObj = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
      this.log('ERROR', message, data, errorObj);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: any): void {
    if (this.level >= LogLevel.WARN) {
      this.log('WARN', message, data);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, data?: any): void {
    if (this.level >= LogLevel.INFO) {
      this.log('INFO', message, data);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      this.log('DEBUG', message, data);
    }
  }

  /**
   * Log a request (if enabled)
   */
  request(method: string, url: string, statusCode?: number, duration?: number): void {
    if (this.enableRequestLogging && this.level >= LogLevel.INFO) {
      const message = `${method} ${url}`;
      const data = {
        method,
        url,
        statusCode,
        duration: duration ? `${duration}ms` : undefined
      };
      this.log('REQUEST', message, data);
    }
  }

  /**
   * Log a security event
   */
  security(event: string, data?: any): void {
    if (this.level >= LogLevel.WARN) {
      this.log('SECURITY', `Security event: ${event}`, data);
    }
  }

  /**
   * Log an authentication event
   */
  auth(event: string, userId?: string, provider?: string): void {
    if (this.level >= LogLevel.INFO) {
      const data = { userId, provider };
      this.log('AUTH', `Auth event: ${event}`, data);
    }
  }

  /**
   * Log a database event
   */
  database(event: string, data?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      this.log('DATABASE', `Database event: ${event}`, data);
    }
  }

  /**
   * Internal logging method
   */
  private log(level: string, message: string, data?: any, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      error
    };

    // Format output based on environment
    if (process.env.NODE_ENV === 'production') {
      // JSON format for production (easier for log aggregation)
      console.log(JSON.stringify({
        ...entry,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : undefined
      }));
    } else {
      // Human-readable format for development
      const timestamp = entry.timestamp;
      const levelStr = `[${level}]`.padEnd(10);
      
      if (error) {
        console.error(`${timestamp} ${levelStr} ${message}`);
        if (data) {
          console.error('Data:', JSON.stringify(data, null, 2));
        }
        console.error('Error:', error);
      } else {
        console.log(`${timestamp} ${levelStr} ${message}`);
        if (data) {
          console.log('Data:', JSON.stringify(data, null, 2));
        }
      }
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: any): Logger {
    const childLogger = new Logger(this.level, this.enableRequestLogging, this.enableErrorLogging);
    
    // Override log method to include context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: string, message: string, data?: any, error?: Error) => {
      const contextualData = data ? { ...context, ...data } : context;
      originalLog(level, message, contextualData, error);
    };

    return childLogger;
  }
}

/**
 * Create logger based on environment configuration
 */
export function createLogger(): Logger {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  let level: LogLevel;
  let enableRequestLogging: boolean;
  let enableErrorLogging: boolean;

  switch (nodeEnv) {
    case 'production':
      level = LogLevel.INFO;
      enableRequestLogging = false;
      enableErrorLogging = true;
      break;
    case 'test':
      level = LogLevel.ERROR;
      enableRequestLogging = false;
      enableErrorLogging = false;
      break;
    default: // development
      level = LogLevel.DEBUG;
      enableRequestLogging = true;
      enableErrorLogging = true;
      break;
  }

  return new Logger(level, enableRequestLogging, enableErrorLogging);
}

// Export singleton logger instance
export const logger = createLogger();

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    // Log request
    logger.request(req.method, req.url);
    
    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.request(req.method, req.url, res.statusCode, duration);
    });
    
    next();
  };
}