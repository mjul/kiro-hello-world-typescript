import { DatabaseConnection } from './connection';
import { DatabaseSchema } from './schema';
import Database from 'better-sqlite3';
import { getConfig, logger } from '../config';

export class DatabaseManager {
  private connection: DatabaseConnection;
  private schema: DatabaseSchema;

  constructor(dbPath?: string) {
    const config = getConfig();
    const finalDbPath = dbPath || config.database.path;
    this.connection = DatabaseConnection.getInstance(finalDbPath);
    this.schema = new DatabaseSchema();
    
    logger.database('DatabaseManager initialized', { dbPath: finalDbPath });
  }

  public async initialize(): Promise<void> {
    try {
      if (!this.connection.isOpen()) {
        throw new Error('Database connection is not open');
      }

      await this.schema.migrate();
      logger.database('Database initialized successfully');
    } catch (error) {
      logger.error('Database initialization failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public getConnection(): Database.Database {
    return this.connection.getDatabase();
  }

  public async close(): Promise<void> {
    this.connection.close();
    logger.database('Database connection closed');
  }

  public async reset(): Promise<void> {
    try {
      await this.schema.dropTables();
      await this.schema.migrate();
      logger.database('Database reset successfully');
    } catch (error) {
      logger.error('Database reset failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

// Export singleton instance
export const database = new DatabaseManager();