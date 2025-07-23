import { setupTestEnvironment, cleanupTestEnvironment } from '../src/config';

// Set up test environment before all tests
beforeAll(() => {
  setupTestEnvironment();
});

// Clean up test environment after all tests
afterAll(() => {
  cleanupTestEnvironment();
});

// Basic test to verify Jest setup
describe('Project Setup', () => {
  it('should have TypeScript and Jest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should be able to import Node.js modules', () => {
    const path = require('path');
    expect(typeof path.join).toBe('function');
  });

  it('should have test environment variables set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.SESSION_SECRET).toBeDefined();
    expect(process.env.MICROSOFT_CLIENT_ID).toBeDefined();
    expect(process.env.GITHUB_CLIENT_ID).toBeDefined();
  });
});