// ============================================================
// Bantuin.aja - admin.js
// Dashboard CS: pesanan, pembayaran, layanan, kategori, pelanggan
// ============================================================

document.addEventListener('DOMContentLoaded', init);

/* ---------- Konstanta ---------- */
const ORDER_STATUS = {
  baru: { label: 'Baru', cls: 'st-baru' },
  menunggu_pembayaran: { label: 'Menunggu Pembayaran', cls: 'st-menunggu_pembayaran' },
  diproses: { label: 'Diproses', cls: 'st-diproses' },
  revisi: { label: 'Revisi', cls: 'st-revisi' },
  selesai: { label: 'Selesai', cls: 'st-selesai' },
  dibatalkan: { label: 'Dibatalkan', cls: 'st-dibatalkan' },
};

const PAYMENT_STATUS = {
  belum: { label: 'Belum', cls: 'st-belum' },
  menunggu_konfirmasi: { label: 'Menunggu Konfirmasi', cls: 'st-menunggu_konfirmasi' },
  terkonfirmasi: { label: 'Terkonfirmasi', cls: 'st-terkonfirmasi' },
  gagal: { label: 'Gagal', cls: 'st-gagal' },
};

const PAYMENT_METHOD = {
  transfer_bank: 'Transfer Bank',
  e_wallet: 'E-Wallet',
  qris: 'QRIS',
  tunai: 'Tunai',
  lainnya: 'Lainnya',
};

const SECTION_META = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Ringkasan pesanan dan aktivitas terbaru.',
  },
  pesanan: {
    title: 'Pesanan',
    subtitle: 'Catat pesanan baru, ubah status, dan pantau riwayat.',
  },
  pembayaran: {
    title: 'Pembayaran',
    subtitle: 'Catat dan verifikasi pembayaran pelanggan.',
  },
  layanan: {
    title: 'Layanan',
    subtitle: 'Kelola katalog, harga acuan, dan estimasi waktu.',
  },
  kategori: {
    title: 'Kategori',
    subtitle: 'Kelola kelompok layanan yang tampil di website.',
  },
  pelanggan: {
    title: 'Pelanggan',
    subtitle: 'Data pelanggan yang dikumpulkan CS lewat WhatsApp.',
  },
  admins: {
    title: 'Kelola Admin',
    subtitle: 'Beri atau cabut akses admin. Hanya admin master yang bisa mengubah.',
  },
};

const ACTIVE_ORDER_STATUSES = ['baru', 'menunggu_pembayaran', 'diproses', 'revisi'];

// Harus sama dengan email di database/03_promote_admin.sql dan 06_admin_management.sql.
const MASTER_ADMIN_EMAIL = 'gif20zaril@gmail.com';

/* ---------- State ---------- */
const state = {
  section: 'dashboard',
  services: [],
  categories: [],
  customers: [],
  orders: [],
  payments: [],
  admins: [],
  isMaster: false,
  hasCategoryId: true,
};

let sb = null;
let adminUser = null;

let modalBackdrop = null;
let modalTitle = null;
let modalBody = null;

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  sb = typeof getSupabase === 'function' ? getSupabase() : null;
  adminUser = typeof getAdminUser === 'function' ? getAdminUser() : null;

  if (!sb || !adminUser) {
    window.location.href = 'login_admin.html';
    return;
  }

  state.isMaster = (adminUser.email || '').toLowerCase() === MASTER_ADMIN_EMAIL;
  document.querySelectorAll('[data-master-only]').forEach((el) => {
    el.hidden = !state.isMaster;
  });

  modalBackdrop = document.getElementById('modalBackdrop');
  modalTitle = document.getElementById('modalTitle');
  modalBody = document.getElementById('modalBody');

  bindNavigation();
  bindSidebar();
  bindToolbar();
  bindButtons();
  bindModal();
  bindDelegatedActions();

  const hash = window.location.hash.replace('#', '');
  await navigate(SECTION_META[hash] ? hash : 'dashboard', false);
}

/* ============================================================
   NAVIGASI SECTION
   ============================================================ */
function bindNavigation() {
  document.querySelectorAll('.sidebar-nav a[data-section]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.dataset.section);
    });
  });

  document.querySelectorAll('[data-goto]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.dataset.goto);
    });
  });

  window.addEventListener('hashchange', () => {
    const name = window.location.hash.replace('#', '');
    if (SECTION_META[name] && name !== state.section) navigate(name, false);
  });
}

function currentSection() {
  return state.section;
}

async function navigate(name, push = true) {
  if (!SECTION_META[name]) name = 'dashboard';
  if (name === 'admins' && !state.isMaster) name = 'dashboard';

  state.section = name;

  document.querySelectorAll('.admin-section').forEach((section) => {
    section.hidden = section.id !== `section-${name}`;
  });

  document.querySelectorAll('.sidebar-nav a[data-section]').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === name);
  });

  const meta = SECTION_META[name];
  const titleEl = document.getElementById('pageTitle');
  const subtitleEl = document.getElementById('pageSubtitle');
  if (titleEl) titleEl.textContent = meta.title;
  if (subtitleEl) subtitleEl.textContent = meta.subtitle;

  if (push) history.replaceState(null, '', `#${name}`);

  closeSidebar();

  try {
    if (name === 'dashboard') await loadDashboard();
    else if (name === 'pesanan') await loadOrders();
    else if (name === 'pembayaran') await loadPayments();
    else if (name === 'layanan') await loadServices();
    else if (name === 'kategori') await loadCategories();
    else if (name === 'pelanggan') await loadCustomers();
    else if (name === 'admins') await loadAdmins();
  } catch (err) {
    console.error('Gagal memuat section:', err);
    const message = friendlyError(err);
    showFlash(message, 'error');

    if (message.includes('Sesi admin tidak valid')) {
      localStorage.removeItem('ja_user');
      localStorage.removeItem('ja_token');
      setTimeout(() => {
        window.location.href = 'login_admin.html';
      }, 1500);
    }
  }
}

async function refreshCurrentSection() {
  await navigate(currentSection(), false);
}

/* ============================================================
   SIDEBAR MOBILE
   ============================================================ */
function bindSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!toggle || !sidebar || !overlay) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });

  overlay.addEventListener('click', closeSidebar);
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

/* ============================================================
   MODAL
   ============================================================ */
function bindModal() {
  const closeBtn = document.getElementById('modalClose');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop && !modalBackdrop.hidden) closeModal();
  });
}

function openModal(title, html) {
  if (!modalBackdrop) return null;

  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modalBackdrop.hidden = false;
  document.body.classList.add('modal-open');

  const form = modalBody.querySelector('form');
  const first = form && form.querySelector('input:not([type="hidden"]), select, textarea');

  if (first) {
    setTimeout(() => first.focus(), 40);
  }

  return form;
}

function closeModal() {
  if (!modalBackdrop) return;
  modalBackdrop.hidden = true;
  modalBody.innerHTML = '';
  document.body.classList.remove('modal-open');
}

function withSubmit(form, handler, successMessage) {
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const buttons = form.querySelectorAll('button');
    buttons.forEach((b) => (b.disabled = true));

    try {
      const result = await handler(form);
      closeModal();
      const message = typeof result === 'string' && result ? result : successMessage;
      if (message) showFlash(message, 'success');
    } catch (err) {
      console.error(err);
      showModalError(friendlyError(err));
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  });
}

function showModalError(message) {
  if (!modalBody) return;

  let el = modalBody.querySelector('#modalError');
  if (!el) {
    el = document.createElement('p');
    el.id = 'modalError';
    el.className = 'modal-error';
    modalBody.insertBefore(el, modalBody.firstChild);
  }

  el.textContent = message;
  el.hidden = false;
}

function errorSlot() {
  return '<p class="modal-error" id="modalError" hidden></p>';
}

