import { Session } from '../models/Session';
import { User } from '../models/User';
import { Session as ISession, ErrorType, AppError } from '../models/interfaces';
import { DatabaseManager } from '../database/database';
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';

export class SessionManager {
  private db: Database.Database;

  constructor(databaseManager?: DatabaseManager) {
    // Use provided database manager or default singleton
    const dbManager = databaseManager || require('../database/database').database;
    this.db = dbManager.getConnection();
  }

  /**
   * Create a new session for a user
   */
  public async create(userId: string, durationMs?: number): Promise<Session> {
    try {
      // Input validation and sanitization
      const sanitizedUserId = this.sanitizeInput(userId);
      if (!sanitizedUserId) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'User ID is required to create session',
          statusCode: 400,
          details: { userId }
        } as AppError;
      }

      // Verify user exists
      const userExists = await this.verifyUserExists(sanitizedUserId);
      if (!userExists) {
        throw {
          type: ErrorType.USER_NOT_FOUND,
          message: 'Cannot create session for non-existent user',
          statusCode: 404,
          details: { userId: sanitizedUserId }
        } as AppError;
      }

      // Generate secure session ID
      const sessionId = this.generateSecureSessionId();

      // Create session instance
      const session = new Session({
        id: sessionId,
        userId: sanitizedUserId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (durationMs || 24 * 60 * 60 * 1000)) // Default 24 hours
      });

      // Validate session
      const validationErrors = session.validate();
      if (validationErrors.length > 0) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'Session validation failed',
          statusCode: 400,
          details: { errors: validationErrors }
        } as AppError;
      }

      // Insert session into database
      const stmt = this.db.prepare(`
        INSERT INTO sessions (id, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `);

      const dbRow = session.toDatabaseRow();
      const result = stmt.run(
        dbRow.id,
        dbRow.user_id,
        dbRow.created_at,
        dbRow.expires_at
      );

      if (result.changes === 0) {
        throw {
          type: ErrorType.DATABASE_ERROR,
          message: 'Failed to create session - no rows affected',
          statusCode: 500,
          details: { sessionId: session.id }
        } as AppError;
      }

      return session;
    } catch (error) {
      if (this.isAppError(error)) {
        throw error;
      }

      throw {
        type: ErrorType.DATABASE_ERROR,
        message: 'Failed to create session',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Validate a session by ID
   */
  public async validate(sessionId: string): Promise<Session | null> {
    try {
      // Input validation and sanitization
      const sanitizedSessionId = this.sanitizeInput(sessionId);
      if (!sanitizedSessionId) {
        return null;
      }

      // Find session in database
      const stmt = this.db.prepare(`
        SELECT * FROM sessions 
        WHERE id = ?
      `);

      const row = stmt.get(sanitizedSessionId);

      if (!row) {
        return null;
      }

      // Create session instance from database row
      const session = Session.fromDatabaseRow(row);

      // Check if session is expired
      if (session.isExpired()) {
        // Clean up expired session
        await this.destroy(session.id);
        return null;
      }

      // Validate session
      if (!session.isValid()) {
        return null;
      }

      return session;
    } catch (error) {
      // Log error but don't throw - validation should be non-throwing
      console.error('Session validation error:', error);
      return null;
    }
  }

  /**
   * Destroy a session by ID
   */
  public async destroy(sessionId: string): Promise<void> {
    try {
      // Input validation and sanitization
      const sanitizedSessionId = this.sanitizeInput(sessionId);
      if (!sanitizedSessionId) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'Session ID is required',
          statusCode: 400,
          details: { sessionId }
        } as AppError;
      }

      // Delete session from database
      const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
      const result = stmt.run(sanitizedSessionId);

      // Note: We don't throw an error if no rows were affected
      // as the session might already be deleted or expired
      if (result.changes === 0) {
        console.warn(`Session ${sanitizedSessionId} was not found for deletion`);
      }
    } catch (error) {
      if (this.isAppError(error)) {
        throw error;
      }

      throw {
        type: ErrorType.DATABASE_ERROR,
        message: 'Failed to destroy session',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Clean up expired sessions
   */
  public async cleanup(): Promise<number> {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM sessions 
        WHERE expires_at < datetime('now')
      `);

      const result = stmt.run();
      const deletedCount = result.changes;

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} expired sessions`);
      }

      return deletedCount;
    } catch (error) {
      throw {
        type: ErrorType.DATABASE_ERROR,
        message: 'Failed to cleanup expired sessions',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Get session with user information
   */
  public async getSessionWithUser(sessionId: string): Promise<{ session: Session; user: User } | null> {
    try {
      // Validate session first
      const session = await this.validate(sessionId);
      if (!session) {
        return null;
      }

      // Get user information
      const userStmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
      const userRow = userStmt.get(session.userId);

      if (!userRow) {
        // Session exists but user doesn't - clean up orphaned session
        await this.destroy(session.id);
        return null;
      }

      const user = User.fromDatabaseRow(userRow);

      return { session, user };
    } catch (error) {
      console.error('Error getting session with user:', error);
      return null;
    }
  }

  /**
   * Destroy all sessions for a user
   */
  public async destroyAllUserSessions(userId: string): Promise<number> {
    try {
      const sanitizedUserId = this.sanitizeInput(userId);
      if (!sanitizedUserId) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'User ID is required',
          statusCode: 400,
          details: { userId }
        } as AppError;
      }

      const stmt = this.db.prepare('DELETE FROM sessions WHERE user_id = ?');
      const result = stmt.run(sanitizedUserId);

      return result.changes;
    } catch (error) {
      if (this.isAppError(error)) {
        throw error;
      }

      throw {
        type: ErrorType.DATABASE_ERROR,
        message: 'Failed to destroy user sessions',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Get all active sessions for a user
   */
  public async getUserSessions(userId: string): Promise<Session[]> {
    try {
      const sanitizedUserId = this.sanitizeInput(userId);
      if (!sanitizedUserId) {
        return [];
      }

      const stmt = this.db.prepare(`
        SELECT * FROM sessions 
        WHERE user_id = ? AND expires_at > datetime('now')
        ORDER BY created_at DESC
      `);

      const rows = stmt.all(sanitizedUserId);
      return rows.map(row => Session.fromDatabaseRow(row));
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Extend session expiration time
   */
  public async extendSession(sessionId: string, durationMs: number = 24 * 60 * 60 * 1000): Promise<Session | null> {
    try {
      // Validate session first
      const session = await this.validate(sessionId);
      if (!session) {
        return null;
      }

      // Extend session
      session.extend(durationMs);

      // Update in database
      const stmt = this.db.prepare(`
        UPDATE sessions 
        SET expires_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(session.expiresAt.toISOString(), session.id);

      if (result.changes === 0) {
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error extending session:', error);
      return null;
    }
  }

  /**
   * Get session statistics
   */
  public async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    try {
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM sessions');
      const activeStmt = this.db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE expires_at > datetime('now')`);
      const expiredStmt = this.db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE expires_at <= datetime('now')`);

      const totalResult = totalStmt.get() as { count: number };
      const activeResult = activeStmt.get() as { count: number };
      const expiredResult = expiredStmt.get() as { count: number };

      return {
        totalSessions: totalResult.count,
        activeSessions: activeResult.count,
        expiredSessions: expiredResult.count
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0
      };
    }
  }

  /**
   * Generate a cryptographically secure session ID
   */
  private generateSecureSessionId(): string {
    // Generate 32 bytes of random data and convert to hex
    // This creates a 64-character hex string
    const randomData = randomBytes(32);
    return randomData.toString('hex');
  }

  /**
   * Verify that a user exists in the database
   */
  private async verifyUserExists(userId: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM users WHERE id = ?');
      const result = stmt.get(userId);
      return result !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sanitize input to prevent injection attacks
   */
  private sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    return input.trim();
  }

  /**
   * Type guard for AppError
   */
  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'type' in error && 'message' in error && 'statusCode' in error;
  }
}