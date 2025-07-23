import { User as IUser, UserProfile, ErrorType, AppError } from './interfaces';
import { v4 as uuidv4 } from 'uuid';

export class User implements IUser {
  public id: string;
  public username: string;
  public email: string;
  public provider: string;
  public providerId: string;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: Partial<IUser> = {}) {
    this.id = data.id || uuidv4();
    this.username = data.username || '';
    this.email = data.email || '';
    this.provider = data.provider || '';
    this.providerId = data.providerId || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Create a User instance from UserProfile data
   */
  public static fromProfile(profile: UserProfile): User {
    return new User({
      username: profile.username,
      email: profile.email,
      provider: profile.provider,
      providerId: profile.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Create a User instance from database row data
   */
  public static fromDatabaseRow(row: any): User {
    return new User({
      id: row.id,
      username: row.username,
      email: row.email,
      provider: row.provider,
      providerId: row.provider_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }

  /**
   * Validate user data
   */
  public validate(): AppError[] {
    const errors: AppError[] = [];

    if (!this.username || this.username.trim().length === 0) {
      errors.push({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Username is required',
        statusCode: 400,
        details: { field: 'username' }
      });
    }

    if (!this.email || !this.isValidEmail(this.email)) {
      errors.push({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Valid email is required',
        statusCode: 400,
        details: { field: 'email' }
      });
    }

    if (!this.provider || !this.isValidProvider(this.provider)) {
      errors.push({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Valid provider is required (microsoft or github)',
        statusCode: 400,
        details: { field: 'provider' }
      });
    }

    if (!this.providerId || this.providerId.trim().length === 0) {
      errors.push({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Provider ID is required',
        statusCode: 400,
        details: { field: 'providerId' }
      });
    }

    return errors;
  }

  /**
   * Check if the user data is valid
   */
  public isValid(): boolean {
    return this.validate().length === 0;
  }

  /**
   * Update user data and set updatedAt timestamp
   */
  public update(data: Partial<IUser>): void {
    if (data.username !== undefined) this.username = data.username;
    if (data.email !== undefined) this.email = data.email;
    if (data.provider !== undefined) this.provider = data.provider;
    if (data.providerId !== undefined) this.providerId = data.providerId;
    
    this.updatedAt = new Date();
  }

  /**
   * Convert to database row format
   */
  public toDatabaseRow(): any {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      provider: this.provider,
      provider_id: this.providerId,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString()
    };
  }

  /**
   * Convert to plain object
   */
  public toJSON(): IUser {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      provider: this.provider,
      providerId: this.providerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate provider
   */
  private isValidProvider(provider: string): boolean {
    return ['microsoft', 'github'].includes(provider.toLowerCase());
  }
}