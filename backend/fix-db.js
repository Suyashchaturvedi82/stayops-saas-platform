// Run from the backend folder:  node fix-db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ssl: { rejectUnauthorized: false },
  });

  const [before] = await conn.query('SHOW COLUMNS FROM auth_sessions').catch(() => [[]]);
  console.log('BEFORE:', before.map((c) => c.Field).join(', ') || '(table missing)');

  await conn.query('DROP TABLE IF EXISTS auth_sessions');
  await conn.query(`
    CREATE TABLE auth_sessions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      user_id INT NOT NULL,
      device_id VARCHAR(128) NOT NULL,
      refresh_token_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_auth_session_lookup (tenant_id, user_id, device_id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

  const [after] = await conn.query('SHOW COLUMNS FROM auth_sessions');
  console.log('AFTER:', after.map((c) => c.Field).join(', '));
  await conn.end();
  console.log('DONE - auth_sessions fixed. Now retry onboarding.');
})().catch((e) => {
  console.error('FAILED:', e.code, e.sqlMessage || e.message);
  process.exit(1);
});