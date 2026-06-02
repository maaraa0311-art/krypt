// ============================================================
//  KRYPT — захиалгын портал backend
//  Express + PostgreSQL + JWT + bcrypt
// ============================================================
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ORIGIN = process.env.CORS_ORIGIN || '*';
const VALID_STATUS = ['new', 'review', 'in_progress', 'delivered', 'cancelled'];

if (JWT_SECRET === 'change-me-in-production') {
  console.warn('⚠️  JWT_SECRET тохируулаагүй байна. .env дотор хүчтэй нууц утга оруулна уу.');
}

const app = express();
app.use(cors({ origin: ORIGIN }));
app.use(express.json());

/* ── Туслахууд ──────────────────────────────────────────── */
function signToken(u) {
  return jwt.sign({ sub: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
}
function publicUser(u) {
  return { id: u.id, email: u.email, full_name: u.full_name, phone: u.phone, company: u.company, role: u.role };
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Хүчингүй токен' });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Зөвхөн админ' });
  next();
}
const ORDER_WITH_PROFILE = `
  select o.*, json_build_object(
    'full_name', u.full_name, 'company', u.company, 'phone', u.phone
  ) as profiles
  from orders o join users u on u.id = o.user_id`;

/* ── Эрүүл мэндийн шалгалт ──────────────────────────────── */
app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ── Бүртгүүлэх ─────────────────────────────────────────── */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, phone, company } = req.body;
    const emailNorm = (email || '').trim().toLowerCase();
    if (!emailNorm || !password) return res.status(400).json({ error: 'Имэйл болон нууц үг шаардлагатай' });
    if (password.length < 6) return res.status(400).json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт' });

    const exists = await pool.query('select 1 from users where email = $1', [emailNorm]);
    if (exists.rowCount) return res.status(409).json({ error: 'Энэ имэйл аль хэдийн бүртгэлтэй байна' });

    // Анхны хэрэглэгч = админ
    const cnt = await pool.query('select count(*)::int as c from users');
    const role = cnt.rows[0].c === 0 ? 'admin' : 'customer';

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `insert into users (email, password_hash, full_name, phone, company, role)
       values ($1, $2, $3, $4, $5, $6)
       returning id, email, full_name, phone, company, role`,
      [emailNorm, hash, full_name || null, phone || null, company || null, role]
    );
    const user = rows[0];
    res.json({ token: signToken(user), user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

/* ── Нэвтрэх ────────────────────────────────────────────── */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const emailNorm = (email || '').trim().toLowerCase();
    const { rows } = await pool.query('select * from users where email = $1', [emailNorm]);
    if (!rows.length) return res.status(401).json({ error: 'Имэйл эсвэл нууц үг буруу байна' });

    const ok = await bcrypt.compare(password || '', rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Имэйл эсвэл нууц үг буруу байна' });

    const user = publicUser(rows[0]);
    res.json({ token: signToken(user), user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

/* ── Одоогийн хэрэглэгч ─────────────────────────────────── */
app.get('/api/auth/me', auth, async (req, res) => {
  const { rows } = await pool.query(
    'select id, email, full_name, phone, company, role from users where id = $1',
    [req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'Хэрэглэгч олдсонгүй' });
  res.json({ user: rows[0] });
});

/* ── Захиалгууд ─────────────────────────────────────────── */
app.get('/api/orders', auth, async (req, res) => {
  try {
    const all = req.query.all === '1' || req.query.all === 'true';
    if (all && req.user.role !== 'admin') return res.status(403).json({ error: 'Зөвхөн админ' });

    const q = all
      ? `${ORDER_WITH_PROFILE} order by o.created_at desc`
      : `${ORDER_WITH_PROFILE} where o.user_id = $1 order by o.created_at desc`;
    const params = all ? [] : [req.user.sub];
    const { rows } = await pool.query(q, params);
    res.json({ orders: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

/* ── Шинэ захиалга ──────────────────────────────────────── */
app.post('/api/orders', auth, async (req, res) => {
  try {
    const { title, project_type, budget, message } = req.body;
    if (!project_type) return res.status(400).json({ error: 'Төслийн төрөл шаардлагатай' });
    const { rows } = await pool.query(
      `insert into orders (user_id, title, project_type, budget, message)
       values ($1, $2, $3, $4, $5) returning *`,
      [req.user.sub, title || null, project_type, budget || null, message || null]
    );
    res.json({ order: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

/* ── Статус шинэчлэх (зөвхөн админ) ─────────────────────── */
app.patch('/api/orders/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Буруу статус' });
    const { rows } = await pool.query(
      'update orders set status = $1, updated_at = now() where id = $2 returning *',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Захиалга олдсонгүй' });
    res.json({ order: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Серверийн алдаа' });
  }
});

app.listen(PORT, () => {
  console.log(`✓ KRYPT API → http://localhost:${PORT}/api`);
});
