// ============================================================
// Bantuin.aja - main.js
// Navigasi, helper WhatsApp, state admin, dan utilitas UI
// ============================================================

/* ---------- Konfigurasi ---------- */
// Ganti dengan nomor WhatsApp CS (format internasional, tanpa "+" dan spasi)
const WA_NUMBER = '6281234567890';

document.addEventListener('DOMContentLoaded', () => {
  initSupabaseOnLoad();
  initMobileMenu();
  initWhatsAppLinks();
  initAdminState();
  guardAdminPages();
  setupFlashClose();
  addSecretAdminAccess();
});

/* ---------- Inisialisasi Supabase ---------- */
function initSupabaseOnLoad() {
  if (window.supabaseConfig) {
    window.supabaseConfig.initSupabase();
  }
}

function getSupabase() {
  return window.supabaseConfig ? window.supabaseConfig.getSupabase() : null;
}

/* ---------- Layanan aktif ---------- */
// `category_id` baru ada setelah database/04_kategori_katalog.sql dijalankan.
// Jika kolom belum ada, ulangi query tanpa kolom tersebut agar situs tetap jalan.
async function fetchActiveServices(supabase, fields) {
  let res = await supabase
    .from('services')
    .select(`${fields}, category_id`)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const missingCategoryId =
    res.error && (res.error.code === '42703' || /category_id/i.test(res.error.message || ''));

  if (missingCategoryId) {
    res = await supabase
      .from('services')
      .select(fields)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
  }

  return res;
}

/* ---------- WhatsApp ---------- */
function buildWaLink(message) {
  const text = encodeURIComponent(
    message || 'Halo CS Bantuin.aja, saya ingin konsultasi.'
  );
  return `https://wa.me/${WA_NUMBER}?text=${text}`;
}

function initWhatsAppLinks() {
  document.querySelectorAll('[data-wa-link]').forEach((el) => {
    const message = el.getAttribute('data-wa-link');
    el.setAttribute('href', buildWaLink(message));
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
  });
}

/* ---------- State Admin ---------- */
function getAdminUser() {
  const user = JSON.parse(localStorage.getItem('ja_user') || 'null');
  const token = localStorage.getItem('ja_token');
  return user && token && user.role === 'admin' ? user : null;
}

function initAdminState() {
  const admin = getAdminUser();

  document.querySelectorAll('[data-admin-only]').forEach((el) => {
    el.style.display = admin ? '' : 'none';
  });

  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = admin ? admin.full_name || admin.email : '';
  });

  document.querySelectorAll('[data-user-initial]').forEach((el) => {
    const name = admin ? admin.full_name || admin.email : '';
    el.textContent = name ? name.charAt(0).toUpperCase() : 'A';
  });

  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  });
}

async function handleLogout() {
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Logout Supabase:', err.message);
    }
  }

  localStorage.removeItem('ja_user');
  localStorage.removeItem('ja_token');
  showFlash('Anda telah keluar.', 'success');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 700);
}

/* ---------- Guard halaman admin ---------- */
function guardAdminPages() {
  const adminPages = ['admin.html'];
  const currentPage = window.location.pathname.split('/').pop();

  if (adminPages.includes(currentPage) && !getAdminUser()) {
    showFlash('Silakan login sebagai admin terlebih dahulu.', 'error');
    setTimeout(() => {
      window.location.href = 'login_admin.html';
    }, 600);
  }
}

/* ---------- Mobile Menu ---------- */
function initMobileMenu() {
  const btn = document.querySelector('.mobile-menu-btn');
  const menu = document.querySelector('.nav-menu');

  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('is-open', open);
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.remove('is-open');
    });
  });
}

/* ---------- Flash Notification ---------- */
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

function setupFlashClose() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.flash')) {
      e.target.closest('.flash').style.display = 'none';
    }
  });
}

function addSecretAdminAccess() {
  const HOTKEY = 'Ctrl+Shift+A';
  document.addEventListener('keydown', (e) => {
    const isHotkey = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a';
    if (isHotkey) {
      e.preventDefault();
      window.location.href = 'login_admin.html';
    }
  });
}

/* ---------- Helper umum ---------- */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(angka) || 0);
}

function goTo(page) {
  window.location.href = page;
}

/* ---------- Pesan WhatsApp layanan ---------- */
function waMessageForService(svc, opts = {}) {
  const lines = ['Halo CS Bantuin.aja 👋', ''];

  if (opts.name) lines.push(`Saya *${opts.name}*.`, '');
  if (opts.phone) lines.push(`Nomor WhatsApp saya: ${opts.phone}`, '');

  lines.push('Saya ingin konsultasi:');
  lines.push(`• Layanan: ${svc.title || '-'}`);
  lines.push(`• Kategori: ${svc.category || '-'}`);
  if (svc.price) lines.push(`• Harga acuan: ${formatRupiah(svc.price)}`);
  if (svc.duration) lines.push(`• Estimasi: ${svc.duration}`);
  lines.push(`• Kebutuhan: ${opts.need || '(tuliskan di sini)'}`);

  return lines.join('\n');
}

/* ---------- Kartu layanan (dipakai beranda & katalog) ---------- */
function serviceCardHtml(svc) {
  const title = escapeHtml(svc.title);
  const desc = escapeHtml(svc.short_description || svc.description || '');
  const category = escapeHtml(svc.category || 'Layanan');
  const image = escapeHtml(svc.image_url || 'assets/images/placeholder.svg');

  const duration = svc.duration
    ? `<span class="service-meta">
         <svg class="ic" aria-hidden="true"><use href="#i-clock"/></svg>${escapeHtml(svc.duration)}
       </span>`
    : '';

  return `
    <article class="service-card">
      <div class="service-image">
        <img src="${image}" alt="${title}" loading="lazy">
      </div>
      <div class="service-info">
        <div class="service-tags">
          <span class="service-tag">${category}</span>
        </div>
        <h3>${title}</h3>
        <p>${desc}</p>
        <div class="service-foot">
          <div class="service-price-row">
            <span class="service-price">
              <span class="price-label">Mulai dari</span>
              <strong>${formatRupiah(svc.price)}</strong>
            </span>
            ${duration}
          </div>
          <div class="service-actions">
            <a href="detail-layanan.html?id=${encodeURIComponent(svc.id)}" class="btn-outline btn-sm">Lihat Detail</a>
            <a href="${buildWaLink(waMessageForService(svc))}" target="_blank" rel="noopener" class="btn-wa btn-sm">Konsultasi</a>
          </div>
        </div>
      </div>
    </article>
  `;
}
