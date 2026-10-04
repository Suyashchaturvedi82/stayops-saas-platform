const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

function getPoolConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    return {
      host: parsed.hostname,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      port: parsed.port ? Number(parsed.port) : 3306,
      waitForConnections: true,
      connectionLimit: Number.parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
    };
  }

  return {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: Number.parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

const pool = mysql.createPool(getPoolConfig());

// Do not terminate the whole API process when MySQL is temporarily unavailable.
// The health endpoint reports the degraded state while requests receive normal errors.
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (err) {
    console.error('⚠️ Database connection unavailable:', err.message);
  }
})();

module.exports = pool;
