-- ============================================================
--  KRYPT — Supabase өгөгдлийн сангийн бүтэц
--  Supabase Dashboard → SQL Editor → энэ бүхнийг хуулж Run дарна.
-- ============================================================

-- ── PROFILES ───────────────────────────────────────────────
-- Бүртгүүлсэн хэрэглэгч бүрийн нэмэлт мэдээлэл.
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  full_name   text,
  phone       text,
  company     text,
  role        text not null default 'customer' check (role in ('customer','admin')),
  created_at  timestamptz not null default now()
);

-- ── ORDERS ─────────────────────────────────────────────────
-- Захиалга. user_id → profiles(id) (= auth хэрэглэгчийн id).
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  project_type text not null,
  budget       text,
  title        text,
  message      text,
  status       text not null default 'new'
               check (status in ('new','review','in_progress','delivered','cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx  on public.orders(status);

-- ── updated_at автомат шинэчлэх ─────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated on public.orders;
create trigger orders_touch_updated
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- ── Шинэ хэрэглэгч бүртгүүлэхэд profile автоматаар үүсгэх ────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, company)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Админ эсэхийг шалгах (RLS recursion-оос сэргийлэх) ───────
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.orders   enable row level security;

-- PROFILES policies
drop policy if exists "own profile select"  on public.profiles;
drop policy if exists "own profile update"  on public.profiles;
drop policy if exists "admin profile select" on public.profiles;

create policy "own profile select"
  on public.profiles for select using (auth.uid() = id);

create policy "own profile update"
  on public.profiles for update using (auth.uid() = id);

create policy "admin profile select"
  on public.profiles for select using (public.is_admin());

-- ORDERS policies
drop policy if exists "orders select" on public.orders;
drop policy if exists "orders insert" on public.orders;
drop policy if exists "orders admin update" on public.orders;

-- Хэрэглэгч өөрийн захиалгаа, админ бүгдийг хардаг
create policy "orders select"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

-- Хэрэглэгч зөвхөн өөрийн нэр дээр захиалга нэмнэ
create policy "orders insert"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- Зөвхөн админ статус шинэчилнэ
create policy "orders admin update"
  on public.orders for update
  using (public.is_admin());

-- ============================================================
--  АДМИН ХЭРЭГЛЭГЧ ТОХИРУУЛАХ
--  Та эхлээд сайт дээрээс энгийн хэрэглэгчээр бүртгүүлнэ.
--  Дараа нь доорх мөрийг өөрийн имэйлээр солиод Run дарна:
--
--    update public.profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'maaraa0311@gmail.com');
-- ============================================================