function modalActions(submitLabel, extra = '') {
  return `
    <div class="modal-actions">
      ${extra}
      <button type="button" class="btn-outline" data-close>Batal</button>
      <button type="submit" class="btn-primary">${escapeHtml(submitLabel)}</button>
    </div>
  `;
}

/* ============================================================
   LOADER DATA
   ============================================================ */
async function loadDashboard() {
  const recentBody = document.getElementById('recentOrdersBody');
  if (recentBody) {
    recentBody.innerHTML = '<tr><td colspan="6" class="td-empty">Memuat data…</td></tr>';
  }

  const [ordersRes, paymentsRes, customersRes, categoriesRes] = await Promise.all([
    sb
      .from('orders')
      .select('id, order_code, service_title, amount, status, created_at, customer:customers(name)')
      .order('created_at', { ascending: false }),
    sb.from('payments').select('amount, status'),
    sb.from('customers').select('id', { count: 'exact', head: true }),
    sb.from('categories').select('id', { count: 'exact', head: true }),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  renderSetupAlert(categoriesRes.error);

  const orders = ordersRes.data || [];
  const payments = paymentsRes.data || [];

  state.orders = orders;
  state.payments = payments;

  const revenue = payments
    .filter((p) => p.status === 'terkonfirmasi')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const active = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length;

  setText('statOrders', orders.length);
  setText('statRevenue', formatRupiah(revenue));
  setText('statActive', active);
  setText('statCustomers', customersRes.count || 0);

  renderRecentOrders(orders.slice(0, 6));
}

function renderSetupAlert(categoriesError) {
  const box = document.getElementById('setupAlert');
  const list = document.getElementById('setupAlertList');
  if (!box || !list) return;

  const notes = [];

  if (typeof WA_NUMBER !== 'undefined' && WA_NUMBER === '6281234567890') {
    notes.push(
      'Nomor WhatsApp CS masih placeholder. Ganti <code>WA_NUMBER</code> di <code>js/main.js</code> dengan nomor aktif.'
    );
  }

  if (categoriesError) {
    notes.push(
      'Tabel kategori belum tersedia. Jalankan <code>database/04_kategori_katalog.sql</code> di Supabase SQL Editor, lalu muat ulang halaman.'
    );
  }

  box.hidden = notes.length === 0;
  list.innerHTML = notes.map((note) => `<li>${note}</li>`).join('');
}

function renderRecentOrders(orders) {
  const body = document.getElementById('recentOrdersBody');
  if (!body) return;

  if (!orders.length) {
    body.innerHTML = '<tr><td colspan="6" class="td-empty">Belum ada pesanan. Buat pesanan pertama lewat tombol “+ Pesanan Baru”.</td></tr>';
    return;
  }

  body.innerHTML = orders
    .map(
      (order) => `
      <tr>
        <td class="cell-code">${escapeHtml(order.order_code)}</td>
        <td>${escapeHtml(order.customer?.name || '—')}</td>
        <td class="cell-clip">${escapeHtml(order.service_title || '—')}</td>
        <td class="cell-price">${formatRupiah(order.amount)}</td>
        <td>${statusBadge(order.status)}</td>
        <td>${formatDate(order.created_at)}</td>
      </tr>`
    )
    .join('');
}

async function loadOrders() {
  const body = document.getElementById('ordersBody');
  if (body) body.innerHTML = '<tr><td colspan="7" class="td-empty">Memuat data…</td></tr>';

  const { data, error } = await sb
    .from('orders')
    .select(
      'id, order_code, service_id, service_title, amount, deadline, brief, status, created_at, updated_at, customer_id, customer:customers(id, name, whatsapp), service:services(id, title, category)'
    )
    .order('created_at', { ascending: false });

  if (error) throw error;

  state.orders = data || [];
  applyOrderFilters();
}

function applyOrderFilters() {
  const body = document.getElementById('ordersBody');
  if (!body) return;

  const q = (document.getElementById('orderSearch')?.value || '').trim().toLowerCase();
  const status = document.getElementById('orderStatusFilter')?.value || '';

  const list = state.orders.filter((order) => {
    if (status && order.status !== status) return false;
    if (!q) return true;

    return (
      (order.order_code || '').toLowerCase().includes(q) ||
      (order.service_title || '').toLowerCase().includes(q) ||
      (order.customer?.name || '').toLowerCase().includes(q) ||
      (order.customer?.whatsapp || '').toLowerCase().includes(q)
    );
  });

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="7" class="td-empty">${
      state.orders.length ? 'Tidak ada pesanan yang cocok dengan filter.' : 'Belum ada pesanan.'
    }</td></tr>`;
    return;
  }

  body.innerHTML = list
    .map(
      (order) => `
      <tr>
        <td class="cell-code">${escapeHtml(order.order_code)}</td>
        <td>
          <span class="cell-strong">${escapeHtml(order.customer?.name || 'Tanpa pelanggan')}</span>
          <span class="cell-sub">${escapeHtml(order.customer?.whatsapp || '—')}</span>
        </td>
        <td class="cell-clip">${escapeHtml(order.service_title || '—')}</td>
        <td class="cell-price">${formatRupiah(order.amount)}</td>
        <td>${formatDate(order.deadline)}</td>
        <td>${statusBadge(order.status)}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="icon-btn" data-detail-order="${order.id}">Detail</button>
            <button type="button" class="icon-btn" data-status-order="${order.id}">Status</button>
            <button type="button" class="icon-btn danger" data-delete-order="${order.id}">Hapus</button>
          </div>
        </td>
      </tr>`
    )
    .join('');
}

async function loadPayments() {
  const body = document.getElementById('paymentsBody');
  if (body) body.innerHTML = '<tr><td colspan="7" class="td-empty">Memuat data…</td></tr>';

  const { data, error } = await sb
    .from('payments')
    .select('*, order:orders(id, order_code, service_title, customer:customers(name))')
    .order('created_at', { ascending: false });

  if (error) throw error;

  state.payments = data || [];
  applyPaymentFilters();
}

function applyPaymentFilters() {
  const body = document.getElementById('paymentsBody');
  if (!body) return;

  const q = (document.getElementById('paymentSearch')?.value || '').trim().toLowerCase();
  const status = document.getElementById('paymentStatusFilter')?.value || '';

  const list = state.payments.filter((payment) => {
    if (status && payment.status !== status) return false;
    if (!q) return true;

    return (
      (payment.order?.order_code || '').toLowerCase().includes(q) ||
      (payment.order?.customer?.name || '').toLowerCase().includes(q) ||
      (payment.note || '').toLowerCase().includes(q)
    );
  });

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="7" class="td-empty">${
      state.payments.length ? 'Tidak ada pembayaran yang cocok dengan filter.' : 'Belum ada pembayaran tercatat.'
    }</td></tr>`;
    return;
  }

  body.innerHTML = list
    .map(
      (payment) => `
      <tr>
        <td>${formatDate(payment.paid_at || payment.created_at, true)}</td>
        <td>
          <span class="cell-code">${escapeHtml(payment.order?.order_code || '—')}</span>
          <span class="cell-sub">${escapeHtml(payment.order?.service_title || '')}</span>
        </td>
        <td>${escapeHtml(payment.order?.customer?.name || '—')}</td>
        <td class="cell-price">${formatRupiah(payment.amount)}</td>
        <td>${escapeHtml(PAYMENT_METHOD[payment.method] || payment.method || '—')}</td>
        <td>${paymentBadge(payment.status)}</td>
        <td>
          <div class="row-actions">
            ${
              payment.status === 'menunggu_konfirmasi'
                ? `<button type="button" class="icon-btn" data-verify-payment="${payment.id}">Verifikasi</button>`
                : ''
            }
            <button type="button" class="icon-btn" data-edit-payment="${payment.id}">Edit</button>
            <button type="button" class="icon-btn danger" data-delete-payment="${payment.id}">Hapus</button>
          </div>
        </td>
      </tr>`
    )
    .join('');
}

async function loadServices() {
  const body = document.getElementById('servicesBody');
  if (body) body.innerHTML = '<tr><td colspan="6" class="td-empty">Memuat data…</td></tr>';

  const [servicesRes] = await Promise.all([fetchServices(), ensureCategories()]);

  if (servicesRes.error) throw servicesRes.error;

  state.services = servicesRes.data || [];
  populateServiceCategoryFilter();
  applyServiceFilters();
}

async function fetchServices() {
  const fields =
    'id, title, slug, category, short_description, description, price, duration, image_url, is_active, sort_order, created_at';

  let res = await sb
    .from('services')
    .select(`${fields}, category_id`)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });

  if (res.error && (res.error.code === '42703' || /category_id/i.test(res.error.message || ''))) {
    state.hasCategoryId = false;
    res = await sb
      .from('services')
      .select(fields)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true });
  } else if (!res.error) {
    state.hasCategoryId = true;
  }

  return res;
}

