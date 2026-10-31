-- ============================================================
-- Bantuin.aja - KELOLA ADMIN DARI DASHBOARD
-- Jalankan SETELAH database/01_schema.sql dan 03_promote_admin.sql.
--
-- Fitur:
--   - Menandai satu admin sebagai "master"
--   - Admin master bisa melihat daftar admin
--   - Admin master bisa memberi akses admin ke akun Auth yang sudah ada
--   - Admin master bisa mencabut akses admin (akun Auth tetap ada)
--
-- Catatan: akun Auth baru tetap dibuat di
-- Supabase > Authentication > Users > Add user
-- (centang Auto Confirm User), lalu tambahkan aksesnya dari dashboard.
-- ============================================================

alter table public.admins
  add column if not exists is_master boolean not null default false;

-- Tandai email admin master. Ganti email di sini bila perlu.
update public.admins a
set is_master = true
from auth.users u
where u.id = a.user_id
  and lower(u.email) = lower('gif20zaril@gmail.com');

-- Apakah user yang sedang login adalah admin master?
create or replace function public.is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where user_id = auth.uid()
      and is_master = true
  );
$$;

revoke all on function public.is_master_admin() from public;
grant execute on function public.is_master_admin() to authenticated;

-- Daftar admin (hanya terlihat oleh admin master)
create or replace function public.list_admins()
returns table (
  user_id    uuid,
  email      text,
  full_name  text,
  is_master  boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.user_id,
    u.email::text,
    a.full_name,
    a.is_master,
    a.created_at
  from public.admins a
  join auth.users u on u.id = a.user_id
  where public.is_master_admin()
  order by a.is_master desc, a.created_at asc;
$$;

revoke all on function public.list_admins() from public;
grant execute on function public.list_admins() to authenticated;

-- Beri akses admin ke akun Auth yang sudah ada.
-- Akun harus dibuat dulu di Authentication > Users.
create or replace function public.add_admin_by_email(
  p_email text,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email   text;
begin
  if not public.is_master_admin() then
    raise exception 'Hanya admin master yang bisa menambah admin.';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'Email wajib diisi.';
  end if;

  v_email := lower(trim(p_email));

  select id into v_user_id
  from auth.users
  where lower(email) = v_email;

  if v_user_id is null then
    raise exception 'Akun Auth dengan email % belum ada. Buat dulu di Supabase → Authentication → Users → Add user (centang Auto Confirm User).', p_email;
  end if;

  insert into public.admins (user_id, full_name, is_master)
  values (
    v_user_id,
    coalesce(nullif(trim(p_full_name), ''), p_email),
    false
  )
  on conflict (user_id) do update
    set full_name = coalesce(nullif(trim(p_full_name), ''), admins.full_name);

  return v_user_id;
end;
$$;

revoke all on function public.add_admin_by_email(text, text) from public;
grant execute on function public.add_admin_by_email(text, text) to authenticated;

-- Cabut akses admin. Akun Auth tidak dihapus.
create or replace function public.remove_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_master_admin() then
    raise exception 'Hanya admin master yang bisa mencabut akses admin.';
  end if;

  if p_user_id is null then
    raise exception 'Admin tidak ditemukan.';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Admin master tidak bisa mencabut aksesnya sendiri.';
  end if;

  if exists (
    select 1 from public.admins
    where user_id = p_user_id and is_master = true
  ) then
    raise exception 'Admin master tidak bisa dicabut aksesnya.';
  end if;

  if not exists (
    select 1 from public.admins where user_id = p_user_id
  ) then
    raise exception 'Admin tidak ditemukan.';
  end if;

  delete from public.admins where user_id = p_user_id;
end;
$$;

revoke all on function public.remove_admin(uuid) from public;
grant execute on function public.remove_admin(uuid) to authenticated;

-- Cek hasil:
select
  a.user_id,
  u.email,
  a.full_name,
  a.is_master,
  a.created_at
from public.admins a
join auth.users u on u.id = a.user_id
order by a.is_master desc, a.created_at asc;
