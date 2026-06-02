// ============================================================
//  KRYPT — Supabase тохиргоо
//
//  Доорх 2 утгыг ӨӨРИЙН Supabase project-ийн утгаар солино уу.
//  Олох газар: Supabase Dashboard → Project Settings → Data API
//    • Project URL          → SUPABASE_URL
//    • Project API Keys → anon public → SUPABASE_ANON_KEY
//
//  anon key нь нийтэд харагдахад АЮУЛГҮЙ (RLS хамгаалдаг).
// ============================================================

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
