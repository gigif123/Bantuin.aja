-- ============================================================
-- Bantuin.aja - SCHEMA
-- Tempel seluruh isi file ini ke Supabase > SQL Editor > Run
-- ============================================================

-- ---------- 1. SERVICES (katalog layanan) ----------
create table if not exists public.services (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  slug              text unique,
  category          text not null default 'Umum',
  short_description text,
  description       text,
  price             numeric(12,2) not null default 0,
  duration          text,                       -- estimasi, mis. "3-5 hari"
  image_url         text,
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists services_active_idx on public.services (is_active, sort_order);

-- ---------- 2. CUSTOMERS (didata oleh CS, bukan login) ----------
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  whatsapp   text not null,
  email      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customers_whatsapp_key on public.customers (whatsapp);

-- ---------- 3. ADMINS (penanda role admin) ----------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  is_master  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 4. ORDERS ----------
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_code    text not null unique,
  customer_id   uuid references public.customers(id) on delete set null,
  service_id    uuid references public.services(id) on delete set null,
  service_title text not null,                  -- snapshot judul saat pesan
  amount        numeric(12,2) not null default 0,
  deadline      date,
  brief         text,                           -- kebutuhan pelanggan
  status        text not null default 'baru'
                check (status in ('baru','menunggu_pembayaran','diproses','revisi','selesai','dibatalkan')),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_customer_idx on public.orders (customer_id);

-- ---------- 5. PAYMENTS ----------
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  amount     numeric(12,2) not null default 0,
  method     text default 'transfer_bank'
             check (method in ('transfer_bank','e_wallet','qris','tunai','lainnya')),
  status     text not null default 'belum'
             check (status in ('belum','menunggu_konfirmasi','terkonfirmasi','gagal')),
  proof_url  text,
  note       text,
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payments_order_idx on public.payments (order_id);

-- ---------- 6. ORDER UPDATES (riwayat status) ----------
create table if not exists public.order_updates (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  status     text not null,
  note       text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_updates_order_idx on public.order_updates (order_id, created_at desc);

-- ---------- 7. ORDER FILES (lampiran brief/hasil) ----------
create table if not exists public.order_files (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  file_name  text not null,
  file_url   text not null,
  kind       text not null default 'brief' check (kind in ('brief','hasil')),
  created_at timestamptz not null default now()
);

create index if not exists order_files_order_idx on public.order_files (order_id);

-- ============================================================
-- FUNGSI & TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Kode pesanan otomatis: JA-YYMMDD-XXXXX
create or replace function public.generate_order_code()
returns trigger language plpgsql as $$
begin
  if new.order_code is null or new.order_code = '' then
    new.order_code := 'JA-' || to_char(now(), 'YYMMDD') || '-' ||
                      upper(substr(md5(random()::text), 1, 5));
  end if;
  return new;
end;
$$;

drop trigger if exists orders_generate_code on public.orders;
create trigger orders_generate_code before insert on public.orders
  for each row execute function public.generate_order_code();

-- Cek admin (dipakai di RLS)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.services      enable row level security;
alter table public.customers     enable row level security;
alter table public.admins        enable row level security;
alter table public.orders        enable row level security;
alter table public.payments      enable row level security;
alter table public.order_updates enable row level security;
alter table public.order_files   enable row level security;

-- SERVICES: publik hanya lihat yang aktif, admin bebas
drop policy if exists "services public read" on public.services;
create policy "services public read" on public.services
  for select to anon, authenticated using (is_active = true);

drop policy if exists "services admin all" on public.services;
create policy "services admin all" on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- CUSTOMERS: admin saja
drop policy if exists "customers admin all" on public.customers;
create policy "customers admin all" on public.customers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ADMINS: lihat baris sendiri
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ORDERS: admin saja
drop policy if exists "orders admin all" on public.orders;
create policy "orders admin all" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- PAYMENTS: admin saja
drop policy if exists "payments admin all" on public.payments;
create policy "payments admin all" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ORDER UPDATES: admin saja
drop policy if exists "order_updates admin all" on public.order_updates;
create policy "order_updates admin all" on public.order_updates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ORDER FILES: admin saja
drop policy if exists "order_files admin all" on public.order_files;
create policy "order_files admin all" on public.order_files
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- STORAGE BUCKET (lampiran pesanan, privat)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('order-files', 'order-files', false)
on conflict (id) do nothing;

drop policy if exists "order-files admin all" on storage.objects;
create policy "order-files admin all" on storage.objects
  for all to authenticated
  using (bucket_id = 'order-files' and public.is_admin())
  with check (bucket_id = 'order-files' and public.is_admin());
