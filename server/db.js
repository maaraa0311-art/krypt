import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('⚠️  DATABASE_URL тохируулаагүй байна. .env файлаа шалгана уу (.env.example-ийг үзнэ үү).');
}

// PGSSL=true бол SSL-тэй холбоно (Railway, Render, Supabase зэрэгт хэрэгтэй)
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});
