const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection(process.env.DB_URL || {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 17137,
    ssl: { rejectUnauthorized: false }
  });

  const schemaPath = path.join(__dirname, 'database-schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

  console.log('Running database migration...');
  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (err) {
      if (err.errno === 1050) {
        console.log(`Notice: Table already exists, skipping.`);
      } else if (err.errno === 1061) {
        console.log(`Notice: Index already exists, skipping.`);
      } else {
        throw err;
      }
    }
  }

  console.log('Migration completed successfully!');
  await connection.end();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});