function populateServiceCategoryFilter() {
  const select = document.getElementById('serviceCategoryFilter');
  if (!select) return;

  const current = select.value;
  const names = new Set();

  state.categories.forEach((c) => names.add(c.name));
  state.services.forEach((s) => {
    if (s.category) names.add(s.category);
  });

  select.innerHTML =
    '<option value="">Semua kategori</option>' +
    [...names]
      .sort()
      .map((name) => `<option value="${attr(name)}">${escapeHtml(name)}</option>`)
      .join('');

  select.value = current;
}

function applyServiceFilters() {
  const body = document.getElementById('servicesBody');
  if (!body) return;

  const q = (document.getElementById('serviceSearch')?.value || '').trim().toLowerCase();
  const category = document.getElementById('serviceCategoryFilter')?.value || '';

  const list = state.services.filter((svc) => {
    if (category && svc.category !== category) return false;
    if (!q) return true;

    return (
      (svc.title || '').toLowerCase().includes(q) ||
      (svc.category || '').toLowerCase().includes(q) ||
      (svc.short_description || '').toLowerCase().includes(q)
    );
  });

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="6" class="td-empty">${
      state.services.length ? 'Tidak ada layanan yang cocok dengan filter.' : 'Belum ada layanan. Tambahkan layanan pertama.'
    }</td></tr>`;
    return;
  }

  body.innerHTML = list
    .map(
      (svc) => `
      <tr>
        <td>
          <span class="cell-strong">${escapeHtml(svc.title)}</span>
          <span class="cell-sub">${escapeHtml(svc.short_description || '')}</span>
        </td>
        <td>${escapeHtml(svc.category || '—')}</td>
        <td class="cell-price">${formatRupiah(svc.price)}</td>
        <td>${escapeHtml(svc.duration || '—')}</td>
        <td>${svc.is_active ? badge('Aktif', 'st-aktif') : badge('Nonaktif', 'st-nonaktif')}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="icon-btn" data-edit-service="${svc.id}">Edit</button>
            <button type="button" class="icon-btn" data-toggle-service="${svc.id}">${svc.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
            <button type="button" class="icon-btn danger" data-delete-service="${svc.id}">Hapus</button>
          </div>
        </td>
      </tr>`
    )
    .join('');
}

async function loadCategories() {
  const body = document.getElementById('categoriesBody');
  if (body) body.innerHTML = '<tr><td colspan="5" class="td-empty">Memuat data…</td></tr>';

  await ensureCategories(true);
  renderCategories();
}

function renderCategories() {
  const body = document.getElementById('categoriesBody');
  if (!body) return;

  if (!state.categories.length) {
    body.innerHTML =
      '<tr><td colspan="5" class="td-empty">Tabel kategori belum tersedia atau masih kosong. Jalankan database/04_kategori_katalog.sql di Supabase, lalu muat ulang.</td></tr>';
    return;
  }

  body.innerHTML = state.categories
    .map(
      (cat) => `
      <tr>
        <td>
          <span class="cell-strong">${escapeHtml(cat.icon || '📚')} ${escapeHtml(cat.name)}</span>
          <span class="cell-sub">/${escapeHtml(cat.slug || '')}</span>
        </td>
        <td class="cell-clip">${escapeHtml(cat.description || '—')}</td>
        <td>${Number(cat.sort_order || 0)}</td>
        <td>${cat.is_active ? badge('Aktif', 'st-aktif') : badge('Nonaktif', 'st-nonaktif')}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="icon-btn" data-edit-category="${cat.id}">Edit</button>
            <button type="button" class="icon-btn danger" data-delete-category="${cat.id}">Hapus</button>
          </div>
        </td>
      </tr>`
    )
    .join('');
}

async function loadCustomers() {
  const body = document.getElementById('customersBody');
  if (body) body.innerHTML = '<tr><td colspan="6" class="td-empty">Memuat data…</td></tr>';

  const { data, error } = await sb
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  state.customers = data || [];
  applyCustomerFilters();
}

function applyCustomerFilters() {
  const body = document.getElementById('customersBody');
  if (!body) return;

  const q = (document.getElementById('customerSearch')?.value || '').trim().toLowerCase();

  const list = state.customers.filter((customer) => {
    if (!q) return true;
    return (
      (customer.name || '').toLowerCase().includes(q) ||
      (customer.whatsapp || '').toLowerCase().includes(q) ||
      (customer.email || '').toLowerCase().includes(q) ||
      (customer.notes || '').toLowerCase().includes(q)
    );
  });

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="6" class="td-empty">${
      state.customers.length ? 'Tidak ada pelanggan yang cocok.' : 'Belum ada pelanggan tercatat.'
    }</td></tr>`;
    return;
  }

  body.innerHTML = list
    .map(
      (customer) => `
      <tr>
        <td class="cell-strong">${escapeHtml(customer.name)}</td>
        <td>${escapeHtml(customer.whatsapp)}</td>
        <td>${escapeHtml(customer.email || '—')}</td>
        <td class="cell-clip">${escapeHtml(customer.notes || '—')}</td>
        <td>${formatDate(customer.created_at)}</td>
        <td>
          <div class="row-actions">
            ${
              customer.whatsapp
                ? `<a class="icon-btn" href="${attr(
                    waChatLink(
                      customer.whatsapp,
                      `Halo ${customer.name}, saya CS Bantuin.aja. Ada yang bisa kami bantu terkait kebutuhan akademik?`
                    )
                  )}" target="_blank" rel="noopener">Chat</a>`
                : ''
            }
            <button type="button" class="icon-btn" data-edit-customer="${customer.id}">Edit</button>
            <button type="button" class="icon-btn danger" data-delete-customer="${customer.id}">Hapus</button>
          </div>
        </td>
      </tr>`
    )
    .join('');
}

/* ============================================================
   KELOLA ADMIN
   ============================================================ */
async function loadAdmins() {
  const body = document.getElementById('adminsBody');
  if (body) body.innerHTML = '<tr><td colspan="5" class="td-empty">Memuat data…</td></tr>';

  const { data, error } = await sb.rpc('list_admins');

  if (error) {
    if (isMissingFunctionError(error)) {
      if (body) {
        body.innerHTML =
          '<tr><td colspan="5" class="td-empty">Fitur kelola admin belum aktif. Jalankan database/06_admin_management.sql di Supabase SQL Editor, lalu muat ulang halaman.</td></tr>';
      }
      return;
    }
    throw error;
  }

  state.admins = data || [];
  renderAdmins();
}

function renderAdmins() {
  const body = document.getElementById('adminsBody');
  if (!body) return;

  if (!state.admins.length) {
    body.innerHTML = state.isMaster
      ? '<tr><td colspan="5" class="td-empty">Akun Anda belum ditandai sebagai admin master. Jalankan database/03_promote_admin.sql lalu database/06_admin_management.sql di Supabase SQL Editor.</td></tr>'
      : '<tr><td colspan="5" class="td-empty">Hanya admin master yang bisa melihat daftar admin.</td></tr>';
    return;
  }

  body.innerHTML = state.admins
    .map((admin) => {
      const isSelf = admin.user_id === adminUser.id;

      return `
      <tr>
        <td class="cell-strong">${escapeHtml(admin.full_name || '—')}${isSelf ? ' <span class="cell-sub">(Anda)</span>' : ''}</td>
        <td>${escapeHtml(admin.email || '—')}</td>
        <td>${admin.is_master ? badge('Master', 'st-aktif') : badge('Admin', 'st-baru')}</td>
        <td>${formatDate(admin.created_at)}</td>
        <td>
          <div class="row-actions">
            ${
              admin.is_master || isSelf
                ? '<span class="cell-sub">—</span>'
                : `<button type="button" class="icon-btn danger" data-delete-admin="${admin.user_id}">Cabut</button>`
            }
          </div>
        </td>
      </tr>`;
    })
    .join('');
}

function openAdminForm() {
  const html = `
    <form>
      ${errorSlot()}
      <div class="form-grid">
        <div class="form-group">
          <label for="adminName">Nama admin</label>
          <input id="adminName" name="full_name" maxlength="80" required placeholder="Nama lengkap">
        </div>
        <div class="form-group">
          <label for="adminEmail">Email akun Supabase</label>
          <input id="adminEmail" name="email" type="email" maxlength="160" required placeholder="nama@email.com">
        </div>
      </div>
      <p class="form-help">
        Akun Auth harus sudah dibuat di Supabase → Authentication → Users → Add user
        (centang <strong>Auto Confirm User</strong>). Form ini memberi akses admin
        ke akun tersebut, bukan membuat akun Auth baru.
      </p>
      ${modalActions('Tambah Admin')}
    </form>
  `;

  const form = openModal('Tambah Admin', html);

  withSubmit(
    form,
    async () => {
      const fd = new FormData(form);
      const email = String(fd.get('email') || '').trim();
      const fullName = String(fd.get('full_name') || '').trim();

      if (!email) throw new Error('Email wajib diisi.');
      if (!fullName) throw new Error('Nama admin wajib diisi.');

      const { error } = await sb.rpc('add_admin_by_email', {
        p_email: email,
        p_full_name: fullName,
      });

      if (error) {
        if (isMissingFunctionError(error)) {
          throw new Error(
            'Fitur kelola admin belum aktif. Jalankan database/06_admin_management.sql di Supabase SQL Editor.'
          );
        }
        throw error;
      }

      await loadAdmins();
    },
    'Admin ditambahkan.'
  );
}

async function deleteAdmin(id) {
  const admin = state.admins.find((a) => a.user_id === id);
  if (!admin) return;

  if (
    !window.confirm(
      `Cabut akses admin untuk ${admin.email}? Akun Auth-nya tetap ada di Supabase.`
    )
  ) {
    return;
  }

  const { error } = await sb.rpc('remove_admin', { p_user_id: id });
  if (error) throw error;

  await loadAdmins();
  showFlash('Akses admin dicabut.', 'success');
}

function isMissingFunctionError(error) {
  const message = (error && error.message) || '';
  return (
    error &&
    (error.code === 'PGRST202' ||
      error.code === '42883' ||
      /could not find the function|function .* does not exist/i.test(message))
  );
}

/* ============================================================
   KATEGORI
   ============================================================ */
async function ensureCategories(force = false) {
  if (state.categories.length && !force) return state.categories;

  try {
    const { data, error } = await sb
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    state.categories = data || [];
  } catch (err) {
    console.warn('Kategori belum tersedia:', err.message);
    state.categories = [];
  }

  return state.categories;
}

function openCategoryForm(category = null) {
  const html = `
    <form>
      ${errorSlot()}
      <div class="form-grid">
        <div class="form-group">
          <label for="catName">Nama kategori</label>
          <input id="catName" name="name" maxlength="80" required value="${attr(category?.name || '')}">
        </div>
        <div class="form-group">
          <label for="catIcon">Ikon (emoji)</label>
          <input id="catIcon" name="icon" maxlength="8" placeholder="📚" value="${attr(category?.icon || '')}">
        </div>
        <div class="form-group">
          <label for="catSort">Urutan tampil</label>
          <input id="catSort" name="sort_order" type="number" step="1" value="${attr(category?.sort_order ?? 0)}">
        </div>
        <div class="form-group">
          <label for="catActive">Status</label>
          <select id="catActive" name="is_active">
            <option value="1" ${category?.is_active === false ? '' : 'selected'}>Aktif</option>
            <option value="0" ${category?.is_active === false ? 'selected' : ''}>Nonaktif</option>
          </select>
          <small class="form-help">Kategori nonaktif disembunyikan dari landing/katalog beserta layanannya.</small>
        </div>
        <div class="form-group full">
          <label for="catDesc">Deskripsi singkat</label>
          <textarea id="catDesc" name="description" rows="3" maxlength="240">${escapeHtml(category?.description || '')}</textarea>
        </div>
      </div>
      ${modalActions(category ? 'Simpan Perubahan' : 'Tambah Kategori')}
    </form>
  `;

  const form = openModal(category ? 'Edit Kategori' : 'Tambah Kategori', html);

  withSubmit(
    form,
    async () => {
      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      if (!name) throw new Error('Nama kategori wajib diisi.');

      const payload = {
        name,
        icon: String(fd.get('icon') || '').trim() || '📚',
        description: String(fd.get('description') || '').trim() || null,
        sort_order: Number(fd.get('sort_order') || 0),
        is_active: fd.get('is_active') === '1',
      };

      if (category) {
        const { error } = await sb.from('categories').update(payload).eq('id', category.id);
        if (error) throw error;

        // Nama kategori disimpan juga sebagai teks di services.category.
        // Sinkronkan agar katalog publik tidak menampilkan nama lama.
        if (category.name !== name) {
          const [byId, byText] = await Promise.all([
            sb.from('services').update({ category: name }).eq('category_id', category.id),
            sb.from('services').update({ category: name }).eq('category', category.name),
          ]);

          if (byId.error) throw byId.error;
          if (byText.error) throw byText.error;
        }
      } else {
        payload.slug = uniqueSlug(name);
        const { error } = await sb.from('categories').insert(payload);
        if (error) throw error;
      }

      await loadCategories();
      await refreshCurrentSection();
    },
    category ? 'Kategori diperbarui.' : 'Kategori ditambahkan.'
  );
}

/* ============================================================
   LAYANAN
   ============================================================ */
async function openServiceForm(service = null) {
  await ensureCategories();

  const categoryNames = state.categories
    .filter((cat) => cat.is_active !== false)
    .map((cat) => cat.name);
  if (service?.category && !categoryNames.includes(service.category)) {
    categoryNames.unshift(service.category);
  }

  const categoryField = categoryNames.length
    ? `
      <div class="form-group">
        <label for="svcCategory">Kategori</label>
        <select id="svcCategory" name="category" required>
          ${categoryNames
            .map(
              (name) =>
                `<option value="${attr(name)}" ${service?.category === name ? 'selected' : ''}>${escapeHtml(name)}</option>`
            )
            .join('')}
        </select>
      </div>`
    : `
      <div class="form-group">
        <label for="svcCategory">Kategori</label>
        <input id="svcCategory" name="category" maxlength="80" required value="${attr(service?.category || '')}" placeholder="Joki Tugas">
        <small class="form-help">Tabel kategori belum ada. Jalankan database/04_kategori_katalog.sql.</small>
      </div>`;

  const html = `
    <form>
      ${errorSlot()}
      <div class="form-grid">
        <div class="form-group full">
          <label for="svcTitle">Nama layanan</label>
          <input id="svcTitle" name="title" maxlength="120" required value="${attr(service?.title || '')}">
        </div>
        ${categoryField}
        <div class="form-group">
          <label for="svcPrice">Harga mulai (Rp)</label>
          <input id="svcPrice" name="price" type="number" min="0" step="1000" required value="${attr(service?.price ?? '')}">
        </div>
        <div class="form-group">
          <label for="svcDuration">Estimasi waktu</label>
          <input id="svcDuration" name="duration" maxlength="40" placeholder="3-5 hari" value="${attr(service?.duration || '')}">
        </div>
        <div class="form-group">
          <label for="svcSort">Urutan tampil</label>
          <input id="svcSort" name="sort_order" type="number" step="1" value="${attr(service?.sort_order ?? 0)}">
        </div>
        <div class="form-group full">
          <label for="svcShort">Deskripsi singkat</label>
          <input id="svcShort" name="short_description" maxlength="160" value="${attr(service?.short_description || '')}">
        </div>
        <div class="form-group full">
          <label for="svcDesc">Deskripsi lengkap</label>
          <textarea id="svcDesc" name="description" rows="4" maxlength="1200">${escapeHtml(service?.description || '')}</textarea>
        </div>
        <div class="form-group full">
          <label for="svcImage">URL gambar <small>(opsional)</small></label>
          <input id="svcImage" name="image_url" placeholder="assets/images/placeholder.svg" value="${attr(service?.image_url || '')}">
        </div>
      </div>
      <label class="check-row">
        <input type="checkbox" name="is_active" ${service?.is_active === false ? '' : 'checked'}>
        Tampilkan di katalog publik
      </label>
      ${modalActions(service ? 'Simpan Perubahan' : 'Tambah Layanan')}
    </form>
  `;

  const form = openModal(service ? 'Edit Layanan' : 'Tambah Layanan', html);

  withSubmit(
    form,
    async () => {
      const fd = new FormData(form);
      const title = String(fd.get('title') || '').trim();
      const category = String(fd.get('category') || '').trim();

      if (!title || !category) throw new Error('Nama dan kategori wajib diisi.');

      const matched = state.categories.find((cat) => cat.name === category);

      const payload = {
        title,
        category,
        short_description: String(fd.get('short_description') || '').trim() || null,
        description: String(fd.get('description') || '').trim() || null,
        price: Number(fd.get('price') || 0),
        duration: String(fd.get('duration') || '').trim() || null,
        image_url: String(fd.get('image_url') || '').trim() || 'assets/images/placeholder.svg',
        sort_order: Number(fd.get('sort_order') || 0),
        is_active: fd.get('is_active') === 'on',
      };

      if (state.hasCategoryId) {
        payload.category_id = matched ? matched.id : null;
      }

      if (service) {
        const { error } = await sb.from('services').update(payload).eq('id', service.id);
        if (error) throw error;
      } else {
        payload.slug = uniqueSlug(title);
        const { error } = await sb.from('services').insert(payload);
        if (error) throw error;
      }

      await loadServices();
      if (currentSection() === 'dashboard') await loadDashboard();
    },
    service ? 'Layanan diperbarui.' : 'Layanan ditambahkan.'
  );
}

/* ============================================================
   PELANGGAN
   ============================================================ */
function openCustomerForm(customer = null) {
  const html = `
    <form>
      ${errorSlot()}
      <div class="form-grid">
        <div class="form-group">
          <label for="custName">Nama</label>
          <input id="custName" name="name" maxlength="80" required value="${attr(customer?.name || '')}">
        </div>
        <div class="form-group">
          <label for="custWa">Nomor WhatsApp</label>
          <input id="custWa" name="whatsapp" maxlength="24" required placeholder="08xxxxxxxxxx" value="${attr(customer?.whatsapp || '')}">
        </div>
        <div class="form-group full">
          <label for="custEmail">Email <small>(opsional)</small></label>
          <input id="custEmail" name="email" type="email" maxlength="120" value="${attr(customer?.email || '')}">
        </div>
        <div class="form-group full">
          <label for="custNotes">Catatan <small>(opsional)</small></label>
          <textarea id="custNotes" name="notes" rows="3" maxlength="400">${escapeHtml(customer?.notes || '')}</textarea>
        </div>
      </div>
      ${modalActions(customer ? 'Simpan Perubahan' : 'Tambah Pelanggan')}
    </form>
  `;

  const form = openModal(customer ? 'Edit Pelanggan' : 'Tambah Pelanggan', html);

  withSubmit(
    form,
    async () => {
      const fd = new FormData(form);
      const payload = {
        name: String(fd.get('name') || '').trim(),
        whatsapp: normalizePhone(fd.get('whatsapp')),
        email: String(fd.get('email') || '').trim() || null,
        notes: String(fd.get('notes') || '').trim() || null,
      };

      if (!payload.name || !payload.whatsapp) throw new Error('Nama dan nomor WhatsApp wajib diisi.');

      if (customer) {
        const { error } = await sb.from('customers').update(payload).eq('id', customer.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('customers').insert(payload);
        if (error) {
          if (error.code === '23505') throw new Error('Nomor WhatsApp ini sudah terdaftar pada pelanggan lain.');
          throw error;
        }
      }

      await loadCustomers();
      if (currentSection() === 'dashboard') await loadDashboard();
    },
    customer ? 'Data pelanggan diperbarui.' : 'Pelanggan ditambahkan.'
  );
}

/* ============================================================
   PESANAN
   ============================================================ */
async function openOrderForm(order = null) {
  const [customersRes, servicesRes] = await Promise.all([
    sb.from('customers').select('id, name, whatsapp').order('name', { ascending: true }),
    sb
      .from('services')
      .select('id, title, category, price, is_active')
      .order('title', { ascending: true }),
  ]);

  if (customersRes.error) throw customersRes.error;
  if (servicesRes.error) throw servicesRes.error;

  const customers = customersRes.data || [];
  const services = servicesRes.data || [];

  const statusOptions = Object.entries(ORDER_STATUS)
    .map(
      ([value, meta]) =>
        `<option value="${value}" ${order?.status === value ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`
    )
    .join('');

  const html = `
    <form>
      ${errorSlot()}
      <div class="form-group">
        <label for="orderCustomer">Pelanggan</label>
        <select id="orderCustomer" name="customer_id" required>
          <option value="">— Pilih pelanggan —</option>
          ${customers
            .map(
              (c) =>
                `<option value="${c.id}" ${order?.customer_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)} — ${escapeHtml(c.whatsapp)}</option>`
            )
            .join('')}
          <option value="__new">+ Pelanggan baru…</option>
        </select>
      </div>

      <div id="newCustomerBox" hidden>
        <div class="form-grid">
          <div class="form-group">
            <label for="newCustName">Nama pelanggan baru</label>
            <input id="newCustName" name="new_name" maxlength="80" placeholder="Nama">
          </div>
          <div class="form-group">
            <label for="newCustWa">WhatsApp</label>
            <input id="newCustWa" name="new_whatsapp" maxlength="24" placeholder="08xxxxxxxxxx">
          </div>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label for="orderService">Layanan</label>
          <select id="orderService" name="service_id">
            <option value="">— Layanan kustom —</option>
            ${services
              .map(
                (s) =>
                  `<option value="${s.id}" data-title="${attr(s.title)}" data-price="${Number(s.price) || 0}" ${
                    order?.service_id === s.id ? 'selected' : ''
                  }>${escapeHtml(s.title)}${s.is_active ? '' : ' (nonaktif)'}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="orderTitle">Nama layanan tercatat</label>
          <input id="orderTitle" name="service_title" maxlength="120" required value="${attr(order?.service_title || '')}">
        </div>
        <div class="form-group">
          <label for="orderAmount">Nilai pesanan (Rp)</label>
          <input id="orderAmount" name="amount" type="number" min="0" step="1000" required value="${attr(order?.amount ?? '')}">
        </div>
        <div class="form-group">
          <label for="orderDeadline">Deadline</label>
          <input id="orderDeadline" name="deadline" type="date" value="${attr(order?.deadline || '')}">
        </div>
        <div class="form-group">
          <label for="orderStatus">Status</label>
          <select id="orderStatus" name="status">${statusOptions}</select>
        </div>
        <div class="form-group full">
          <label for="orderBrief">Ringkasan kebutuhan</label>
          <textarea id="orderBrief" name="brief" rows="3" maxlength="1200" placeholder="Instruksi, jumlah halaman, deadline, catatan revisi…">${escapeHtml(order?.brief || '')}</textarea>
        </div>
      </div>

      ${modalActions(order ? 'Simpan Perubahan' : 'Buat Pesanan')}
    </form>
  `;

  const form = openModal(order ? 'Edit Pesanan' : 'Buat Pesanan', html);
  if (!form) return;

  // Tampilkan field pelanggan baru bila dipilih
  const customerSelect = form.querySelector('#orderCustomer');
  const newBox = form.querySelector('#newCustomerBox');

  customerSelect.addEventListener('change', () => {
    newBox.hidden = customerSelect.value !== '__new';
  });

  // Isi otomatis nama layanan + nominal saat layanan dipilih
  const serviceSelect = form.querySelector('#orderService');
  const titleInput = form.querySelector('#orderTitle');
  const amountInput = form.querySelector('#orderAmount');

  serviceSelect.addEventListener('change', () => {
    const opt = serviceSelect.selectedOptions[0];
    if (!opt || !opt.value) return;
    titleInput.value = opt.dataset.title || '';
    amountInput.value = Number(opt.dataset.price || 0) || '';
  });

  withSubmit(
    form,
    async () => {
      const fd = new FormData(form);
      const status = String(fd.get('status') || 'baru');
      const serviceId = String(fd.get('service_id') || '');
      const title = String(fd.get('service_title') || '').trim();

      if (!title) throw new Error('Nama layanan wajib diisi.');

      let customerId = String(fd.get('customer_id') || '');

      if (customerId === '__new') {
        const name = String(fd.get('new_name') || '').trim();
        const whatsapp = normalizePhone(fd.get('new_whatsapp'));

        if (!name || !whatsapp) {
          throw new Error('Nama dan WhatsApp pelanggan baru wajib diisi.');
        }

        const { data: existing } = await sb
          .from('customers')
          .select('id')
          .eq('whatsapp', whatsapp)
          .maybeSingle();

        if (existing) {
          customerId = existing.id;
        } else {
          const { data: created, error } = await sb
            .from('customers')
            .insert({ name, whatsapp })
            .select('id')
            .single();

          if (error) throw error;
          customerId = created.id;
        }
      }

      if (!customerId) throw new Error('Pilih pelanggan terlebih dahulu.');

      const payload = {
        customer_id: customerId,
        service_id: serviceId || null,
        service_title: title,
        amount: Number(fd.get('amount') || 0),
        deadline: String(fd.get('deadline') || '') || null,
        brief: String(fd.get('brief') || '').trim() || null,
        status,
      };

      if (order) {
        const { error } = await sb.from('orders').update(payload).eq('id', order.id);
        if (error) throw error;

        if (order.status !== status) {
          await insertOrderUpdate(order.id, status, 'Status diubah lewat edit pesanan.');
        }
      } else {
        payload.created_by = adminUser.id;

        const { data: created, error } = await sb
          .from('orders')
          .insert(payload)
          .select('id, order_code')
          .single();

        if (error) throw error;

        await insertOrderUpdate(created.id, status, 'Pesanan dibuat oleh admin.');
        await refreshCurrentSection();
        return `Pesanan ${created?.order_code || ''} berhasil dibuat.`;
      }

      await refreshCurrentSection();
    },
    order ? 'Pesanan diperbarui.' : 'Pesanan berhasil dibuat.'
  );
}

function openStatusForm(order) {
  const html = `
    <form>
      ${errorSlot()}
      <div class="form-group">
        <label for="statusNew">Status baru</label>
        <select id="statusNew" name="status">
          ${Object.entries(ORDER_STATUS)
            .map(
              ([value, meta]) =>
                `<option value="${value}" ${order.status === value ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="statusNote">Catatan progres <small>(opsional)</small></label>
        <textarea id="statusNote" name="note" rows="3" maxlength="400" placeholder="Contoh: draft bab 1-3 sudah dikirim ke pelanggan"></textarea>
      </div>
      ${modalActions('Simpan Status')}
    </form>
  `;

  const form = openModal(`Ubah Status — ${order.order_code}`, html);

  withSubmit(
    form,
    async () => {
      const fd = new FormData(form);
      const status = String(fd.get('status') || '');
      if (!ORDER_STATUS[status]) throw new Error('Status tidak valid.');

      const { error } = await sb.from('orders').update({ status }).eq('id', order.id);
      if (error) throw error;

      await insertOrderUpdate(order.id, status, String(fd.get('note') || '').trim() || null);
      await refreshCurrentSection();
    },
    'Status pesanan diperbarui.'
  );
}

async function openOrderDetail(orderId) {
  const [orderRes, paymentsRes, updatesRes] = await Promise.all([
    sb
      .from('orders')
      .select('*, customer:customers(*), service:services(title, category)')
      .eq('id', orderId)
      .maybeSingle(),
    sb.from('payments').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    sb
      .from('order_updates')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
  ]);

  if (orderRes.error) throw orderRes.error;

  const order = orderRes.data;
  if (!order) throw new Error('Pesanan tidak ditemukan.');

  const payments = paymentsRes.data || [];
  const updates = updatesRes.data || [];

  const paid = payments
    .filter((p) => p.status === 'terkonfirmasi')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const paymentRows = payments.length
    ? payments
        .map(
          (p) => `
          <div class="timeline-item">
            <span class="timeline-dot"></span>
            <div style="flex:1">
              <strong>${formatRupiah(p.amount)} · ${escapeHtml(PAYMENT_METHOD[p.method] || p.method || '—')}</strong>
              <div>${paymentBadge(p.status)}</div>
              <time>${formatDate(p.paid_at || p.created_at, true)}${p.note ? ` · ${escapeHtml(p.note)}` : ''}</time>
            </div>
          </div>`
        )
        .join('')
    : '<p style="font-size:.85rem;color:var(--text-muted)">Belum ada pembayaran.</p>';

  const timeline = updates.length
    ? updates
        .map(
          (u) => `
          <div class="timeline-item">
            <span class="timeline-dot"></span>
            <div>
              <strong>${statusBadge(u.status)}</strong>
              ${u.note ? `<div>${escapeHtml(u.note)}</div>` : ''}
              <time>${formatDate(u.created_at, true)}</time>
            </div>
          </div>`
        )
        .join('')
    : '<p style="font-size:.85rem;color:var(--text-muted)">Belum ada riwayat status.</p>';

  const customerName = order.customer?.name || 'Kak';
  let orderWaMessage = [
    `Halo ${customerName}, saya CS Bantuin.aja.`,
    '',
    `Menindaklanjuti pesanan ${order.order_code} (${order.service_title || 'layanan akademik'}).`,
    `Status saat ini: ${ORDER_STATUS[order.status]?.label || order.status}.`,
  ].join('\n');

  if (order.deadline) orderWaMessage += `\nDeadline: ${formatDate(order.deadline)}.`;
  orderWaMessage += '\n\nAda yang bisa kami bantu?';

  const orderWaLink = waChatLink(order.customer?.whatsapp, orderWaMessage);

  const html = `
    <div>
      <dl class="detail-info">
        <div><dt>Kode</dt><dd class="cell-code">${escapeHtml(order.order_code)}</dd></div>
        <div><dt>Status</dt><dd>${statusBadge(order.status)}</dd></div>
        <div><dt>Pelanggan</dt><dd>${escapeHtml(order.customer?.name || '—')}</dd></div>
        <div><dt>WhatsApp</dt><dd>${escapeHtml(order.customer?.whatsapp || '—')}</dd></div>
        <div><dt>Layanan</dt><dd>${escapeHtml(order.service_title || '—')}</dd></div>
        <div><dt>Nilai</dt><dd class="cell-price">${formatRupiah(order.amount)}</dd></div>
        <div><dt>Deadline</dt><dd>${formatDate(order.deadline)}</dd></div>
        <div><dt>Dibuat</dt><dd>${formatDate(order.created_at, true)}</dd></div>
        <div><dt>Dibayar (terkonfirmasi)</dt><dd>${formatRupiah(paid)}</dd></div>
      </dl>

      <div class="detail-brief">${escapeHtml(order.brief || 'Tidak ada ringkasan kebutuhan.')}</div>

      <div class="detail-subhead">Pembayaran</div>
      <div class="timeline">${paymentRows}</div>

      <div class="detail-subhead">Riwayat Status</div>
      <div class="timeline">${timeline}</div>

      <div class="modal-actions">
        ${orderWaLink ? `<a href="${attr(orderWaLink)}" target="_blank" rel="noopener" class="btn-outline">Chat Pelanggan</a>` : ''}
        <button type="button" class="btn-outline" data-close>Tutup</button>
        <button type="button" class="btn-primary" data-status-order="${order.id}">Ubah Status</button>
      </div>
    </div>
  `;

  openModal(`Detail Pesanan — ${order.order_code}`, html);
}

/* ============================================================
   PEMBAYARAN
   ============================================================ */
async function openPaymentForm(payment = null) {
  const { data, error } = await sb
    .from('orders')
    .select('id, order_code, service_title, amount, status, customer:customers(name)')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;

  const orders = data || [];

  const orderOptions = orders
    .map(
      (o) =>
        `<option value="${o.id}" data-amount="${Number(o.amount) || 0}" ${
          payment?.order_id === o.id ? 'selected' : ''
        }>${escapeHtml(o.order_code)} — ${escapeHtml(o.service_title)} (${escapeHtml(o.customer?.name || 'tanpa pelanggan')})</option>`
    )
    .join('');

  const methodOptions = Object.entries(PAYMENT_METHOD)
    .map(
      ([value, label]) =>
        `<option value="${value}" ${payment?.method === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
    )
    .join('');

  const statusOptions = Object.entries(PAYMENT_STATUS)
    .map(([value, meta]) => {
      const selected = payment ? payment.status === value : value === 'terkonfirmasi';
      return `<option value="${value}" ${selected ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`;
    })
    .join('');

  const html = `
    <form>
      ${errorSlot()}
      <div class="form-group">
        <label for="payOrder">Pesanan</label>
        <select id="payOrder" name="order_id" required>
          <option value="">— Pilih pesanan —</option>
          ${orderOptions}
        </select>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="payAmount">Jumlah (Rp)</label>
          <input id="payAmount" name="amount" type="number" min="0" step="1000" required value="${attr(payment?.amount ?? '')}">
        </div>
        <div class="form-group">
          <label for="payMethod">Metode</label>
          <select id="payMethod" name="method">${methodOptions}</select>
        </div>
        <div class="form-group">
          <label for="payStatus">Status</label>
          <select id="payStatus" name="status">${statusOptions}</select>
          <small class="form-help">“Terkonfirmasi” berarti dana diterima; pesanan otomatis masuk Diproses.</small>
        </div>
        <div class="form-group">
          <label for="payDate">Tanggal bayar</label>
          <input id="payDate" name="paid_at" type="datetime-local" value="${attr(payment?.paid_at ? toLocalInput(payment.paid_at) : toLocalInput(new Date()))}">
        </div>
        <div class="form-group full">
          <label for="payNote">Catatan <small>(opsional)</small></label>
          <input id="payNote" name="note" maxlength="200" placeholder="Contoh: transfer BCA a/n pelanggan" value="${attr(payment?.note || '')}">
        </div>
      </div>
      ${modalActions(payment ? 'Simpan Perubahan' : 'Catat Pembayaran')}
    </form>
  `;

  const form = openModal(payment ? 'Edit Pembayaran' : 'Catat Pembayaran', html);
  if (!form) return;

  const orderSelect = form.querySelector('#payOrder');
  const amountInput = form.querySelector('#payAmount');

  orderSelect.addEventListener('change', () => {
    const opt = orderSelect.selectedOptions[0];
    if (!opt || !opt.value) return;
    amountInput.value = Number(opt.dataset.amount || 0) || '';
  });

  withSubmit(
    form,
    async () => {
      const fd = new FormData(form);
      const orderId = String(fd.get('order_id') || '');
      if (!orderId) throw new Error('Pilih pesanan terlebih dahulu.');

      const status = String(fd.get('status') || 'belum');
      const paidAtRaw = String(fd.get('paid_at') || '');

      const payload = {
        order_id: orderId,
        amount: Number(fd.get('amount') || 0),
        method: String(fd.get('method') || 'transfer_bank'),
        status,
        paid_at: paidAtRaw ? new Date(paidAtRaw).toISOString() : status === 'terkonfirmasi' ? new Date().toISOString() : null,
        note: String(fd.get('note') || '').trim() || null,
      };

      if (payment) {
        const { error } = await sb.from('payments').update(payload).eq('id', payment.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('payments').insert(payload);
        if (error) throw error;
      }

      if (status === 'terkonfirmasi') {
        await syncOrderAfterPayment(orderId);
      }

      await refreshCurrentSection();
    },
    payment ? 'Pembayaran diperbarui.' : 'Pembayaran dicatat.'
  );
}

async function syncOrderAfterPayment(orderId) {
  const { data: order } = await sb
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return;
  if (!['baru', 'menunggu_pembayaran'].includes(order.status)) return;

  const { error } = await sb.from('orders').update({ status: 'diproses' }).eq('id', orderId);
  if (!error) {
    await insertOrderUpdate(orderId, 'diproses', 'Pembayaran terkonfirmasi.');
  }
}

/* ============================================================
   AKSI (delegation)
   ============================================================ */
function bindDelegatedActions() {
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-close], [data-edit-service], [data-delete-service], [data-toggle-service], [data-edit-category], [data-delete-category], [data-edit-customer], [data-delete-customer], [data-detail-order], [data-status-order], [data-delete-order], [data-edit-payment], [data-delete-payment], [data-verify-payment], [data-delete-admin]');

    if (!target) return;

    if (target.hasAttribute('data-close')) {
      closeModal();
      return;
    }

    try {
      if (target.dataset.editService) {
        const svc = state.services.find((s) => s.id === target.dataset.editService);
        if (svc) await openServiceForm(svc);
      } else if (target.dataset.toggleService) {
        await toggleService(target.dataset.toggleService);
      } else if (target.dataset.deleteService) {
        await deleteService(target.dataset.deleteService);
      } else if (target.dataset.editCategory) {
        const cat = state.categories.find((c) => c.id === target.dataset.editCategory);
        if (cat) openCategoryForm(cat);
      } else if (target.dataset.deleteCategory) {
        await deleteCategory(target.dataset.deleteCategory);
      } else if (target.dataset.editCustomer) {
        const customer = state.customers.find((c) => c.id === target.dataset.editCustomer);
        if (customer) openCustomerForm(customer);
      } else if (target.dataset.deleteCustomer) {
        await deleteCustomer(target.dataset.deleteCustomer);
      } else if (target.dataset.detailOrder) {
        await openOrderDetail(target.dataset.detailOrder);
      } else if (target.dataset.statusOrder) {
        const order = state.orders.find((o) => o.id === target.dataset.statusOrder);
        if (order) openStatusForm(order);
      } else if (target.dataset.deleteOrder) {
        await deleteOrder(target.dataset.deleteOrder);
      } else if (target.dataset.editPayment) {
        const payment = state.payments.find((p) => p.id === target.dataset.editPayment);
        if (payment) await openPaymentForm(payment);
      } else if (target.dataset.deletePayment) {
        await deletePayment(target.dataset.deletePayment);
      } else if (target.dataset.verifyPayment) {
        await verifyPayment(target.dataset.verifyPayment);
      } else if (target.dataset.deleteAdmin) {
        await deleteAdmin(target.dataset.deleteAdmin);
      }
    } catch (err) {
      console.error(err);
      showFlash(friendlyError(err), 'error');
    }
  });
}

async function toggleService(id) {
  const svc = state.services.find((s) => s.id === id);
  if (!svc) return;

  const { error } = await sb
    .from('services')
    .update({ is_active: !svc.is_active })
    .eq('id', id);

  if (error) throw error;

  await loadServices();
  showFlash(svc.is_active ? 'Layanan dinonaktifkan.' : 'Layanan diaktifkan.', 'success');
}

async function deleteService(id) {
  const svc = state.services.find((s) => s.id === id);
  if (!svc) return;

  if (!window.confirm(`Hapus layanan “${svc.title}”? Pesanan lama tetap menyimpan nama layanan.`)) return;

  const { error } = await sb.from('services').delete().eq('id', id);
  if (error) throw error;

  await loadServices();
  showFlash('Layanan dihapus.', 'success');
}

async function deleteCategory(id) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;

  if (
    !window.confirm(
      `Hapus kategori “${cat.name}”? Layanan di dalamnya tetap ada dan dipindahkan ke kategori “Lainnya”.`
    )
  )
    return;

  // Pindahkan layanan terkait ke "Lainnya" agar katalog tidak menampilkan
  // kategori yang sudah dihapus.
  const [byId, byText] = await Promise.all([
    sb.from('services').update({ category: 'Lainnya', category_id: null }).eq('category_id', id),
    sb.from('services').update({ category: 'Lainnya' }).eq('category', cat.name),
  ]);

  if (byId.error) throw byId.error;
  if (byText.error) throw byText.error;

  const { error } = await sb.from('categories').delete().eq('id', id);
  if (error) throw error;

  await loadCategories();
  if (!document.getElementById('section-layanan')?.hidden) await loadServices();
  showFlash('Kategori dihapus. Layanan terkait dipindahkan ke “Lainnya”.', 'success');
}

