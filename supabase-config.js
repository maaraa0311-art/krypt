// ============================================================
//  KRYPT — Backend тохиргоо
//
//  Backend сонгох дараалал (backend.js дотор):
//    1. API_BASE_URL  → Өөрийн Node.js + PostgreSQL сервер
//    2. Supabase      → Хостлогдсон PostgreSQL
//    3. Аль нь ч биш  → localStorage demo (тохиргоо хэрэггүй)
// ============================================================

// ── 1. ӨӨРИЙН POSTGRESQL СЕРВЕР (Node API) ──────────────────
//  server/ хавтсыг ажиллуулаад доорх хаягийг тааруулна.
//  Локалд: 'http://localhost:4000/api'
//  Хостинг дээр: 'https://api.tani-domain.mn/api'
//  Хоосон үлдээвэл demo горимд шилжинэ.
const API_BASE_URL = 'http://localhost:4000/api';
const API_READY = !!API_BASE_URL && API_BASE_URL.startsWith('http');

// ── 2. SUPABASE (заавал биш, нөөц хувилбар) ─────────────────
//  Supabase ашиглах бол API_BASE_URL-г хоосон болгоод доош бөглө.
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';

// ── Тохиргоо бэлэн эсэхийг шалгах ───────────────────────────
const SUPABASE_READY =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR-PROJECT') &&
  !!SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes('YOUR-ANON');

// ── Клиент үүсгэх ───────────────────────────────────────────
const sb = (SUPABASE_READY && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ── Захиалгын статусын монгол нэр + дараалал ────────────────
const ORDER_STATUS = {
  new:         { label: 'Шинэ',              step: 0, color: '#00dcff' },
  review:      { label: 'Хянаж байна',       step: 1, color: '#fbbf24' },
  in_progress: { label: 'Хийгдэж байна',     step: 2, color: '#c084fc' },
  delivered:   { label: 'Хүлээлгэн өгсөн',   step: 3, color: '#4ade80' },
  cancelled:   { label: 'Цуцлагдсан',        step: -1, color: '#ff4da6' },
};
const ORDER_FLOW = ['new', 'review', 'in_progress', 'delivered'];
