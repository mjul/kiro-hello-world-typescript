import { initializeApp, gracefulShutdown } from '../../src/app';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../src/config/test';

describe('Application Integration', () => {
  beforeAll(() => {
    setupTestEnvironment();
  });

  afterAll(() => {
    cleanupTestEnvironment();
  });

  it('should initialize application with configuration and handle graceful shutdown', async () => {
    const app = await initializeApp();
    expect(app).toBeDefined();
    
    // Should not throw
    await expect(gracefulShutdown()).resolves.not.toThrow();
  }, 10000);
});