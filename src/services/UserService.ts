import { User } from '../models/User';
import { UserProfile, ErrorType, AppError } from '../models/interfaces';
import { DatabaseManager } from '../database/database';
import Database from 'better-sqlite3';

export class UserService {
  private db: Database.Database;

  constructor(databaseManager?: DatabaseManager) {
    // Use provided database manager or default singleton
    const dbManager = databaseManager || require('../database/database').database;
    this.db = dbManager.getConnection();
  }

  /**
   * Find user by provider ID and provider type
   */
  public async findByProviderId(providerId: string, provider: string): Promise<User | null> {
    try {
      // Input validation and sanitization
      const sanitizedProviderId = this.sanitizeInput(providerId);
      const sanitizedProvider = this.sanitizeInput(provider);

      if (!sanitizedProviderId || !sanitizedProvider) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'Provider ID and provider are required',
          statusCode: 400,
          details: { providerId: sanitizedProviderId, provider: sanitizedProvider }
        } as AppError;
      }

      if (!this.isValidProvider(sanitizedProvider)) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'Invalid provider. Must be microsoft or github',
          statusCode: 400,
          details: { provider: sanitizedProvider }
        } as AppError;
      }

      const stmt = this.db.prepare(`
        SELECT * FROM users 
        WHERE provider_id = ? AND provider = ?
      `);

      const row = stmt.get(sanitizedProviderId, sanitizedProvider);

      if (!row) {
        return null;
      }

      return User.fromDatabaseRow(row);
    } catch (error) {
      if (this.isAppError(error)) {
        throw error;
      }
      
      throw {
        type: ErrorType.DATABASE_ERROR,
        message: 'Failed to find user by provider ID',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Create a new user from UserProfile
   */
  public async createUser(profile: UserProfile): Promise<User> {
    try {
      // Sanitize profile inputs
      const sanitizedProfile: UserProfile = {
        id: this.sanitizeInput(profile.id),
        username: this.sanitizeInput(profile.username),
        email: this.sanitizeInput(profile.email),
        provider: profile.provider
      };

      // Create User instance from sanitized profile
      const user = User.fromProfile(sanitizedProfile);

      // Validate user data
      const validationErrors = user.validate();
      if (validationErrors.length > 0) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'User validation failed',
          statusCode: 400,
          details: { errors: validationErrors }
        } as AppError;
      }

      // Check if user already exists
      const existingUser = await this.findByProviderId(sanitizedProfile.id, sanitizedProfile.provider);
      if (existingUser) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'User already exists with this provider ID',
          statusCode: 409,
          details: { providerId: sanitizedProfile.id, provider: sanitizedProfile.provider }
        } as AppError;
      }

      // Insert user into database
      const stmt = this.db.prepare(`
        INSERT INTO users (id, username, email, provider, provider_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const dbRow = user.toDatabaseRow();
      const result = stmt.run(
        dbRow.id,
        dbRow.username,
        dbRow.email,
        dbRow.provider,
        dbRow.provider_id,
        dbRow.created_at,
        dbRow.updated_at
      );

      if (result.changes === 0) {
        throw {
          type: ErrorType.DATABASE_ERROR,
          message: 'Failed to create user - no rows affected',
          statusCode: 500,
          details: { userId: user.id }
        } as AppError;
      }

      return user;
    } catch (error) {
      if (this.isAppError(error)) {
        throw error;
      }

      // Handle SQLite constraint violations
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'User already exists with this provider ID',
          statusCode: 409,
          details: { error: error.message }
        } as AppError;
      }

      throw {
        type: ErrorType.DATABASE_ERROR,
        message: 'Failed to create user',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Update an existing user
   */
  public async updateUser(userId: string, profile: Partial<UserProfile>): Promise<User> {
    try {
      // Input validation
      const sanitizedUserId = this.sanitizeInput(userId);
      if (!sanitizedUserId) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'User ID is required',
          statusCode: 400,
          details: { userId }
        } as AppError;
      }

      // Find existing user
      const existingUser = await this.findById(sanitizedUserId);
      if (!existingUser) {
        throw {
          type: ErrorType.USER_NOT_FOUND,
          message: 'User not found',
          statusCode: 404,
          details: { userId: sanitizedUserId }
        } as AppError;
      }

      // Update user with new data
      const updateData: Partial<User> = {};
      if (profile.username !== undefined) {
        updateData.username = this.sanitizeInput(profile.username);
      }
      if (profile.email !== undefined) {
        updateData.email = this.sanitizeInput(profile.email);
      }
      if (profile.provider !== undefined) {
        updateData.provider = this.sanitizeInput(profile.provider);
      }
      if (profile.id !== undefined) {
        updateData.providerId = this.sanitizeInput(profile.id);
      }

      existingUser.update(updateData);

      // Validate updated user
      const validationErrors = existingUser.validate();
      if (validationErrors.length > 0) {
        throw {
          type: ErrorType.VALIDATION_ERROR,
          message: 'User validation failed',
          statusCode: 400,
          details: { errors: validationErrors }
        } as AppError;
      }

      // Update in database
      const stmt = this.db.prepare(`
        UPDATE users 
        SET username = ?, email = ?, provider = ?, provider_id = ?, updated_at = ?
        WHERE id = ?
      `);

      const dbRow = existingUser.toDatabaseRow();
      const result = stmt.run(
        dbRow.username,
        dbRow.email,
        dbRow.provider,
        dbRow.provider_id,
        dbRow.updated_at,
        dbRow.id
      );

      if (result.changes === 0) {
        throw {
          type: ErrorType.DATABASE_ERROR,
          message: 'Failed to update user - no rows affected',
          statusCode: 500,
          details: { userId: sanitizedUserId }
        } as AppError;
      }

      return existingUser;
    } catch (error) {
      if (this.isAppError(error)) {
        throw error;
      }

      throw {
        type: ErrorType.DATABASE_ERROR,
        message: 'Failed to update user',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Find user by ID (helper method)
   */
  public async findById(userId: string): Promise<User | null> {
    try {
      const sanitizedUserId = this.sanitizeInput(userId);
      if (!sanitizedUserId) {
        return null;
      }

      const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
      const row = stmt.get(sanitizedUserId);

      if (!row) {
        return null;
      }

      return User.fromDatabaseRow(row);
    } catch (error) {
      throw {
        type: ErrorType.DATABASE_ERROR,
        message: 'Failed to find user by ID',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Delete a user (helper method for testing)
   */
  public async deleteUser(userId: string): Promise<boolean> {
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

      const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
      const result = stmt.run(sanitizedUserId);

      return result.changes > 0;
    } catch (error) {
      if (this.isAppError(error)) {
        throw error;
      }

      throw {
        type: ErrorType.DATABASE_ERROR,
        message: 'Failed to delete user',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
    }
  }

  /**
   * Get all users (helper method for testing)
   */
  public async getAllUsers(): Promise<User[]> {
    try {
      const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
      const rows = stmt.all();

      return rows.map(row => User.fromDatabaseRow(row));
    } catch (error) {
      throw {
        type: ErrorType.DATABASE_ERROR,
        message: 'Failed to get all users',
        statusCode: 500,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      } as AppError;
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
   * Validate provider type
   */
  private isValidProvider(provider: string): boolean {
    return ['microsoft', 'github'].includes(provider.toLowerCase());
  }

  /**
   * Type guard for AppError
   */
  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'type' in error && 'message' in error && 'statusCode' in error;
  }
}