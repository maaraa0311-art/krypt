-- ============================================================
--  KRYPT — PostgreSQL бүтэц (өөрийн сервер)
--  `npm run init-db` ажиллуулахад автоматаар хэрэгжинэ.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── USERS ──────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  full_name     text,
  phone         text,
  company       text,
  role          text not null default 'customer' check (role in ('customer','admin')),
  created_at    timestamptz not null default now()
);

-- ── ORDERS ─────────────────────────────────────────────────
create table if not exists orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  project_type text not null,
  budget       text,
  title        text,
  message      text,
  status       text not null default 'new'
               check (status in ('new','review','in_progress','delivered','cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists orders_user_idx   on orders(user_id);
create index if not exists orders_status_idx on orders(status);

-- ============================================================
--  Хамгийн анхны бүртгүүлсэн хэрэглэгч автоматаар АДМИН болно
--  (index.js доторх логикоор). Гараар админ болгох бол:
--
--    update users set role = 'admin' where email = 'maaraa0311@gmail.com';
-- ============================================================
