import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: Database.Database;

  private constructor(dbPath: string = 'data/app.db') {
    // Ensure the directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      console.log(`Database connected: ${dbPath}`);
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public static getInstance(dbPath?: string): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(dbPath);
    }
    return DatabaseConnection.instance;
  }

  public getDatabase(): Database.Database {
    return this.db;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed');
    }
  }

  public isOpen(): boolean {
    return this.db && this.db.open;
  }
}