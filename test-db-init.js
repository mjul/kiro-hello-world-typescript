const { database } = require('./dist/database/database');

async function testDatabase() {
  try {
    console.log('Testing database initialization...');
    await database.initialize();
    
    const db = database.getConnection();
    
    // Test inserting a user
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, provider, provider_id) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertUser.run('test-user-1', 'testuser', 'test@example.com', 'github', 'github123');
    console.log('User inserted successfully');
    
    // Test reading the user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('test-user-1');
    console.log('User retrieved:', user);
    
    // Test inserting a session
    const insertSession = db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at) 
      VALUES (?, ?, datetime('now', '+1 day'))
    `);
    
    insertSession.run('test-session-1', 'test-user-1');
    console.log('Session inserted successfully');
    
    // Test reading the session
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get('test-session-1');
    console.log('Session retrieved:', session);
    
    console.log('Database test completed successfully!');
    
    await database.close();
  } catch (error) {
    console.error('Database test failed:', error);
    process.exit(1);
  }
}

testDatabase();