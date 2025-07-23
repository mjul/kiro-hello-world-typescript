import { User } from '../../src/models/User';
import { UserProfile, ErrorType } from '../../src/models/interfaces';

describe('User Model', () => {
  describe('Constructor', () => {
    it('should create a user with default values', () => {
      const user = new User();
      
      expect(user.id).toBeDefined();
      expect(user.username).toBe('');
      expect(user.email).toBe('');
      expect(user.provider).toBe('');
      expect(user.providerId).toBe('');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a user with provided data', () => {
      const userData = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github',
        providerId: 'github123',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02')
      };

      const user = new User(userData);
      
      expect(user.id).toBe(userData.id);
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.provider).toBe(userData.provider);
      expect(user.providerId).toBe(userData.providerId);
      expect(user.createdAt).toEqual(userData.createdAt);
      expect(user.updatedAt).toEqual(userData.updatedAt);
    });
  });

  describe('fromProfile', () => {
    it('should create a user from UserProfile', () => {
      const profile: UserProfile = {
        id: 'profile123',
        username: 'profileuser',
        email: 'profile@example.com',
        provider: 'microsoft'
      };

      const user = User.fromProfile(profile);
      
      expect(user.username).toBe(profile.username);
      expect(user.email).toBe(profile.email);
      expect(user.provider).toBe(profile.provider);
      expect(user.providerId).toBe(profile.id);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('fromDatabaseRow', () => {
    it('should create a user from database row', () => {
      const row = {
        id: 'db-id',
        username: 'dbuser',
        email: 'db@example.com',
        provider: 'github',
        provider_id: 'github456',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-02T00:00:00.000Z'
      };

      const user = User.fromDatabaseRow(row);
      
      expect(user.id).toBe(row.id);
      expect(user.username).toBe(row.username);
      expect(user.email).toBe(row.email);
      expect(user.provider).toBe(row.provider);
      expect(user.providerId).toBe(row.provider_id);
      expect(user.createdAt).toEqual(new Date(row.created_at));
      expect(user.updatedAt).toEqual(new Date(row.updated_at));
    });
  });

  describe('Validation', () => {
    it('should validate a valid user', () => {
      const user = new User({
        username: 'validuser',
        email: 'valid@example.com',
        provider: 'github',
        providerId: 'github123'
      });

      const errors = user.validate();
      expect(errors).toHaveLength(0);
      expect(user.isValid()).toBe(true);
    });

    it('should return error for missing username', () => {
      const user = new User({
        email: 'valid@example.com',
        provider: 'github',
        providerId: 'github123'
      });

      const errors = user.validate();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(errors[0]?.message).toBe('Username is required');
      expect(user.isValid()).toBe(false);
    });

    it('should return error for empty username', () => {
      const user = new User({
        username: '   ',
        email: 'valid@example.com',
        provider: 'github',
        providerId: 'github123'
      });

      const errors = user.validate();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(errors[0]?.message).toBe('Username is required');
    });

    it('should return error for invalid email', () => {
      const user = new User({
        username: 'validuser',
        email: 'invalid-email',
        provider: 'github',
        providerId: 'github123'
      });

      const errors = user.validate();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(errors[0]?.message).toBe('Valid email is required');
    });

    it('should return error for missing email', () => {
      const user = new User({
        username: 'validuser',
        provider: 'github',
        providerId: 'github123'
      });

      const errors = user.validate();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(errors[0]?.message).toBe('Valid email is required');
    });

    it('should return error for invalid provider', () => {
      const user = new User({
        username: 'validuser',
        email: 'valid@example.com',
        provider: 'invalid-provider',
        providerId: 'provider123'
      });

      const errors = user.validate();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(errors[0]?.message).toBe('Valid provider is required (microsoft or github)');
    });

    it('should return error for missing providerId', () => {
      const user = new User({
        username: 'validuser',
        email: 'valid@example.com',
        provider: 'github'
      });

      const errors = user.validate();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(errors[0]?.message).toBe('Provider ID is required');
    });

    it('should return multiple errors for multiple invalid fields', () => {
      const user = new User({
        email: 'invalid-email',
        provider: 'invalid-provider'
      });

      const errors = user.validate();
      expect(errors).toHaveLength(4); // username, email, provider, providerId
    });
  });

  describe('update', () => {
    it('should update user fields and updatedAt timestamp', () => {
      const user = new User({
        username: 'olduser',
        email: 'old@example.com'
      });

      const originalUpdatedAt = user.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        user.update({
          username: 'newuser',
          email: 'new@example.com'
        });

        expect(user.username).toBe('newuser');
        expect(user.email).toBe('new@example.com');
        expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      }, 1);
    });

    it('should only update provided fields', () => {
      const user = new User({
        username: 'originaluser',
        email: 'original@example.com',
        provider: 'github'
      });

      user.update({ username: 'updateduser' });

      expect(user.username).toBe('updateduser');
      expect(user.email).toBe('original@example.com');
      expect(user.provider).toBe('github');
    });
  });

  describe('toDatabaseRow', () => {
    it('should convert to database row format', () => {
      const user = new User({
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github',
        providerId: 'github123',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02')
      });

      const row = user.toDatabaseRow();
      
      expect(row.id).toBe(user.id);
      expect(row.username).toBe(user.username);
      expect(row.email).toBe(user.email);
      expect(row.provider).toBe(user.provider);
      expect(row.provider_id).toBe(user.providerId);
      expect(row.created_at).toBe(user.createdAt.toISOString());
      expect(row.updated_at).toBe(user.updatedAt.toISOString());
    });
  });

  describe('toJSON', () => {
    it('should convert to plain object', () => {
      const userData = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github',
        providerId: 'github123',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02')
      };

      const user = new User(userData);
      const json = user.toJSON();
      
      expect(json).toEqual(userData);
    });
  });
});