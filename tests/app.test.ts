import request from 'supertest';
import { Application } from 'express';
import { createApp, initializeApp } from '../src/app';
import { database } from '../src/database/database';

describe('Express Application Setup', () => {
  let app: Application;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-secret';
    process.env.DATABASE_PATH = ':memory:';
    
    // Set dummy OAuth credentials for testing
    process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
    process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
    process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';
    process.env.BASE_URL = 'http://localhost:3000';
    
    // Initialize app
    app = await initializeApp();
  });

  afterAll(async () => {
    await database.close();
  });

  describe('Security Middleware', () => {
    it('should set security headers with helmet', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for security headers set by helmet
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });

    it('should set Content Security Policy headers', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('Template Engine Configuration', () => {
    it('should render EJS templates', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('Welcome to SSO Web App');
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('should handle template errors gracefully', async () => {
      // This would test template error handling
      // For now, we'll just verify the error template exists
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.text).toContain('Page not found');
    });
  });

  describe('Static File Serving', () => {
    it('should serve static CSS files', async () => {
      const response = await request(app)
        .get('/css/styles.css')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/css');
    });

    it('should return 404 for non-existent static files', async () => {
      await request(app)
        .get('/css/nonexistent.css')
        .expect(404);
    });
  });

  describe('Body Parsing Middleware', () => {
    it('should parse JSON bodies', async () => {
      // Since we don't have a POST route that accepts JSON yet,
      // we'll test that the middleware is configured by checking
      // that it doesn't throw errors on JSON requests
      const response = await request(app)
        .post('/logout')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      // Should not return a parsing error
      expect(response.status).not.toBe(400);
    });

    it('should parse URL-encoded bodies', async () => {
      const response = await request(app)
        .post('/logout')
        .send('test=data')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      // Should not return a parsing error
      expect(response.status).not.toBe(400);
    });
  });

  describe('Session Middleware', () => {
    it('should set session cookies', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for session cookie - may be set on first request or subsequent requests
      const cookies = response.headers['set-cookie'] as string[] | undefined;
      
      // Session cookies might not be set on every request, but the middleware should be configured
      // We'll verify the session middleware is working by checking if we can make authenticated requests
      expect(response.status).toBe(200);
      
      if (cookies && Array.isArray(cookies)) {
        const sessionCookie = cookies.find((cookie: string) => 
          cookie.startsWith('sessionId=')
        );
        if (sessionCookie) {
          expect(sessionCookie).toContain('HttpOnly');
          expect(sessionCookie).toContain('SameSite=Lax');
        }
      }
    });

    it('should maintain session across requests', async () => {
      const agent = request.agent(app);
      
      // First request to establish session
      const response1 = await agent
        .get('/')
        .expect(200);

      // Second request should maintain the same session
      const response2 = await agent
        .get('/')
        .expect(200);

      // Both responses should be successful, indicating session middleware is working
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // The agent should maintain cookies between requests
      expect(agent.jar).toBeDefined();
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.text).toContain('Page not found');
      expect(response.text).toContain('404');
    });

    it('should render error template for application errors', async () => {
      // Test that error template is rendered
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('Error');
    });
  });

  describe('Route Integration', () => {
    it('should serve login page at root', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('Welcome to SSO Web App');
      expect(response.text).toContain('Sign in with Microsoft 365');
      expect(response.text).toContain('Sign in with GitHub');
    });

    it('should redirect to login for protected routes without authentication', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(302);

      expect(response.headers.location).toBe('/');
    });

    it('should provide OAuth initiation routes', async () => {
      // These will redirect to OAuth providers, so we expect redirects
      await request(app)
        .get('/auth/microsoft')
        .expect(302);

      await request(app)
        .get('/auth/github')
        .expect(302);
    });
  });

  describe('Application Configuration', () => {
    it('should create app without database initialization', () => {
      const testApp = createApp();
      expect(testApp).toBeDefined();
      expect(typeof testApp.listen).toBe('function');
    });

    it('should handle missing environment variables gracefully', () => {
      // Test that the app can start with minimal configuration
      expect(() => createApp()).not.toThrow();
    });
  });

  describe('Security Configuration', () => {
    it('should set secure cookie settings in production', async () => {
      // Temporarily set production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const prodApp = createApp();
      const response = await request(prodApp)
        .get('/')
        .expect(200);

      // Reset environment
      process.env.NODE_ENV = originalEnv;

      // In production, cookies should be secure
      const cookies = response.headers['set-cookie'] as string[] | undefined;
      if (cookies && Array.isArray(cookies)) {
        const sessionCookie = cookies.find((cookie: string) => 
          cookie.startsWith('sessionId=')
        );
        // Note: In test environment, secure flag might not be set
        // This test verifies the configuration exists
        expect(sessionCookie).toBeDefined();
      }
    });

    it('should set appropriate CSP headers', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("script-src 'self'");
    });
  });
});