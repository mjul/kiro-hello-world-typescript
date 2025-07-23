import { DatabaseConnection } from '../../src/database/connection';
import { DatabaseSchema } from '../../src/database/schema';
import fs from 'fs';
import path from 'path';

describe('DatabaseSchema', () => {
  const testDbPath = 'test-data/schema-test.db';
  let schema: DatabaseSchema;
  let connection: DatabaseConnection;

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
    
    connection = DatabaseConnection.getInstance(testDbPath);
    schema = new DatabaseSchema();
  });

  afterEach(() => {
    try {
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

    // Reset singleton instance
    (DatabaseConnection as any).instance = null;
  });

  describe('initializeSchema', () => {
    it('should create users and sessions tables', async () => {
      await schema.initializeSchema();
      
      const db = connection.getDatabase();
      
      // Check if users table exists
      const usersTable = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `).get();
      expect(usersTable).toBeDefined();
      
      // Check if sessions table exists
      const sessionsTable = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='sessions'
      `).get();
      expect(sessionsTable).toBeDefined();
    });

    it('should handle multiple calls without error', async () => {
      await schema.initializeSchema();
      await expect(schema.initializeSchema()).resolves.not.toThrow();
    });
  });

  describe('createIndexes', () => {
    it('should create performance indexes', async () => {
      await schema.initializeSchema();
      await schema.createIndexes();
      
      const db = connection.getDatabase();
      
      // Check if indexes exist
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `).all();
      
      const indexNames = indexes.map((idx: any) => idx.name);
      expect(indexNames).toContain('idx_sessions_user_id');
      expect(indexNames).toContain('idx_sessions_expires_at');
      expect(indexNames).toContain('idx_users_provider');
    });

    it('should handle multiple calls without error', async () => {
      await schema.initializeSchema();
      await schema.createIndexes();
      await expect(schema.createIndexes()).resolves.not.toThrow();
    });
  });

  describe('migrate', () => {
    it('should initialize schema and create indexes', async () => {
      await schema.migrate();
      
      const db = connection.getDatabase();
      
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
  });

  describe('dropTables', () => {
    it('should drop all tables', async () => {
      await schema.initializeSchema();
      await schema.dropTables();
      
      const db = connection.getDatabase();
      
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('users', 'sessions')
      `).all();
      expect(tables).toHaveLength(0);
    });

    it('should handle dropping non-existent tables', async () => {
      await expect(schema.dropTables()).resolves.not.toThrow();
    });
  });

  describe('table structure validation', () => {
    it('should create users table with correct columns', async () => {
      await schema.initializeSchema();
      
      const db = connection.getDatabase();
      const columns = db.prepare(`PRAGMA table_info(users)`).all();
      
      const columnNames = columns.map((col: any) => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('username');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('provider');
      expect(columnNames).toContain('provider_id');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should create sessions table with correct columns', async () => {
      await schema.initializeSchema();
      
      const db = connection.getDatabase();
      const columns = db.prepare(`PRAGMA table_info(sessions)`).all();
      
      const columnNames = columns.map((col: any) => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('expires_at');
    });

    it('should enforce foreign key constraints', async () => {
      await schema.initializeSchema();
      
      const db = connection.getDatabase();
      
      // Try to insert session with non-existent user_id
      expect(() => {
        db.prepare(`
          INSERT INTO sessions (id, user_id, expires_at) 
          VALUES ('test-session', 'non-existent-user', datetime('now', '+1 day'))
        `).run();
      }).toThrow();
    });
  });
});