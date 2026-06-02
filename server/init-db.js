// Өгөгдлийн сангийн бүтцийг үүсгэнэ:  npm run init-db
import fs from 'fs';
import { pool } from './db.js';

const sql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

try {
  await pool.query(sql);
  console.log('✓ Өгөгдлийн сан бэлэн боллоо (users, orders).');
} catch (e) {
  console.error('✗ Алдаа:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
