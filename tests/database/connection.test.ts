import { DatabaseConnection } from '../../src/database/connection';
import fs from 'fs';
import path from 'path';

describe('DatabaseConnection', () => {
  const testDbPath = 'test-data/test.db';
  
  beforeEach(() => {
    // Clean up any existing test database
    try {
      const dir = path.dirname(testDbPath);
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(() => {
    try {
      // Clean up test database
      const connection = DatabaseConnection.getInstance();
      if (connection.isOpen()) {
        connection.close();
      }
      
      const dir = path.dirname(testDbPath);
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    // Reset singleton instance for next test
    (DatabaseConnection as any).instance = null;
  });

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = DatabaseConnection.getInstance(testDbPath);
      const instance2 = DatabaseConnection.getInstance(testDbPath);
      
      expect(instance1).toBe(instance2);
    });

    it('should create database directory if it does not exist', () => {
      const connection = DatabaseConnection.getInstance(testDbPath);
      
      expect(fs.existsSync(path.dirname(testDbPath))).toBe(true);
      expect(connection.isOpen()).toBe(true);
    });

    it('should throw error for invalid database path', () => {
      // Use a path that will definitely fail on Windows
      const invalidPath = 'Z:\\invalid\\path\\that\\cannot\\be\\created\\test.db';
      
      expect(() => {
        DatabaseConnection.getInstance(invalidPath);
      }).toThrow();
    });
  });

  describe('getDatabase', () => {
    it('should return database instance', () => {
      const connection = DatabaseConnection.getInstance(testDbPath);
      const db = connection.getDatabase();
      
      expect(db).toBeDefined();
      expect(typeof db.exec).toBe('function');
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      const connection = DatabaseConnection.getInstance(testDbPath);
      
      expect(connection.isOpen()).toBe(true);
      
      connection.close();
      
      expect(connection.isOpen()).toBe(false);
    });
  });

  describe('isOpen', () => {
    it('should return true for open connection', () => {
      const connection = DatabaseConnection.getInstance(testDbPath);
      
      expect(connection.isOpen()).toBe(true);
    });

    it('should return false for closed connection', () => {
      const connection = DatabaseConnection.getInstance(testDbPath);
      connection.close();
      
      expect(connection.isOpen()).toBe(false);
    });
  });
});