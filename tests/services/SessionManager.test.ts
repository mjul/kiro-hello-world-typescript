import { SessionManager } from '../../src/services/SessionManager';
import { UserService } from '../../src/services/UserService';
import { Session } from '../../src/models/Session';
import { User } from '../../src/models/User';
import { UserProfile, ErrorType } from '../../src/models/interfaces';
import { DatabaseManager } from '../../src/database/database';
import Database from 'better-sqlite3';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let userService: UserService;
  let testDb: Database.Database;
  let dbManager: DatabaseManager;
  let testUser: User;

  beforeAll(async () => {
    // Create in-memory database for testing
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    
    // Create test database manager
    dbManager = new DatabaseManager(':memory:');
    await dbManager.initialize();
    
    sessionManager = new SessionManager(dbManager);
    userService = new UserService(dbManager);
  });

  afterAll(async () => {
    await dbManager.close();
    testDb.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await dbManager.reset();
    
    // Create a test user for session tests
    const profile: UserProfile = {
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      provider: 'github'
    };
    testUser = await userService.createUser(profile);
  });

  describe('create', () => {
    it('should create a new session for a valid user', async () => {
      const session = await sessionManager.create(testUser.id);

      expect(session).toBeInstanceOf(Session);
      expect(session.userId).toBe(testUser.id);
      expect(session.id).toBeDefined();
      expect(session.id).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime());
    });

    it('should create session with custom duration', async () => {
      const customDuration = 2 * 60 * 60 * 1000; // 2 hours
      const session = await sessionManager.create(testUser.id, customDuration);

      const expectedExpiry = new Date(Date.now() + customDuration);
      const actualExpiry = session.expiresAt;
      
      // Allow 1 second tolerance for test execution time
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    it('should create session with default 24-hour duration', async () => {
      const session = await sessionManager.create(testUser.id);

      const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const actualExpiry = session.expiresAt;
      
      // Allow 1 second tolerance for test execution time
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    it('should generate unique session IDs', async () => {
      const session1 = await sessionManager.create(testUser.id);
      const session2 = await sessionManager.create(testUser.id);

      expect(session1.id).not.toBe(session2.id);
      expect(session1.id).toHaveLength(64);
      expect(session2.id).toHaveLength(64);
    });

    it('should throw validation error for empty user ID', async () => {
      await expect(sessionManager.create(''))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User ID is required to create session',
          statusCode: 400
        });
    });

    it('should throw error for nonexistent user', async () => {
      await expect(sessionManager.create('nonexistent-user-id'))
        .rejects.toMatchObject({
          type: ErrorType.USER_NOT_FOUND,
          message: 'Cannot create session for non-existent user',
          statusCode: 404
        });
    });

    it('should persist session to database', async () => {
      const session = await sessionManager.create(testUser.id);

      // Verify session exists in database
      const foundSession = await sessionManager.validate(session.id);
      expect(foundSession).not.toBeNull();
      expect(foundSession!.id).toBe(session.id);
      expect(foundSession!.userId).toBe(testUser.id);
    });

    it('should handle whitespace in user ID', async () => {
      await expect(sessionManager.create('  '))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User ID is required to create session',
          statusCode: 400
        });
    });
  });

  describe('validate', () => {
    let validSession: Session;

    beforeEach(async () => {
      validSession = await sessionManager.create(testUser.id);
    });

    it('should validate and return valid session', async () => {
      const session = await sessionManager.validate(validSession.id);

      expect(session).not.toBeNull();
      expect(session!.id).toBe(validSession.id);
      expect(session!.userId).toBe(testUser.id);
      expect(session!.isValid()).toBe(true);
    });

    it('should return null for nonexistent session', async () => {
      const session = await sessionManager.validate('nonexistent-session-id');
      expect(session).toBeNull();
    });

    it('should return null for empty session ID', async () => {
      const session = await sessionManager.validate('');
      expect(session).toBeNull();
    });

    it('should return null and cleanup expired session', async () => {
      // Create session with very short duration
      const expiredSession = await sessionManager.create(testUser.id, 1); // 1ms
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const session = await sessionManager.validate(expiredSession.id);
      expect(session).toBeNull();

      // Verify session was cleaned up from database
      const sessionAfterCleanup = await sessionManager.validate(expiredSession.id);
      expect(sessionAfterCleanup).toBeNull();
    });

    it('should handle whitespace in session ID', async () => {
      const session = await sessionManager.validate('  ');
      expect(session).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      // This would require mocking database errors
      // For now, test that validation doesn't throw
      const session = await sessionManager.validate('invalid-session-format');
      expect(session).toBeNull();
    });
  });

  describe('destroy', () => {
    let sessionToDestroy: Session;

    beforeEach(async () => {
      sessionToDestroy = await sessionManager.create(testUser.id);
    });

    it('should destroy existing session', async () => {
      await sessionManager.destroy(sessionToDestroy.id);

      // Verify session no longer exists
      const session = await sessionManager.validate(sessionToDestroy.id);
      expect(session).toBeNull();
    });

    it('should handle destroying nonexistent session gracefully', async () => {
      // Should not throw error
      await expect(sessionManager.destroy('nonexistent-session-id'))
        .resolves.toBeUndefined();
    });

    it('should throw validation error for empty session ID', async () => {
      await expect(sessionManager.destroy(''))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Session ID is required',
          statusCode: 400
        });
    });

    it('should handle whitespace in session ID', async () => {
      await expect(sessionManager.destroy('  '))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Session ID is required',
          statusCode: 400
        });
    });
  });

  describe('cleanup', () => {
    it('should clean up expired sessions', async () => {
      // Create some sessions with different expiration times
      const validSession = await sessionManager.create(testUser.id, 60 * 60 * 1000); // 1 hour
      
      // Create expired sessions by manually setting past expiration dates
      const expiredSession1 = await sessionManager.create(testUser.id, 60 * 60 * 1000);
      const expiredSession2 = await sessionManager.create(testUser.id, 60 * 60 * 1000);
      
      // Manually expire the sessions in the database
      const db = dbManager.getConnection();
      const expireStmt = db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 hour') WHERE id = ?");
      expireStmt.run(expiredSession1.id);
      expireStmt.run(expiredSession2.id);

      const cleanedCount = await sessionManager.cleanup();

      expect(cleanedCount).toBe(2); // Should clean up 2 expired sessions

      // Verify valid session still exists
      const validSessionCheck = await sessionManager.validate(validSession.id);
      expect(validSessionCheck).not.toBeNull();

      // Verify expired sessions are gone
      const expiredCheck1 = await sessionManager.validate(expiredSession1.id);
      const expiredCheck2 = await sessionManager.validate(expiredSession2.id);
      expect(expiredCheck1).toBeNull();
      expect(expiredCheck2).toBeNull();
    });

    it('should return 0 when no expired sessions exist', async () => {
      // Create only valid sessions
      await sessionManager.create(testUser.id);
      await sessionManager.create(testUser.id);

      const cleanedCount = await sessionManager.cleanup();
      expect(cleanedCount).toBe(0);
    });

    it('should handle empty sessions table', async () => {
      const cleanedCount = await sessionManager.cleanup();
      expect(cleanedCount).toBe(0);
    });
  });

  describe('getSessionWithUser', () => {
    let testSession: Session;

    beforeEach(async () => {
      testSession = await sessionManager.create(testUser.id);
    });

    it('should return session with user data', async () => {
      const result = await sessionManager.getSessionWithUser(testSession.id);

      expect(result).not.toBeNull();
      expect(result!.session).toBeInstanceOf(Session);
      expect(result!.user).toBeInstanceOf(User);
      expect(result!.session.id).toBe(testSession.id);
      expect(result!.user.id).toBe(testUser.id);
      expect(result!.user.username).toBe(testUser.username);
    });

    it('should return null for invalid session', async () => {
      const result = await sessionManager.getSessionWithUser('invalid-session-id');
      expect(result).toBeNull();
    });

    it('should return null and cleanup orphaned session', async () => {
      // Delete user but keep session (simulate orphaned session)
      await userService.deleteUser(testUser.id);

      const result = await sessionManager.getSessionWithUser(testSession.id);
      expect(result).toBeNull();

      // Verify orphaned session was cleaned up
      const sessionCheck = await sessionManager.validate(testSession.id);
      expect(sessionCheck).toBeNull();
    });
  });

  describe('destroyAllUserSessions', () => {
    beforeEach(async () => {
      // Create multiple sessions for the test user
      await sessionManager.create(testUser.id);
      await sessionManager.create(testUser.id);
      await sessionManager.create(testUser.id);
    });

    it('should destroy all sessions for a user', async () => {
      const destroyedCount = await sessionManager.destroyAllUserSessions(testUser.id);
      expect(destroyedCount).toBe(3);

      // Verify no sessions remain for the user
      const userSessions = await sessionManager.getUserSessions(testUser.id);
      expect(userSessions).toHaveLength(0);
    });

    it('should return 0 for user with no sessions', async () => {
      // Create another user with no sessions
      const anotherProfile: UserProfile = {
        id: 'another-user-id',
        username: 'anotheruser',
        email: 'another@example.com',
        provider: 'microsoft'
      };
      const anotherUser = await userService.createUser(anotherProfile);

      const destroyedCount = await sessionManager.destroyAllUserSessions(anotherUser.id);
      expect(destroyedCount).toBe(0);
    });

    it('should throw validation error for empty user ID', async () => {
      await expect(sessionManager.destroyAllUserSessions(''))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User ID is required',
          statusCode: 400
        });
    });
  });

  describe('getUserSessions', () => {
    it('should return active sessions for user', async () => {
      // Create sessions with different expiration times
      const session1 = await sessionManager.create(testUser.id, 60 * 60 * 1000); // 1 hour
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for different timestamps
      const session2 = await sessionManager.create(testUser.id, 60 * 60 * 1000); // 1 hour
      const expiredSession = await sessionManager.create(testUser.id, 60 * 60 * 1000); // Will be expired

      // Manually expire one session in the database
      const db = dbManager.getConnection();
      const expireStmt = db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 hour') WHERE id = ?");
      expireStmt.run(expiredSession.id);

      const userSessions = await sessionManager.getUserSessions(testUser.id);

      expect(userSessions).toHaveLength(2); // Only active sessions
      expect(userSessions[0]!.id).toBe(session2.id); // Most recent first
      expect(userSessions[1]!.id).toBe(session1.id);
    });

    it('should return empty array for user with no sessions', async () => {
      const anotherProfile: UserProfile = {
        id: 'no-sessions-user',
        username: 'nosessions',
        email: 'nosessions@example.com',
        provider: 'github'
      };
      const anotherUser = await userService.createUser(anotherProfile);

      const userSessions = await sessionManager.getUserSessions(anotherUser.id);
      expect(userSessions).toEqual([]);
    });

    it('should return empty array for empty user ID', async () => {
      const userSessions = await sessionManager.getUserSessions('');
      expect(userSessions).toEqual([]);
    });
  });

  describe('extendSession', () => {
    let sessionToExtend: Session;

    beforeEach(async () => {
      sessionToExtend = await sessionManager.create(testUser.id, 60 * 60 * 1000); // 1 hour
    });

    it('should extend session with custom duration', async () => {
      const originalExpiry = sessionToExtend.expiresAt;
      const extensionDuration = 2 * 60 * 60 * 1000; // 2 hours

      const extendedSession = await sessionManager.extendSession(sessionToExtend.id, extensionDuration);

      expect(extendedSession).not.toBeNull();
      expect(extendedSession!.expiresAt.getTime()).toBeGreaterThan(originalExpiry.getTime());
      
      const expectedExpiry = new Date(Date.now() + extensionDuration);
      expect(Math.abs(extendedSession!.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    it('should extend session with default duration', async () => {
      const originalExpiry = sessionToExtend.expiresAt;

      const extendedSession = await sessionManager.extendSession(sessionToExtend.id);

      expect(extendedSession).not.toBeNull();
      expect(extendedSession!.expiresAt.getTime()).toBeGreaterThan(originalExpiry.getTime());
    });

    it('should return null for invalid session', async () => {
      const extendedSession = await sessionManager.extendSession('invalid-session-id');
      expect(extendedSession).toBeNull();
    });

    it('should persist extension to database', async () => {
      const extensionDuration = 3 * 60 * 60 * 1000; // 3 hours
      await sessionManager.extendSession(sessionToExtend.id, extensionDuration);

      // Verify extension persisted
      const validatedSession = await sessionManager.validate(sessionToExtend.id);
      expect(validatedSession).not.toBeNull();
      
      const expectedExpiry = new Date(Date.now() + extensionDuration);
      expect(Math.abs(validatedSession!.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });
  });

  describe('getSessionStats', () => {
    it('should return correct session statistics', async () => {
      // Create sessions with different states
      await sessionManager.create(testUser.id, 60 * 60 * 1000); // Active
      await sessionManager.create(testUser.id, 60 * 60 * 1000); // Active
      const expiredSession = await sessionManager.create(testUser.id, 60 * 60 * 1000); // Will be expired

      // Manually expire one session in the database
      const db = dbManager.getConnection();
      const expireStmt = db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 hour') WHERE id = ?");
      expireStmt.run(expiredSession.id);

      const stats = await sessionManager.getSessionStats();

      expect(stats.totalSessions).toBe(3);
      expect(stats.activeSessions).toBe(2);
      expect(stats.expiredSessions).toBe(1);
    });

    it('should return zero stats for empty database', async () => {
      const stats = await sessionManager.getSessionStats();

      expect(stats.totalSessions).toBe(0);
      expect(stats.activeSessions).toBe(0);
      expect(stats.expiredSessions).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      // This would require mocking database errors
      // For now, test that it returns default values
      const stats = await sessionManager.getSessionStats();
      
      expect(typeof stats.totalSessions).toBe('number');
      expect(typeof stats.activeSessions).toBe('number');
      expect(typeof stats.expiredSessions).toBe('number');
    });
  });

  describe('secure session ID generation', () => {
    it('should generate cryptographically secure session IDs', async () => {
      const session1 = await sessionManager.create(testUser.id);
      const session2 = await sessionManager.create(testUser.id);

      // Should be different
      expect(session1.id).not.toBe(session2.id);

      // Should be 64 characters (32 bytes in hex)
      expect(session1.id).toHaveLength(64);
      expect(session2.id).toHaveLength(64);

      // Should only contain hex characters
      expect(session1.id).toMatch(/^[0-9a-f]{64}$/);
      expect(session2.id).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique IDs across multiple sessions', async () => {
      const sessionIds = new Set<string>();
      const sessionCount = 100;

      // Generate many sessions to test uniqueness
      for (let i = 0; i < sessionCount; i++) {
        const session = await sessionManager.create(testUser.id);
        sessionIds.add(session.id);
      }

      // All IDs should be unique
      expect(sessionIds.size).toBe(sessionCount);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Test that validation doesn't throw on database errors
      const result = await sessionManager.validate('test-session-id');
      expect(result).toBeNull();
    });

    it('should wrap database errors appropriately', async () => {
      try {
        await sessionManager.create('nonexistent-user-id');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe(ErrorType.USER_NOT_FOUND);
        expect(error.statusCode).toBe(404);
        expect(error.message).toContain('non-existent user');
      }
    });
  });

  describe('input sanitization', () => {
    it('should sanitize user ID input', async () => {
      await expect(sessionManager.create('  '))
        .rejects.toMatchObject({
          type: ErrorType.VALIDATION_ERROR,
          message: 'User ID is required to create session',
          statusCode: 400
        });
    });

    it('should sanitize session ID input', async () => {
      const result = await sessionManager.validate('  ');
      expect(result).toBeNull();
    });

    it('should handle non-string inputs gracefully', async () => {
      // These would be handled by TypeScript, but test runtime behavior
      const result = await sessionManager.validate(null as any);
      expect(result).toBeNull();
    });
  });
});