async function deleteCustomer(id) {
  const customer = state.customers.find((c) => c.id === id);
  if (!customer) return;

  const { count, error: countError } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', id);

  if (countError) throw countError;

  if (count > 0) {
    throw new Error('Pelanggan ini punya riwayat pesanan dan tidak bisa dihapus. Edit datanya saja bila perlu.');
  }

  if (!window.confirm(`Hapus pelanggan “${customer.name}”?`)) return;

  const { error } = await sb.from('customers').delete().eq('id', id);
  if (error) throw error;

  await loadCustomers();
  showFlash('Pelanggan dihapus.', 'success');
}

async function deleteOrder(id) {
  const order = state.orders.find((o) => o.id === id);
  if (!order) return;

  if (
    !window.confirm(
      `Hapus pesanan ${order.order_code}? Semua pembayaran dan riwayat statusnya ikut terhapus.`
    )
  ) {
    return;
  }

  const { error } = await sb.from('orders').delete().eq('id', id);
  if (error) throw error;

  await refreshCurrentSection();
  showFlash('Pesanan dihapus.', 'success');
}

async function deletePayment(id) {
  const payment = state.payments.find((p) => p.id === id);
  if (!payment) return;

  if (!window.confirm(`Hapus catatan pembayaran ${formatRupiah(payment.amount)}?`)) return;

  const { error } = await sb.from('payments').delete().eq('id', id);
  if (error) throw error;

  await loadPayments();
  showFlash('Pembayaran dihapus.', 'success');
}

