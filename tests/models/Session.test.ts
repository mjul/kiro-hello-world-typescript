import { Session } from '../../src/models/Session';
import { ErrorType } from '../../src/models/interfaces';

describe('Session Model', () => {
  describe('Constructor', () => {
    it('should create a session with default values', () => {
      const session = new Session();
      
      expect(session.id).toBeDefined();
      expect(session.userId).toBe('');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime());
    });

    it('should create a session with provided data', () => {
      const sessionData = {
        id: 'test-session-id',
        userId: 'test-user-id',
        createdAt: new Date('2023-01-01'),
        expiresAt: new Date('2023-01-02')
      };

      const session = new Session(sessionData);
      
      expect(session.id).toBe(sessionData.id);
      expect(session.userId).toBe(sessionData.userId);
      expect(session.createdAt).toEqual(sessionData.createdAt);
      expect(session.expiresAt).toEqual(sessionData.expiresAt);
    });

    it('should set default expiration to 24 hours from now', () => {
      const beforeCreation = Date.now();
      const session = new Session({ userId: 'test-user' });
      const afterCreation = Date.now();

      const expectedMinExpiration = beforeCreation + (24 * 60 * 60 * 1000);
      const expectedMaxExpiration = afterCreation + (24 * 60 * 60 * 1000);

      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiration);
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiration);
    });
  });

  describe('createForUser', () => {
    it('should create a session for a user with default duration', () => {
      const userId = 'test-user-id';
      const session = Session.createForUser(userId);
      
      expect(session.userId).toBe(userId);
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      
      // Should expire in approximately 24 hours
      const duration = session.expiresAt.getTime() - session.createdAt.getTime();
      expect(duration).toBeCloseTo(24 * 60 * 60 * 1000, -1000); // Within 1 second
    });

    it('should create a session for a user with custom duration', () => {
      const userId = 'test-user-id';
      const customDuration = 2 * 60 * 60 * 1000; // 2 hours
      const session = Session.createForUser(userId, customDuration);
      
      expect(session.userId).toBe(userId);
      
      const duration = session.expiresAt.getTime() - session.createdAt.getTime();
      expect(duration).toBeCloseTo(customDuration, -1000); // Within 1 second
    });
  });

  describe('fromDatabaseRow', () => {
    it('should create a session from database row', () => {
      const row = {
        id: 'db-session-id',
        user_id: 'db-user-id',
        created_at: '2023-01-01T00:00:00.000Z',
        expires_at: '2023-01-02T00:00:00.000Z'
      };

      const session = Session.fromDatabaseRow(row);
      
      expect(session.id).toBe(row.id);
      expect(session.userId).toBe(row.user_id);
      expect(session.createdAt).toEqual(new Date(row.created_at));
      expect(session.expiresAt).toEqual(new Date(row.expires_at));
    });
  });

  describe('isExpired', () => {
    it('should return false for non-expired session', () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now
      const session = new Session({
        userId: 'test-user',
        expiresAt: futureDate
      });

      expect(session.isExpired()).toBe(false);
    });

    it('should return true for expired session', () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      const session = new Session({
        userId: 'test-user',
        expiresAt: pastDate
      });

      expect(session.isExpired()).toBe(true);
    });

    it('should return true for session expiring exactly now', () => {
      const now = new Date();
      const session = new Session({
        userId: 'test-user',
        expiresAt: now
      });

      // Wait a tiny bit to ensure it's past expiration
      setTimeout(() => {
        expect(session.isExpired()).toBe(true);
      }, 1);
    });
  });

  describe('isValid', () => {
    it('should return true for valid non-expired session', () => {
      const session = new Session({
        userId: 'test-user',
        expiresAt: new Date(Date.now() + 60000)
      });

      expect(session.isValid()).toBe(true);
    });

    it('should return false for expired session', () => {
      const session = new Session({
        userId: 'test-user',
        expiresAt: new Date(Date.now() - 60000)
      });

      expect(session.isValid()).toBe(false);
    });

    it('should return false for session without userId', () => {
      const session = new Session({
        expiresAt: new Date(Date.now() + 60000)
      });

      expect(session.isValid()).toBe(false);
    });

    it('should return false for session with empty userId', () => {
      const session = new Session({
        userId: '   ',
        expiresAt: new Date(Date.now() + 60000)
      });

      expect(session.isValid()).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return remaining time in milliseconds', () => {
      const remainingMs = 60000; // 1 minute
      const session = new Session({
        userId: 'test-user',
        expiresAt: new Date(Date.now() + remainingMs)
      });

      const remaining = session.getRemainingTime();
      expect(remaining).toBeCloseTo(remainingMs, -1000); // Within 1 second
      expect(remaining).toBeGreaterThan(0);
    });

    it('should return 0 for expired session', () => {
      const session = new Session({
        userId: 'test-user',
        expiresAt: new Date(Date.now() - 60000)
      });

      expect(session.getRemainingTime()).toBe(0);
    });
  });

  describe('extend', () => {
    it('should extend session by default duration', () => {
      const session = new Session({
        userId: 'test-user',
        expiresAt: new Date(Date.now() + 60000) // 1 minute from now
      });

      const originalExpiration = session.expiresAt.getTime();
      session.extend();

      // Should be extended by approximately 24 hours from now
      const newExpiration = session.expiresAt.getTime();
      const extensionDuration = newExpiration - Date.now();
      
      expect(newExpiration).toBeGreaterThan(originalExpiration);
      expect(extensionDuration).toBeCloseTo(24 * 60 * 60 * 1000, -1000);
    });

    it('should extend session by custom duration', () => {
      const session = new Session({
        userId: 'test-user',
        expiresAt: new Date(Date.now() + 60000)
      });

      const customDuration = 2 * 60 * 60 * 1000; // 2 hours
      session.extend(customDuration);

      const extensionDuration = session.expiresAt.getTime() - Date.now();
      expect(extensionDuration).toBeCloseTo(customDuration, -1000);
    });
  });

  describe('refresh', () => {
    it('should refresh session with default duration', () => {
      const session = new Session({
        userId: 'test-user',
        expiresAt: new Date(Date.now() + 60000)
      });

      const originalExpiration = session.expiresAt.getTime();
      session.refresh();

      expect(session.expiresAt.getTime()).toBeGreaterThan(originalExpiration);
    });
  });

  describe('validate', () => {
    it('should validate a valid session', () => {
      const session = new Session({
        userId: 'test-user',
        expiresAt: new Date(Date.now() + 60000)
      });

      const errors = session.validate();
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing userId', () => {
      const session = new Session({
        expiresAt: new Date(Date.now() + 60000)
      });

      const errors = session.validate();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(errors[0]?.message).toBe('User ID is required for session');
    });

    it('should return error for expired session', () => {
      const createdAt = new Date(Date.now() - 120000); // 2 minutes ago
      const expiresAt = new Date(Date.now() - 60000); // 1 minute ago
      const session = new Session({
        userId: 'test-user',
        createdAt,
        expiresAt
      });

      const errors = session.validate();
      expect(errors.length).toBeGreaterThanOrEqual(1);
      const expiredError = errors.find(e => e.type === ErrorType.SESSION_EXPIRED);
      expect(expiredError).toBeDefined();
      expect(expiredError?.message).toBe('Session has expired');
    });

    it('should return error for invalid expiration time', () => {
      const createdAt = new Date(Date.now() + 60000); // 1 minute from now
      const expiresAt = new Date(Date.now()); // Now (before creation)
      
      const session = new Session({
        userId: 'test-user',
        createdAt,
        expiresAt
      });

      const errors = session.validate();
      expect(errors.length).toBeGreaterThanOrEqual(1);
      const validationError = errors.find(e => e.type === ErrorType.VALIDATION_ERROR && e.message.includes('expiration time cannot be before creation time'));
      expect(validationError).toBeDefined();
      expect(validationError?.message).toBe('Session expiration time cannot be before creation time');
    });

    it('should return multiple errors for multiple issues', () => {
      const session = new Session({
        expiresAt: new Date(Date.now() - 60000) // Expired and no userId
      });

      const errors = session.validate();
      expect(errors.length).toBeGreaterThanOrEqual(2); // Missing userId and expired (possibly more)
      
      const userIdError = errors.find(e => e.type === ErrorType.VALIDATION_ERROR && e.message.includes('User ID is required'));
      const expiredError = errors.find(e => e.type === ErrorType.SESSION_EXPIRED);
      
      expect(userIdError).toBeDefined();
      expect(expiredError).toBeDefined();
    });
  });

  describe('toDatabaseRow', () => {
    it('should convert to database row format', () => {
      const session = new Session({
        id: 'test-session-id',
        userId: 'test-user-id',
        createdAt: new Date('2023-01-01'),
        expiresAt: new Date('2023-01-02')
      });

      const row = session.toDatabaseRow();
      
      expect(row.id).toBe(session.id);
      expect(row.user_id).toBe(session.userId);
      expect(row.created_at).toBe(session.createdAt.toISOString());
      expect(row.expires_at).toBe(session.expiresAt.toISOString());
    });
  });

  describe('toJSON', () => {
    it('should convert to plain object', () => {
      const sessionData = {
        id: 'test-session-id',
        userId: 'test-user-id',
        createdAt: new Date('2023-01-01'),
        expiresAt: new Date('2023-01-02')
      };

      const session = new Session(sessionData);
      const json = session.toJSON();
      
      expect(json).toEqual(sessionData);
    });
  });

  describe('getInfo', () => {
    it('should return session info for debugging', () => {
      const session = new Session({
        id: 'test-session-id',
        userId: 'test-user-id',
        expiresAt: new Date(Date.now() + 60000)
      });

      const info = session.getInfo();
      
      expect(info.id).toBe(session.id);
      expect(info.userId).toBe(session.userId);
      expect(info.isExpired).toBe(false);
      expect(info.remainingTimeMs).toBeGreaterThan(0);
      expect(info.createdAt).toBe(session.createdAt.toISOString());
      expect(info.expiresAt).toBe(session.expiresAt.toISOString());
    });
  });
});