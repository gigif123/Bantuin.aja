// ============================================================
// Bantuin.aja - detail-layanan.js
// Detail layanan + form konsultasi -> pesan WhatsApp otomatis
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const wrap = document.getElementById('detailWrap');
  if (!wrap) return;

  const id = new URLSearchParams(window.location.search).get('id');
  const supabase = getSupabase();

  if (!id) {
    renderState('i-search', 'Layanan tidak dipilih', 'Buka detail layanan dari halaman katalog.', true);
    return;
  }

  if (!supabase) {
    renderState('i-alert', 'Koneksi belum siap', 'Konfigurasi Supabase tidak ditemukan. Periksa config/supabase.js.');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, title, category, short_description, description, price, duration, image_url')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      renderState('i-inbox', 'Layanan tidak ditemukan', 'Layanan mungkin sudah tidak tersedia. Lihat layanan lain di katalog.', true);
      return;
    }

    renderDetail(data);
  } catch (err) {
    console.error('Gagal memuat detail layanan:', err);
    renderState('i-alert', 'Gagal memuat layanan', 'Periksa koneksi internet lalu muat ulang halaman.');
  }

  /* ---------- Render ---------- */
  function renderDetail(svc) {
    const title = escapeHtml(svc.title);
    const category = escapeHtml(svc.category || 'Layanan');
    const description = escapeHtml(svc.description || svc.short_description || '');
    const image = escapeHtml(svc.image_url || 'assets/images/placeholder.svg');
    const categoryLink = `layanan.html?kategori=${encodeURIComponent(svc.category || '')}`;

    document.title = `${svc.title} — Bantuin.aja`;
    const crumb = document.getElementById('breadcrumbTitle');
    if (crumb) crumb.textContent = svc.title;

    wrap.innerHTML = `
      <div class="detail-layout">
        <article class="detail-card">
          <div class="detail-image">
            <img src="${image}" alt="${title}">
          </div>
          <div class="detail-body">
            <div class="service-tags">
              <a class="service-tag" href="${categoryLink}">${category}</a>
              ${svc.duration ? `<span class="service-tag tag-muted"><svg class="ic" aria-hidden="true"><use href="#i-clock"/></svg>Estimasi ${escapeHtml(svc.duration)}</span>` : ''}
            </div>

            <h1>${title}</h1>
            <p class="detail-desc">${description}</p>

            <div class="detail-price-box">
              <div>
                <span class="price-label">Mulai dari</span>
                <strong>${formatRupiah(svc.price)}</strong>
              </div>
              <small>Acuan awal — final menyesuaikan tingkat kesulitan, jumlah halaman, dan deadline.</small>
            </div>

            <ul class="detail-points">
              <li><span><svg class="ic" aria-hidden="true"><use href="#i-file"/></svg></span> Kirim instruksi tugas dan file pendukung lewat WhatsApp.</li>
              <li><span><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg></span> Harga &amp; deadline disepakati sebelum pengerjaan dimulai.</li>
              <li><span><svg class="ic" aria-hidden="true"><use href="#i-chat"/></svg></span> Progres pesanan diinformasikan lewat chat yang sama.</li>
            </ul>
          </div>
        </article>

        <aside class="consult-card">
          <h2>Konsultasi Sekarang</h2>
          <p class="consult-hint">
            Isi nama dan kebutuhanmu — pesan WhatsApp akan terisi otomatis
            dengan layanan, kategori, dan detail kebutuhan.
          </p>

          <form id="consultForm" novalidate>
            <div class="form-group">
              <label for="custName">Nama kamu</label>
              <input type="text" id="custName" name="name" maxlength="60" placeholder="Nama atau panggilan" autocomplete="name" required>
            </div>

            <div class="form-group">
              <label for="custPhone">Nomor WhatsApp <small>(opsional)</small></label>
              <input type="tel" id="custPhone" name="phone" maxlength="20" placeholder="08xxxxxxxxxx" autocomplete="tel" inputmode="tel">
            </div>

            <div class="form-group">
              <label for="custNeed">Kebutuhanmu</label>
              <textarea id="custNeed" name="need" rows="4" maxlength="600" placeholder="Contoh: laporan praktikum jaringan, 15 halaman, deadline Jumat depan" required></textarea>
            </div>

            <p class="form-error" id="consultError" hidden></p>

            <button type="submit" class="btn-wa btn-lg">Lanjut ke WhatsApp</button>

            <p class="consult-note">
              Belum mau isi form? <a href="${buildWaLink(waMessageForService(svc))}" target="_blank" rel="noopener">Chat langsung saja</a>.
            </p>
          </form>
        </aside>
      </div>
    `;

    initForm(svc);
  }

  function initForm(svc) {
    const form = document.getElementById('consultForm');
    if (!form) return;

    const nameInput = document.getElementById('custName');
    const phoneInput = document.getElementById('custPhone');
    const needInput = document.getElementById('custNeed');
    const errorEl = document.getElementById('consultError');

    // Ingat nama pelanggan di perangkat ini (bukan akun)
    const savedName = localStorage.getItem('ja_customer_name');
    if (savedName && nameInput) nameInput.value = savedName;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = (nameInput.value || '').trim();
      const phone = (phoneInput.value || '').trim();
      const need = (needInput.value || '').trim();

      if (!name || !need) {
        showError('Nama dan kebutuhan wajib diisi ya.');
        (!name ? nameInput : needInput).focus();
        return;
      }

      showError('');
      localStorage.setItem('ja_customer_name', name);

      const message = waMessageForService(svc, { name, phone, need });
      window.open(buildWaLink(message), '_blank', 'noopener');
    });

    function showError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.hidden = !msg;
    }
  }

  function renderState(iconId, title, message, withLink = false) {
    // Catatan harga tidak relevan saat layanan gagal dimuat.
    const note = document.querySelector('.detail-note');
    if (note) note.hidden = true;

    wrap.innerHTML = `
      <div class="state-block">
        <svg class="ic empty-icon" aria-hidden="true"><use href="#${iconId}"/></svg>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <a href="${withLink ? 'layanan.html' : 'index.html'}" class="btn-primary">
          ${withLink ? 'Lihat Katalog' : 'Ke Beranda'}
        </a>
      </div>
    `;
  }
});
