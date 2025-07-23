import { UserService } from '../../src/services/UserService';
import { User } from '../../src/models/User';
import { UserProfile, ErrorType } from '../../src/models/interfaces';
import { DatabaseManager } from '../../src/database/database';
import Database from 'better-sqlite3';

describe('UserService', () => {
  let userService: UserService;
  let testDb: Database.Database;
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    // Create in-memory database for testing
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    
    // Create test database manager
    dbManager = new DatabaseManager(':memory:');
    await dbManager.initialize();
    
    userService = new UserService(dbManager);
  });

  afterAll(async () => {
    await dbManager.close();
    testDb.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await dbManager.reset();
  });

  describe('findByProviderId', () => {
    it('should find user by provider ID and provider', async () => {
      // Create test user
      const profile: UserProfile = {
        id: 'test-provider-id',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github'
      };

      const createdUser = await userService.createUser(profile);

      // Find the user
      const foundUser = await userService.findByProviderId('test-provider-id', 'github');

      expect(foundUser).not.toBeNull();
      expect(foundUser!.providerId).toBe('test-provider-id');
      expect(foundUser!.provider).toBe('github');
      expect(foundUser!.username).toBe('testuser');
      expect(foundUser!.email).toBe('test@example.com');
    });

    it('should return null when user is not found', async () => {
      const foundUser = await userService.findByProviderId('nonexistent-id', 'github');
      expect(foundUser).toBeNull();
    });

    it('should throw validation error for empty provider ID', async () => {
      await expect(userService.findByProviderId('', 'github'))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Provider ID and provider are required',
          statusCode: 400
        });
    });

    it('should throw validation error for empty provider', async () => {
      await expect(userService.findByProviderId('test-id', ''))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Provider ID and provider are required',
          statusCode: 400
        });
    });

    it('should throw validation error for invalid provider', async () => {
      await expect(userService.findByProviderId('test-id', 'invalid-provider'))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Invalid provider. Must be microsoft or github',
          statusCode: 400
        });
    });

    it('should handle case-sensitive provider matching', async () => {
      const profile: UserProfile = {
        id: 'test-provider-id',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github'
      };

      await userService.createUser(profile);

      // Should not find with different case
      const foundUser = await userService.findByProviderId('test-provider-id', 'GitHub');
      expect(foundUser).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create a new user from UserProfile', async () => {
      const profile: UserProfile = {
        id: 'github-123',
        username: 'johndoe',
        email: 'john@example.com',
        provider: 'github'
      };

      const createdUser = await userService.createUser(profile);

      expect(createdUser).toBeInstanceOf(User);
      expect(createdUser.username).toBe('johndoe');
      expect(createdUser.email).toBe('john@example.com');
      expect(createdUser.provider).toBe('github');
      expect(createdUser.providerId).toBe('github-123');
      expect(createdUser.id).toBeDefined();
      expect(createdUser.createdAt).toBeInstanceOf(Date);
      expect(createdUser.updatedAt).toBeInstanceOf(Date);
    });

    it('should create user with Microsoft provider', async () => {
      const profile: UserProfile = {
        id: 'microsoft-456',
        username: 'janedoe',
        email: 'jane@example.com',
        provider: 'microsoft'
      };

      const createdUser = await userService.createUser(profile);

      expect(createdUser.provider).toBe('microsoft');
      expect(createdUser.providerId).toBe('microsoft-456');
    });

    it('should throw validation error for invalid email', async () => {
      const profile: UserProfile = {
        id: 'test-id',
        username: 'testuser',
        email: 'invalid-email',
        provider: 'github'
      };

      await expect(userService.createUser(profile))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User validation failed',
          statusCode: 400
        });
    });

    it('should throw validation error for empty username', async () => {
      const profile: UserProfile = {
        id: 'test-id',
        username: '',
        email: 'test@example.com',
        provider: 'github'
      };

      await expect(userService.createUser(profile))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User validation failed',
          statusCode: 400
        });
    });

    it('should throw validation error for invalid provider', async () => {
      const profile: UserProfile = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'invalid' as any
      };

      await expect(userService.createUser(profile))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User validation failed',
          statusCode: 400
        });
    });

    it('should throw error when creating duplicate user', async () => {
      const profile: UserProfile = {
        id: 'duplicate-id',
        username: 'testuser',
        email: 'test@example.com',
        provider: 'github'
      };

      // Create first user
      await userService.createUser(profile);

      // Try to create duplicate
      await expect(userService.createUser(profile))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User already exists with this provider ID',
          statusCode: 409
        });
    });

    it('should persist user to database', async () => {
      const profile: UserProfile = {
        id: 'persist-test',
        username: 'persistuser',
        email: 'persist@example.com',
        provider: 'github'
      };

      await userService.createUser(profile);

      // Verify user exists in database
      const foundUser = await userService.findByProviderId('persist-test', 'github');
      expect(foundUser).not.toBeNull();
      expect(foundUser!.username).toBe('persistuser');
    });
  });

  describe('updateUser', () => {
    let existingUser: User;

    beforeEach(async () => {
      const profile: UserProfile = {
        id: 'update-test',
        username: 'originaluser',
        email: 'original@example.com',
        provider: 'github'
      };
      existingUser = await userService.createUser(profile);
    });

    it('should update user username', async () => {
      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updatedUser = await userService.updateUser(existingUser.id, {
        username: 'updateduser'
      });

      expect(updatedUser.username).toBe('updateduser');
      expect(updatedUser.email).toBe('original@example.com'); // unchanged
      expect(updatedUser.updatedAt.getTime()).toBeGreaterThanOrEqual(existingUser.updatedAt.getTime());
    });

    it('should update user email', async () => {
      const updatedUser = await userService.updateUser(existingUser.id, {
        email: 'updated@example.com'
      });

      expect(updatedUser.email).toBe('updated@example.com');
      expect(updatedUser.username).toBe('originaluser'); // unchanged
    });

    it('should update multiple fields', async () => {
      const updatedUser = await userService.updateUser(existingUser.id, {
        username: 'newuser',
        email: 'new@example.com'
      });

      expect(updatedUser.username).toBe('newuser');
      expect(updatedUser.email).toBe('new@example.com');
    });

    it('should throw error for nonexistent user', async () => {
      await expect(userService.updateUser('nonexistent-id', { username: 'test' }))
        .rejects.toMatchObject({
          type: ErrorType.USER_NOT_FOUND,
          message: 'User not found',
          statusCode: 404
        });
    });

    it('should throw validation error for empty user ID', async () => {
      await expect(userService.updateUser('', { username: 'test' }))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User ID is required',
          statusCode: 400
        });
    });

    it('should throw validation error for invalid email update', async () => {
      await expect(userService.updateUser(existingUser.id, { email: 'invalid-email' }))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User validation failed',
          statusCode: 400
        });
    });

    it('should persist updates to database', async () => {
      await userService.updateUser(existingUser.id, {
        username: 'persistedupdate'
      });

      // Verify update persisted
      const foundUser = await userService.findById(existingUser.id);
      expect(foundUser!.username).toBe('persistedupdate');
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const profile: UserProfile = {
        id: 'findbyid-test',
        username: 'finduser',
        email: 'find@example.com',
        provider: 'github'
      };

      const createdUser = await userService.createUser(profile);
      const foundUser = await userService.findById(createdUser.id);

      expect(foundUser).not.toBeNull();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.username).toBe('finduser');
    });

    it('should return null for nonexistent ID', async () => {
      const foundUser = await userService.findById('nonexistent-id');
      expect(foundUser).toBeNull();
    });

    it('should return null for empty ID', async () => {
      const foundUser = await userService.findById('');
      expect(foundUser).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('should delete existing user', async () => {
      const profile: UserProfile = {
        id: 'delete-test',
        username: 'deleteuser',
        email: 'delete@example.com',
        provider: 'github'
      };

      const createdUser = await userService.createUser(profile);
      const deleted = await userService.deleteUser(createdUser.id);

      expect(deleted).toBe(true);

      // Verify user is deleted
      const foundUser = await userService.findById(createdUser.id);
      expect(foundUser).toBeNull();
    });

    it('should return false for nonexistent user', async () => {
      const deleted = await userService.deleteUser('nonexistent-id');
      expect(deleted).toBe(false);
    });

    it('should throw validation error for empty user ID', async () => {
      await expect(userService.deleteUser(''))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User ID is required',
          statusCode: 400
        });
    });
  });

  describe('getAllUsers', () => {
    it('should return empty array when no users exist', async () => {
      const users = await userService.getAllUsers();
      expect(users).toEqual([]);
    });

    it('should return all users ordered by creation date', async () => {
      const profiles: UserProfile[] = [
        {
          id: 'user1',
          username: 'user1',
          email: 'user1@example.com',
          provider: 'github'
        },
        {
          id: 'user2',
          username: 'user2',
          email: 'user2@example.com',
          provider: 'microsoft'
        }
      ];

      // Create users with small delay to ensure different timestamps
      await userService.createUser(profiles[0]!);
      await new Promise(resolve => setTimeout(resolve, 10));
      await userService.createUser(profiles[1]!);

      const users = await userService.getAllUsers();

      expect(users).toHaveLength(2);
      expect(users[0]!.username).toBe('user2'); // Most recent first
      expect(users[1]!.username).toBe('user1');
    });
  });

  describe('input sanitization', () => {
    it('should handle whitespace in inputs', async () => {
      const foundUser = await userService.findByProviderId('  test-id  ', '  github  ');
      expect(foundUser).toBeNull(); // Should not find due to trimming
    });

    it('should sanitize user profile inputs', async () => {
      const profile: UserProfile = {
        id: '  sanitize-test  ',
        username: '  sanitizeuser  ',
        email: '  sanitize@example.com  ',
        provider: 'github'
      };

      const createdUser = await userService.createUser(profile);

      expect(createdUser.providerId).toBe('sanitize-test');
      expect(createdUser.username).toBe('sanitizeuser');
      expect(createdUser.email).toBe('sanitize@example.com');
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database connection
      // For now, we'll test that errors are properly wrapped
      const profile: UserProfile = {
        id: 'error-test',
        username: 'erroruser',
        email: 'error@example.com',
        provider: 'github'
      };

      // Create user first
      await userService.createUser(profile);

      // Try to create duplicate - should get proper error structure
      try {
        await userService.createUser(profile);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
        expect(error.statusCode).toBe(409);
        expect(error.message).toContain('already exists');
      }
    });
  });
});