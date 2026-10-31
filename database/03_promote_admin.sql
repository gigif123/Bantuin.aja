-- ============================================================
-- Bantuin.aja - JADIKAN USER SEBAGAI ADMIN MASTER
-- Jalankan SETELAH akun admin dibuat di Supabase:
--   Authentication > Users > Add user
--   (centang Auto Confirm User)
--
-- Email admin master ada di bawah. Pastikan sama dengan email akun Auth.
-- File ini aman dijalankan ulang.
-- ============================================================

alter table public.admins
  add column if not exists is_master boolean not null default false;

insert into public.admins (user_id, full_name, is_master)
select
  id,
  coalesce(raw_user_meta_data->>'full_name', email),
  true
from auth.users
where lower(email) = lower('gif20zaril@gmail.com')
on conflict (user_id) do update
  set is_master = true;

-- Cek hasil:
select
  a.user_id,
  u.email,
  a.full_name,
  a.is_master,
  u.email_confirmed_at
from public.admins a
join auth.users u on u.id = a.user_id;
