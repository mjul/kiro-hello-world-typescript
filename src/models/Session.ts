import { Session as ISession, ErrorType, AppError } from './interfaces';
import { v4 as uuidv4 } from 'uuid';

export class Session implements ISession {
  public id: string;
  public userId: string;
  public createdAt: Date;
  public expiresAt: Date;

  // Default session duration: 24 hours
  private static readonly DEFAULT_DURATION_MS = 24 * 60 * 60 * 1000;

  constructor(data: Partial<ISession> = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId || '';
    this.createdAt = data.createdAt || new Date();
    this.expiresAt = data.expiresAt || new Date(Date.now() + Session.DEFAULT_DURATION_MS);
  }

  /**
   * Create a new session for a user
   */
  public static createForUser(userId: string, durationMs?: number): Session {
    const duration = durationMs || Session.DEFAULT_DURATION_MS;
    return new Session({
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + duration)
    });
  }

  /**
   * Create a Session instance from database row data
   */
  public static fromDatabaseRow(row: any): Session {
    return new Session({
      id: row.id,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at)
    });
  }

  /**
   * Check if the session is expired
   */
  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Check if the session is valid (not expired and has required data)
   */
  public isValid(): boolean {
    return !this.isExpired() && this.userId.trim().length > 0;
  }

  /**
   * Get remaining time in milliseconds until expiration
   */
  public getRemainingTime(): number {
    const remaining = this.expiresAt.getTime() - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Extend the session by the specified duration
   */
  public extend(durationMs: number = Session.DEFAULT_DURATION_MS): void {
    this.expiresAt = new Date(Date.now() + durationMs);
  }

  /**
   * Refresh the session (extend by default duration)
   */
  public refresh(): void {
    this.extend();
  }

  /**
   * Validate session data
   */
  public validate(): AppError[] {
    const errors: AppError[] = [];

    if (!this.userId || this.userId.trim().length === 0) {
      errors.push({
        type: ErrorType.VALIDATION_ERROR,
        message: 'User ID is required for session',
        statusCode: 400,
        details: { field: 'userId' }
      });
    }

    if (this.isExpired()) {
      errors.push({
        type: ErrorType.SESSION_EXPIRED,
        message: 'Session has expired',
        statusCode: 401,
        details: { 
          expiresAt: this.expiresAt,
          currentTime: new Date()
        }
      });
    }

    if (this.createdAt > this.expiresAt) {
      errors.push({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Session expiration time cannot be before creation time',
        statusCode: 400,
        details: { 
          createdAt: this.createdAt,
          expiresAt: this.expiresAt
        }
      });
    }

    return errors;
  }

  /**
   * Convert to database row format
   */
  public toDatabaseRow(): any {
    return {
      id: this.id,
      user_id: this.userId,
      created_at: this.createdAt.toISOString(),
      expires_at: this.expiresAt.toISOString()
    };
  }

  /**
   * Convert to plain object
   */
  public toJSON(): ISession {
    return {
      id: this.id,
      userId: this.userId,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt
    };
  }

  /**
   * Get session info for debugging
   */
  public getInfo(): {
    id: string;
    userId: string;
    isExpired: boolean;
    remainingTimeMs: number;
    createdAt: string;
    expiresAt: string;
  } {
    return {
      id: this.id,
      userId: this.userId,
      isExpired: this.isExpired(),
      remainingTimeMs: this.getRemainingTime(),
      createdAt: this.createdAt.toISOString(),
      expiresAt: this.expiresAt.toISOString()
    };
  }
}