import { Logger, LogLevel, createLogger } from '../../src/config/logger';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../src/config/test';

describe('Logger', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logOutput: string[];
  let errorOutput: string[];

  beforeAll(() => {
    setupTestEnvironment();
  });

  afterAll(() => {
    cleanupTestEnvironment();
  });

  beforeEach(() => {
    logOutput = [];
    errorOutput = [];
    
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    
    console.log = jest.fn((...args) => {
      logOutput.push(args.join(' '));
    });
    
    console.error = jest.fn((...args) => {
      errorOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('Logger class', () => {
    it('should create logger with default settings', () => {
      const logger = new Logger();
      expect(logger).toBeDefined();
    });

    it('should log error messages', () => {
      const logger = new Logger(LogLevel.ERROR);
      const error = new Error('Test error');
      
      logger.error('Test error message', error);
      
      expect(errorOutput.length).toBeGreaterThan(0);
      expect(errorOutput[0]).toContain('Test error message');
    });

    it('should log info messages when level allows', () => {
      const logger = new Logger(LogLevel.INFO);
      
      logger.info('Test info message');
      
      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput[0]).toContain('Test info message');
    });

    it('should not log debug messages when level is INFO', () => {
      const logger = new Logger(LogLevel.INFO);
      
      logger.debug('Test debug message');
      
      expect(logOutput.length).toBe(0);
    });

    it('should log request information', () => {
      const logger = new Logger(LogLevel.INFO, true);
      
      logger.request('GET', '/test', 200, 150);
      
      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput[0]).toContain('GET /test');
    });

    it('should log authentication events', () => {
      const logger = new Logger(LogLevel.INFO);
      
      logger.auth('login', 'user123', 'github');
      
      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput[0]).toContain('Auth event: login');
    });

    it('should create child logger with context', () => {
      const logger = new Logger(LogLevel.INFO);
      const childLogger = logger.child({ userId: 'test123' });
      
      childLogger.info('Test message');
      
      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput[0]).toContain('Test message');
    });
  });

  describe('createLogger', () => {
    it('should create logger with test environment settings', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      
      // In test environment, should not log info messages
      logger.info('Test info');
      expect(logOutput.length).toBe(0);
      
      // But should log errors
      logger.error('Test error');
      expect(errorOutput.length).toBeGreaterThan(0);
    });
  });
});