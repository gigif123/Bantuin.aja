// ============================================================
// Bantuin.aja - layanan.js
// Katalog: fetch Supabase, filter kategori (chip), cari, urutkan
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  const supabase = getSupabase();
  const searchInput = document.getElementById('searchServices');
  const sortFilter = document.getElementById('sortFilter');
  const chips = document.getElementById('categoryChips');
  const emptyState = document.getElementById('emptyState');
  const countEl = document.getElementById('servicesCount');
  const listTitle = document.getElementById('listTitle');

  const CATEGORY_ORDER = [
    'Joki Tugas',
    'Joki Laporan Praktikum',
    'Layanan Penulisan',
    'Layanan Pemrograman',
    'Presentasi & Dokumen',
    'Layanan Data',
  ];

  const urlCategory = new URLSearchParams(window.location.search).get('kategori');

  let allServices = [];
  let filtered = [];
  let activeCategory = urlCategory || 'semua';
  let categories = [];

  if (!supabase) {
    grid.innerHTML = stateHtml(
      'i-alert',
      'Koneksi belum siap',
      'Konfigurasi Supabase tidak ditemukan. Periksa config/supabase.js.'
    );
    if (countEl) countEl.textContent = '—';
    return;
  }

  init();

  async function init() {
    await loadServices();
    bindEvents();
  }

  /* ---------- Data ---------- */
  async function loadServices() {
    grid.innerHTML = skeletonHtml(6);

    try {
      const [servicesRes, categoriesRes] = await Promise.all([
        fetchActiveServices(
          supabase,
          'id, title, category, short_description, description, price, duration, image_url, sort_order, created_at'
        ),
        supabase
          .from('categories')
          .select('id, name, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      if (servicesRes.error) throw servicesRes.error;

      const categoryRows = categoriesRes.error ? [] : categoriesRes.data || [];
      const activeCategoryIds = new Set(categoryRows.map((cat) => cat.id));

      // Jika tabel kategori tersedia, sembunyikan layanan dari kategori nonaktif.
      allServices = (servicesRes.data || []).filter(
        (svc) => !svc.category_id || !activeCategoryIds.size || activeCategoryIds.has(svc.category_id)
      );
      categories = buildCategories(allServices, categoryRows);

      // Kalau kategori dari URL tidak ada, kembali ke "semua"
      if (activeCategory !== 'semua' && !categories.includes(activeCategory)) {
        activeCategory = 'semua';
      }

      renderChips();
      applyFilter();
    } catch (err) {
      console.error('Gagal memuat layanan:', err);
      grid.innerHTML = stateHtml(
        'i-alert',
        'Layanan gagal dimuat',
        'Periksa koneksi internet lalu muat ulang halaman.'
      );
      if (countEl) countEl.textContent = '—';
      if (emptyState) emptyState.hidden = true;
    }
  }

  function buildCategories(list, categoryRows = []) {
    const found = [...new Set(list.map((s) => s.category).filter(Boolean))];
    const dbOrder = new Map(categoryRows.map((cat, index) => [cat.name, index]));

    const rank = (name) => {
      if (dbOrder.has(name)) return dbOrder.get(name);
      const legacy = CATEGORY_ORDER.indexOf(name);
      return 100 + (legacy === -1 ? 99 : legacy);
    };

    return found.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }

  /* ---------- Chip kategori ---------- */
  function renderChips() {
    if (!chips) return;

    const items = ['semua', ...categories];

    chips.innerHTML = items
      .map((name) => {
        const isActive = name === activeCategory;
        const label = name === 'semua' ? 'Semua Layanan' : name;
        const count =
          name === 'semua'
            ? allServices.length
            : allServices.filter((s) => s.category === name).length;

        return `
          <button type="button" class="chip${isActive ? ' active' : ''}" data-category="${escapeHtml(name)}">
            ${escapeHtml(label)} <span class="chip-count">${count}</span>
          </button>
        `;
      })
      .join('');

    chips.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCategory = btn.getAttribute('data-category');
        chips.querySelectorAll('.chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilter();
      });
    });
  }

  /* ---------- Render ---------- */
  function renderServices(list) {
    if (listTitle) {
      listTitle.textContent =
        activeCategory === 'semua' ? 'Layanan Tersedia' : activeCategory;
    }

    if (!list || list.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.hidden = false;
      if (countEl) countEl.textContent = '0 layanan';
      return;
    }

    if (emptyState) emptyState.hidden = true;
    if (countEl) countEl.textContent = `${list.length} layanan`;

    grid.innerHTML = list.map(serviceCardHtml).join('');
  }

  function skeletonHtml(n) {
    let html = '';
    for (let i = 0; i < n; i++) {
      html += `
        <article class="service-card">
          <div class="service-image skeleton"></div>
          <div class="service-info">
            <span class="skeleton" style="height:18px;width:35%;margin-bottom:12px"></span>
            <span class="skeleton" style="height:18px;width:70%;margin-bottom:8px"></span>
            <span class="skeleton" style="height:13px;width:100%"></span>
            <span class="skeleton" style="height:13px;width:85%;margin-top:6px"></span>
            <span class="skeleton" style="height:34px;width:100%;margin-top:20px"></span>
          </div>
        </article>
      `;
    }
    return html;
  }

  function stateHtml(iconId, title, message) {
    return `
      <div class="state-block col-full">
        <svg class="ic empty-icon" aria-hidden="true"><use href="#${iconId}"/></svg>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  /* ---------- Interaksi ---------- */
  function bindEvents() {
    if (searchInput) {
      searchInput.addEventListener('input', applyFilter);
    }

    if (sortFilter) {
      sortFilter.addEventListener('change', applyFilter);
    }
  }

  function applyFilter() {
    const q = (searchInput ? searchInput.value : '').trim().toLowerCase();

    filtered = allServices.filter((s) => {
      const matchCategory =
        activeCategory === 'semua' || s.category === activeCategory;
      if (!matchCategory) return false;
      if (!q) return true;

      return (
        (s.title || '').toLowerCase().includes(q) ||
        (s.short_description || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
      );
    });

    applySort();
  }

  function applySort() {
    const mode = sortFilter ? sortFilter.value : 'urutan';

    if (mode === 'harga-asc') {
      filtered.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (mode === 'harga-desc') {
      filtered.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (mode === 'nama') {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      filtered.sort(
        (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
      );
    }

    renderServices(filtered);
  }
});