async function verifyPayment(id) {
  const payment = state.payments.find((p) => p.id === id);
  if (!payment) return;

  if (!window.confirm(`Verifikasi pembayaran ${formatRupiah(payment.amount)}? Status pesanan akan menjadi “Diproses” bila belum dibayar.`)) {
    return;
  }

  const { error } = await sb
    .from('payments')
    .update({
      status: 'terkonfirmasi',
      paid_at: payment.paid_at || new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;

  await syncOrderAfterPayment(payment.order_id);
  await loadPayments();
  showFlash('Pembayaran diverifikasi.', 'success');
}

/* ============================================================
   BINDING UI
   ============================================================ */
function bindToolbar() {
  const bind = (id, event, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
  };

  bind('orderSearch', 'input', applyOrderFilters);
  bind('orderStatusFilter', 'change', applyOrderFilters);
  bind('paymentSearch', 'input', applyPaymentFilters);
  bind('paymentStatusFilter', 'change', applyPaymentFilters);
  bind('serviceSearch', 'input', applyServiceFilters);
  bind('serviceCategoryFilter', 'change', applyServiceFilters);
  bind('customerSearch', 'input', applyCustomerFilters);
}

function bindButtons() {
  const bindClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  bindClick('btnAddOrder', () => safeOpen(() => openOrderForm()));
  bindClick('btnQuickOrder', () => safeOpen(() => openOrderForm()));
  bindClick('btnAddPayment', () => safeOpen(() => openPaymentForm()));
  bindClick('btnAddService', () => safeOpen(() => openServiceForm()));
  bindClick('btnAddCategory', () => safeOpen(() => openCategoryForm()));
  bindClick('btnAddCustomer', () => safeOpen(() => openCustomerForm()));
  bindClick('btnAddAdmin', () => safeOpen(() => openAdminForm()));
}

function safeOpen(fn) {
  Promise.resolve()
    .then(fn)
    .catch((err) => {
      console.error(err);
      showFlash(friendlyError(err), 'error');
    });
}

/* ============================================================
   HELPER UMUM
   ============================================================ */
async function insertOrderUpdate(orderId, status, note) {
  const { error } = await sb.from('order_updates').insert({
    order_id: orderId,
    status,
    note: note || null,
    created_by: adminUser.id,
  });

  if (error) console.warn('Gagal menyimpan riwayat status:', error.message);
}

function statusBadge(status) {
  const meta = ORDER_STATUS[status] || { label: status || '—', cls: 'st-belum' };
  return badge(meta.label, meta.cls);
}

function paymentBadge(status) {
  const meta = PAYMENT_STATUS[status] || { label: status || '—', cls: 'st-belum' };
  return badge(meta.label, meta.cls);
}

function badge(label, cls) {
  return `<span class="status-badge ${cls}">${escapeHtml(label)}</span>`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatDate(value, withTime = false) {
  if (!value) return '—';

  let date;
  if (typeof value === 'string' && value.length === 10) {
    date = new Date(`${value}T00:00:00`);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return '—';

  const options = { day: '2-digit', month: 'short', year: 'numeric' };
  if (withTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    return date.toLocaleString('id-ID', options);
  }

  return date.toLocaleDateString('id-ID', options);
}

function toLocalInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizePhone(value) {
  return String(value || '')
    .trim()
    .replace(/[\s\-().]/g, '');
}

function waChatLink(phone, message) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(String(message || ''))}`;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function uniqueSlug(text) {
  const base = slugify(text) || 'item';
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

function attr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function friendlyError(err) {
  if (!err) return 'Terjadi kesalahan. Coba lagi.';

  const message = err.message || String(err);

  if (
    err.code === '42501' ||
    err.status === 401 ||
    /permission denied|jwt|not authenticated|invalid.*(token|claim)/i.test(message)
  ) {
    return 'Sesi admin tidak valid atau kedaluwarsa. Silakan login ulang lewat halaman login.';
  }

  if (
    err.code === 'PGRST205' ||
    message.includes('Could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  ) {
    return 'Tabel database belum lengkap. Jalankan database/04_kategori_katalog.sql di Supabase SQL Editor.';
  }

  if (err.code === '23505') return 'Data sudah ada (duplikat). Periksa kembali.';

  return message;
}
