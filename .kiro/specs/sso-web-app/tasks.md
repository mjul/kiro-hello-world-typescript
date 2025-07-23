# Implementation Plan

- [x] 1. Set up project structure and dependencies





  - Initialize TypeScript Node.js project with package.json
  - Install core dependencies: express, typescript, better-sqlite3, ejs, passport, express-session
  - Install OAuth dependencies: passport-microsoft, passport-github2
  - Install dev dependencies: @types/node, @types/express, nodemon, jest, @types/jest
  - Create basic directory structure: src/, templates/, public/, tests/
  - Configure TypeScript with tsconfig.json
  - _Requirements: 5.5_

- [x] 2. Create database schema and connection utilities





  - Implement SQLite database initialization with schema creation
  - Create database connection utility with proper error handling
  - Write database migration logic for users and sessions tables
  - Add database indexes for performance optimization
  - Create unit tests for database utilities
  - _Requirements: 4.1, 4.3_
  
- [x] 3. Implement core data models and interfaces





  - Create TypeScript interfaces for User, Session, UserProfile, and OAuthConfig
  - Implement User model with validation methods
  - Implement Session model with expiration logic
  - Create error types and AppError interface
  - Write unit tests for data models and validation
  - _Requirements: 4.1, 4.2_

- [x] 4. Build User Service for database operations









  - Implement UserService class with CRUD operations
  - Add methods: findByProviderId, createUser, updateUser
  - Implement proper error handling for database operations
  - Add input validation and sanitization
  - Create comprehensive unit tests for UserService
  - _Requirements: 1.6, 4.1, 4.2_

- [x] 5. Create Session Manager for authentication state





  - Implement SessionManager class with session lifecycle methods
  - Add methods: create, validate, destroy, cleanup
  - Implement session expiration and cleanup logic
  - Add secure session ID generation
  - Write unit tests for session management
  - _Requirements: 1.7, 3.1, 4.4_

- [x] 6. Set up OAuth2 configuration and passport strategies





  - Create OAuth configuration management with environment variables
  - Implement Microsoft 365 OAuth2 strategy using passport-microsoft
  - Implement GitHub OAuth2 strategy using passport-github2
  - Configure passport serialization and deserialization
  - Add OAuth2 error handling and state validation
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 7. Build Authentication Service





  - Implement AuthService class with OAuth2 integration
  - Add methods: initializeOAuth, handleMicrosoftCallback, handleGitHubCallback
  - Implement token exchange and user profile extraction
  - Add session creation and validation methods
  - Create unit tests for authentication flows
  - _Requirements: 1.4, 1.5, 1.6, 1.7_

- [x] 8. Create EJS templates for user interface





  - Create login.ejs template with Microsoft 365 and GitHub login buttons
  - Create dashboard.ejs template with user greeting and logout button
  - Create error.ejs template for error handling
  - Add basic CSS styling for templates
  - Implement template error handling
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 5.1, 5.2, 5.3_

- [x] 9. Implement route handlers and middleware





  - Create authentication middleware for protected routes
  - Implement login route handler with template rendering
  - Implement dashboard route handler with user data injection
  - Add OAuth callback route handlers for both providers
  - Implement logout route handler with session cleanup
  - _Requirements: 1.1, 2.4, 3.1, 3.2_

- [x] 10. Set up Express application and middleware stack





  - Configure Express app with security middleware (helmet)
  - Set up session middleware with SQLite store
  - Configure EJS as template engine
  - Add body parsing and static file serving
  - Implement error handling middleware
  - _Requirements: 5.1, 5.4_

- [x] 11. Create application entry point and configuration





  - Implement main application file with server startup
  - Add environment variable configuration loading
  - Implement graceful shutdown handling
  - Add application logging setup
  - Create development and production configurations
  - _Requirements: 4.3_

- [x] 12. Write integration tests for OAuth flows

  - Create integration tests for Microsoft 365 OAuth flow
  - Create integration tests for GitHub OAuth flow
  - Test complete authentication journey from login to dashboard
  - Test session persistence and validation
  - Test logout functionality and session cleanup
  - _Requirements: 1.1, 1.2, 1.3, 1.7, 3.1, 3.2_

- [x] 13. Add comprehensive error handling and validation

  - Implement global error handler middleware
  - Add input validation for all user inputs
  - Create error templates and user-friendly error messages
  - Add logging for security events and errors
  - Test error scenarios and edge cases
  - _Requirements: 2.4, 3.4, 5.4_

- [x] 14. Create end-to-end tests for user journeys





  - Write E2E tests for complete login flow with both providers
  - Test dashboard access and user data display
  - Test logout functionality and session termination
  - Test unauthorized access attempts and redirects
  - Verify template rendering with user data
  - _Requirements: 1.1, 1.7, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.4_

- [x] 15. Add security enhancements and production readiness


  - Implement CSRF protection with state parameter validation
  - Add rate limiting for authentication endpoints
  - Configure secure cookie settings for production
  - Add security headers and content security policy
  - Implement session cleanup job for expired sessions
  - _Requirements: 3.3, 4.4_