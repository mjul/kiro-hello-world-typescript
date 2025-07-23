import { DatabaseConnection } from './connection';
import Database from 'better-sqlite3';

export class DatabaseSchema {
  private db: Database.Database;

  constructor() {
    this.db = DatabaseConnection.getInstance().getDatabase();
  }

  public async initializeSchema(): Promise<void> {
    try {
      // Create users table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          email TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(provider, provider_id)
        )
      `);

      // Create sessions table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw new Error(`Schema initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async createIndexes(): Promise<void> {
    try {
      // Create indexes for performance optimization
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id)
      `);

      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Failed to create database indexes:', error);
      throw new Error(`Index creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async migrate(): Promise<void> {
    try {
      await this.initializeSchema();
      await this.createIndexes();
      console.log('Database migration completed successfully');
    } catch (error) {
      console.error('Database migration failed:', error);
      throw error;
    }
  }

  public async dropTables(): Promise<void> {
    try {
      this.db.exec('DROP TABLE IF EXISTS sessions');
      this.db.exec('DROP TABLE IF EXISTS users');
      console.log('Database tables dropped successfully');
    } catch (error) {
      console.error('Failed to drop database tables:', error);
      throw new Error(`Table drop failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}