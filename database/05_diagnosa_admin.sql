-- ============================================================
-- Bantuin.aja - DIAGNOSA LOGIN ADMIN
-- Jalankan seluruh file ini di Supabase > SQL Editor.
--
-- Login admin butuh DUA hal:
--   1. User Auth ada dan email_confirmed_at TIDAK NULL
--   2. User tersebut punya baris di public.admins
--
-- Kalau email_confirmed_at NULL:
--   Authentication > Users > pilih user > Confirm email
--   (atau hapus user lalu Add user dengan Auto Confirm User)
--
-- Kalau is_master false untuk email master:
--   Jalankan database/03_promote_admin.sql lalu 06_admin_management.sql.
-- ============================================================

-- Pastikan kolom is_master ada (aman dijalankan berulang).
alter table public.admins
  add column if not exists is_master boolean not null default false;

-- 1. Cek akun Auth + status konfirmasi + status admin
select
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  u.last_sign_in_at,
  (a.user_id is not null) as terdaftar_admin,
  coalesce(a.is_master, false) as is_master
from auth.users u
left join public.admins a on a.user_id = u.id
order by u.created_at desc;

-- 2. Daftarkan akun sebagai admin.
--    Ganti email di bawah kalau akun Auth memakai email lain.
insert into public.admins (user_id, full_name)
select id, coalesce(raw_user_meta_data->>'full_name', email)
from auth.users
where email = 'gif20zaril@gmail.com'
on conflict (user_id) do nothing;

-- 3. Verifikasi hasil akhir
select
  a.user_id,
  u.email,
  a.full_name,
  a.is_master,
  u.email_confirmed_at
from public.admins a
join auth.users u on u.id = a.user_id;
