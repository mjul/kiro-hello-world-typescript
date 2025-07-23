import { DatabaseManager } from '../../src/database/database';
import { DatabaseConnection } from '../../src/database/connection';
import fs from 'fs';
import path from 'path';

describe('DatabaseManager', () => {
  const testDbPath = 'test-data/database-test.db';
  let database: DatabaseManager;

  beforeEach(() => {
    try {
      // Clean up any existing test database
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

    // Reset singleton instance
    (DatabaseConnection as any).instance = null;
    
    database = new DatabaseManager(testDbPath);
  });

  afterEach(async () => {
    try {
      if (database) {
        await database.close();
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

    // Reset singleton instance
    (DatabaseConnection as any).instance = null;
  });

  describe('initialize', () => {
    it('should initialize database with schema and indexes', async () => {
      await database.initialize();
      
      const db = database.getConnection();
      
      // Check tables exist
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('users', 'sessions')
      `).all();
      expect(tables).toHaveLength(2);
      
      // Check indexes exist
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `).all();
      expect(indexes.length).toBeGreaterThan(0);
    });

    it('should throw error if connection is not open', async () => {
      await database.close();
      
      await expect(database.initialize()).rejects.toThrow('Database connection is not open');
    });
  });

  describe('getConnection', () => {
    it('should return database connection', async () => {
      const db = database.getConnection();
      
      expect(db).toBeDefined();
      expect(typeof db.exec).toBe('function');
    });
  });

  describe('reset', () => {
    it('should drop and recreate all tables', async () => {
      await database.initialize();
      
      // Insert test data
      const db = database.getConnection();
      db.prepare(`
        INSERT INTO users (id, username, email, provider, provider_id) 
        VALUES ('test-id', 'testuser', 'test@example.com', 'github', 'github123')
      `).run();
      
      // Verify data exists
      const userBefore = db.prepare('SELECT * FROM users WHERE id = ?').get('test-id');
      expect(userBefore).toBeDefined();
      
      // Reset database
      await database.reset();
      
      // Verify data is gone but tables exist
      const userAfter = db.prepare('SELECT * FROM users WHERE id = ?').get('test-id');
      expect(userAfter).toBeUndefined();
      
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('users', 'sessions')
      `).all();
      expect(tables).toHaveLength(2);
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      const connection = DatabaseConnection.getInstance();
      expect(connection.isOpen()).toBe(true);
      
      await database.close();
      
      expect(connection.isOpen()).toBe(false);
    });
  });

  describe('integration tests', () => {
    it('should support basic CRUD operations after initialization', async () => {
      await database.initialize();
      
      const db = database.getConnection();
      
      // Insert user
      const insertUser = db.prepare(`
        INSERT INTO users (id, username, email, provider, provider_id) 
        VALUES (?, ?, ?, ?, ?)
      `);
      
      insertUser.run('user1', 'testuser', 'test@example.com', 'github', 'github123');
      
      // Read user
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get('user1');
      expect(user).toBeDefined();
      expect((user as any).username).toBe('testuser');
      
      // Insert session
      const insertSession = db.prepare(`
        INSERT INTO sessions (id, user_id, expires_at) 
        VALUES (?, ?, datetime('now', '+1 day'))
      `);
      
      insertSession.run('session1', 'user1');
      
      // Read session
      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get('session1');
      expect(session).toBeDefined();
      expect((session as any).user_id).toBe('user1');
      
      // Test foreign key constraint
      const userSessions = db.prepare(`
        SELECT s.* FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE u.id = ?
      `).all('user1');
      
      expect(userSessions).toHaveLength(1);
    });

    it('should enforce unique constraint on provider and provider_id', async () => {
      await database.initialize();
      
      const db = database.getConnection();
      
      // Insert first user
      db.prepare(`
        INSERT INTO users (id, username, email, provider, provider_id) 
        VALUES ('user1', 'testuser1', 'test1@example.com', 'github', 'github123')
      `).run();
      
      // Try to insert duplicate provider/provider_id combination
      expect(() => {
        db.prepare(`
          INSERT INTO users (id, username, email, provider, provider_id) 
          VALUES ('user2', 'testuser2', 'test2@example.com', 'github', 'github123')
        `).run();
      }).toThrow();
    });
  });
});