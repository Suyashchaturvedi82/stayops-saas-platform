// Run from the backend folder:  node fix-db-2.js
// Applies docs/migrations/*.sql to the Aiven DB. Safe to re-run (skips "already exists" errors).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const FILES = [
  '2026-02-20_saas_multitenant_upgrade.sql',
  '2026-09-30_stayops_upgrade.sql',
  '2026-10-08_phase1_identity_cleanup.sql',
  '2026-10-09_phase2_booking_state_machine.sql',
  '2026-10-09_phase3_public_marketplace.sql',
].map((f) => path.join(__dirname, '..', 'docs', 'migrations', f));

// 1060 dup column, 1061 dup index, 1050 table exists, 1091 can't drop (absent), 1826/1022 dup FK/key
const SKIP = new Set([1060, 1061, 1050, 1091, 1826, 1022]);

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ssl: { rejectUnauthorized: false },
  });

  let ok = 0, skipped = 0, failed = 0;
  for (const file of FILES) {
    if (!fs.existsSync(file)) {
      console.log('MISSING FILE (put the docs folder next to backend):', file);
      failed++;
      continue;
    }
    console.log('\n== ' + path.basename(file));
    // Existing tables use INT ids, so BIGINT foreign keys would be rejected by MySQL.
    const sql = fs.readFileSync(file, 'utf8').replace(/BIGINT/g, 'INT');
    const statements = sql
      .split(';')
      .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
      .filter(Boolean);

    for (const stmt of statements) {
      const label = stmt.replace(/\s+/g, ' ').slice(0, 70);
      try {
        await conn.query(stmt);
        ok++;
        console.log('OK    ', label);
      } catch (e) {
        if (SKIP.has(e.errno)) {
          skipped++;
          console.log('SKIP  ', label, '->', e.code);
        } else {
          failed++;
          console.log('FAIL  ', label, '->', e.code, e.sqlMessage);
        }
      }
    }
  }

  const [cols] = await conn.query(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND column_name = 'tenant_id' ORDER BY table_name`
  );
  console.log('\nTables with tenant_id:', cols.map((c) => c.table_name || c.TABLE_NAME).join(', '));
  console.log(`\nSummary: ok=${ok} skipped=${skipped} failed=${failed}`);
  await conn.end();
})().catch((e) => {
  console.error('FATAL:', e.code, e.sqlMessage || e.message);
  process.exit(1);
});