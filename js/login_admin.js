// ============================================================
// Bantuin.aja - login_admin.js
// Login Admin dengan Supabase Auth
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const supabase = window.supabaseConfig ? window.supabaseConfig.getSupabase() : null;
  
  const form = document.getElementById('adminLoginForm');
  const alertEl = document.getElementById('loginAlert');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      showAlert(alertEl, 'Email dan password wajib diisi.', 'error');
      return;
    }

    setButtonLoading(form.querySelector('button[type="submit"]'), true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Pastikan akun ini terdaftar di tabel admins
      const { data: adminRow, error: adminError } = await supabase
        .from('admins')
        .select('user_id, full_name')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (adminError) {
        await supabase.auth.signOut();

        if (adminError.code === '42P01' || adminError.code === 'PGRST205') {
          throw new Error(
            'Tabel public.admins belum ada. Jalankan database/01_schema.sql di Supabase SQL Editor.'
          );
        }

        throw new Error(
          `Gagal memeriksa status admin: ${adminError.message || 'error database tidak diketahui'}`
        );
      }

      if (!adminRow) {
        await supabase.auth.signOut();
        throw new Error(
          'Akun Auth berhasil, tetapi belum terdaftar sebagai admin. Jalankan database/03_promote_admin.sql untuk email ini, lalu coba login lagi.'
        );
      }

      // Simpan sesi admin
      const user = {
        id: data.user.id,
        email: data.user.email,
        full_name:
          adminRow.full_name ||
          data.user.user_metadata.full_name ||
          data.user.email,
        role: 'admin',
      };
      localStorage.setItem('ja_user', JSON.stringify(user));
      localStorage.setItem('ja_token', data.session.access_token);

      showFlash('Login admin berhasil!', 'success');
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 700);
    } catch (err) {
      showAlert(alertEl, authErrorMessage(err), 'error');
    } finally {
      setButtonLoading(form.querySelector('button[type="submit"]'), false);
    }
  });
});

/* ---------- Helpers ---------- */
function authErrorMessage(err) {
  const message = err && err.message ? err.message : '';
  const code = err && err.code ? err.code : '';
  const lower = message.toLowerCase();

  if (code === 'email_not_confirmed' || lower.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Buka link konfirmasi di inbox, atau konfirmasi user di Supabase → Authentication → Users → pilih user → Confirm email.';
  }

  if (code === 'invalid_credentials' || lower.includes('invalid login credentials')) {
    return 'Email atau password salah. Pastikan memakai email dan password akun yang sudah terdaftar.';
  }

  if (code === 'signup_disabled' || lower.includes('signups not allowed')) {
    return 'Pendaftaran publik sudah dimatikan. Buat akun admin lewat Supabase → Authentication → Users → Add user.';
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Tidak bisa menghubungi Supabase. Pastikan halaman dibuka lewat server lokal (bukan file://) dan koneksi internet aktif.';
  }

  return message || 'Login gagal. Coba lagi.';
}

function showAlert(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = `auth-alert ${type}`;
  el.style.display = 'block';
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Memproses...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Masuk';
  }
}

function showFlash(message, type = 'success') {
  let flash = document.querySelector('.flash');
  if (!flash) {
    flash = document.createElement('div');
    flash.className = 'flash';
    document.body.appendChild(flash);
  }
  flash.className = `flash ${type}`;
  flash.textContent = message;
  flash.style.display = 'block';
  setTimeout(() => {
    flash.style.display = 'none';
  }, 4000);
}