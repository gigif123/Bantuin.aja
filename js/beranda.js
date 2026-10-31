// ============================================================
// Bantuin.aja - beranda.js
// Kategori + layanan populer di landing page (data dari Supabase)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const categoryGrid = document.getElementById('categoryGrid');
  const featuredGrid = document.getElementById('featuredGrid');

  if (!categoryGrid && !featuredGrid) return;

  const supabase = getSupabase();
  if (!supabase) {
    renderState(
      'i-alert',
      'Koneksi belum siap',
      'Konfigurasi Supabase tidak ditemukan. Periksa config/supabase.js.'
    );
    return;
  }

  // Nama kategori -> id simbol SVG (lihat sprite di setiap halaman publik).
  const ICONS = {
    'Joki Tugas': 'i-book',
    'Joki Laporan Praktikum': 'i-flask',
    'Layanan Penulisan': 'i-pen',
    'Layanan Pemrograman': 'i-code',
    'Presentasi & Dokumen': 'i-presentation',
    'Layanan Data': 'i-chart',
  };

  load();

  async function load() {
    skeleton();

    try {
      const [servicesRes, categoriesRes] = await Promise.all([
        fetchActiveServices(
          supabase,
          'id, title, category, short_description, description, price, duration, image_url, sort_order'
        ),
        supabase
          .from('categories')
          .select('id, name, icon, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      if (servicesRes.error) throw servicesRes.error;

      const categoryRows = categoriesRes.error ? [] : categoriesRes.data || [];
      const activeCategoryIds = new Set(categoryRows.map((cat) => cat.id));

      // Jika tabel kategori tersedia, sembunyikan layanan dari kategori nonaktif.
      const services = (servicesRes.data || []).filter(
        (svc) => !svc.category_id || !activeCategoryIds.size || activeCategoryIds.has(svc.category_id)
      );

      if (services.length === 0) {
        renderState(
          'i-book',
          'Belum ada layanan',
          'Katalog masih kosong. Tambahkan layanan lewat dashboard admin.'
        );
        return;
      }

      renderCategories(services, categoryRows);
      renderFeatured(pickFeatured(services));
    } catch (err) {
      console.error('Gagal memuat data beranda:', err);
      renderState(
        'i-alert',
        'Layanan gagal dimuat',
        'Periksa koneksi internet lalu muat ulang halaman.'
      );
    }
  }

  /* ---------- Kategori ---------- */
  function renderCategories(services, categoryRows) {
    if (!categoryGrid) return;

    const order = Object.keys(ICONS);
    const dbOrder = new Map(categoryRows.map((cat, index) => [cat.name, index]));
    const map = new Map();

    services.forEach((svc) => {
      const name = svc.category || 'Lainnya';
      map.set(name, (map.get(name) || 0) + 1);
    });

    const rank = (name) => {
      if (dbOrder.has(name)) return dbOrder.get(name);
      const legacy = order.indexOf(name);
      return 100 + (legacy === -1 ? 99 : legacy);
    };

    const names = [...map.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

    categoryGrid.innerHTML = names
      .map((name) => {
        const iconId = ICONS[name] || 'i-book';
        const count = map.get(name);
        return `
          <a class="category-card" href="layanan.html?kategori=${encodeURIComponent(name)}">
            <svg class="ic category-icon" aria-hidden="true"><use href="#${iconId}"/></svg>
            <span class="category-body">
              <strong>${escapeHtml(name)}</strong>
              <small>${count} layanan</small>
            </span>
            <svg class="ic category-arrow" aria-hidden="true"><use href="#i-arrow-right"/></svg>
          </a>
        `;
      })
      .join('');
  }

  /* ---------- Layanan populer ---------- */
  function pickFeatured(services, limit = 6) {
    const picks = [];
    const usedCategories = new Set();

    // Ambil satu wakil per kategori agar section populer tidak monoton.
    for (const svc of services) {
      if (picks.length >= limit) break;
      if (usedCategories.has(svc.category)) continue;
      picks.push(svc);
      usedCategories.add(svc.category);
    }

    // Lengkapi sisa slot dengan layanan lain.
    for (const svc of services) {
      if (picks.length >= limit) break;
      if (!picks.includes(svc)) picks.push(svc);
    }

    return picks;
  }

  function renderFeatured(services) {
    if (!featuredGrid) return;
    featuredGrid.innerHTML = services.map(serviceCardHtml).join('');
  }

  /* ---------- Skeleton & state ---------- */
  function skeleton() {
    if (categoryGrid) {
      categoryGrid.innerHTML = Array.from({ length: 6 })
        .map(
          () => `
          <div class="category-card">
            <span class="skeleton" style="width:20px;height:20px"></span>
            <span class="category-body" style="gap:6px">
              <span class="skeleton" style="height:14px;width:70%"></span>
              <span class="skeleton" style="height:11px;width:40%"></span>
            </span>
          </div>`
        )
        .join('');
    }

    if (featuredGrid) {
      featuredGrid.innerHTML = Array.from({ length: 6 })
        .map(
          () => `
          <article class="service-card">
            <div class="service-image skeleton"></div>
            <div class="service-info">
              <span class="skeleton" style="height:18px;width:35%;margin-bottom:12px"></span>
              <span class="skeleton" style="height:18px;width:70%;margin-bottom:8px"></span>
              <span class="skeleton" style="height:13px;width:100%"></span>
              <span class="skeleton" style="height:13px;width:85%;margin-top:6px"></span>
              <span class="skeleton" style="height:34px;width:100%;margin-top:20px"></span>
            </div>
          </article>`
        )
        .join('');
    }
  }

  function renderState(iconId, title, message) {
    const html = `
      <div class="state-block col-full">
        <svg class="ic empty-icon" aria-hidden="true"><use href="#${iconId}"/></svg>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
    // Tampilkan satu pesan saja agar tidak dobel di beranda.
    const target = featuredGrid || categoryGrid;
    if (!target) return;
    target.innerHTML = html;

    // Sembunyikan section lain agar tidak tersisa judul tanpa isi.
    const other = target === featuredGrid ? categoryGrid : featuredGrid;
    if (other) {
      other.innerHTML = '';
      const section = other.closest('section');
      if (section) section.hidden = true;
    }
  }
});
