-- ============================================================
-- Bantuin.aja - KATEGORI & KATALOG JOKI TUGAS
-- Jalankan di Supabase > SQL Editor, SETELAH 01_schema.sql
-- ============================================================

-- ---------- Tabel kategori ----------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  icon        text,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.services
  add column if not exists category_id uuid references public.categories(id) on delete set null;

create index if not exists services_category_idx on public.services (category_id, is_active);

-- ---------- RLS kategori ----------
alter table public.categories enable row level security;

drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories
  for select to anon, authenticated using (is_active = true);

drop policy if exists "categories admin all" on public.categories;
create policy "categories admin all" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 6 kategori ----------
insert into public.categories (name, slug, icon, description, sort_order) values
  ('Joki Tugas', 'joki-tugas', '📝',
   'Bantuan mengerjakan tugas individu, kelompok, kuliah, sekolah, dan presentasi.', 1),
  ('Joki Laporan Praktikum', 'joki-laporan-praktikum', '🧪',
   'Penyusunan laporan praktikum berbagai bidang: informatika, jaringan, IoT, data, dan database.', 2),
  ('Layanan Penulisan', 'layanan-penulisan', '✍️',
   'Makalah, artikel, esai, paper, resume materi, dan rangkuman jurnal.', 3),
  ('Layanan Pemrograman', 'layanan-pemrograman', '💻',
   'Bantuan koding, perbaikan error, dan pembuatan proyek pemrograman.', 4),
  ('Presentasi & Dokumen', 'presentasi-dokumen', '📊',
   'Pembuatan dan desain PPT, dokumen Word, format laporan, serta perapian dokumen.', 5),
  ('Layanan Data', 'layanan-data', '📈',
   'Pengolahan, visualisasi, dan analisis data dengan Excel, Python, dan Pandas.', 6)
on conflict (slug) do nothing;

-- ---------- Bersihkan seed lama yang tidak sesuai konsep ----------
delete from public.services
where slug in ('bimbingan-akademik', 'konsultasi-profesional', 'les-privat', 'proofreading-editing');

-- ---------- Katalog layanan ----------
insert into public.services
  (title, slug, category, category_id, short_description, description, price, duration, image_url, sort_order)
select
  v.title, v.slug, v.category, c.id, v.short_desc, v.long_desc, v.price, v.duration,
  'assets/images/placeholder.svg', v.sort_order
from (values
  -- A. Joki Tugas
  ('Bantuan Tugas Individu', 'tugas-individu', 'Joki Tugas',
   'Bantuan mengerjakan tugas individu dengan pembahasan langkah demi langkah.',
   'Pendampingan penyelesaian tugas individu: kami bantu susun jawaban beserta pembahasan dan sumber rujukan, lalu kamu pelajari bersama pembimbing. Bukan pengerjaan ujian.',
   25000, '1-2 hari', 1),
  ('Bantuan Tugas Kelompok', 'tugas-kelompok', 'Joki Tugas',
   'Pembagian peran dan penyusunan hasil tugas kelompok yang rapi.',
   'Bantuan menyusun tugas kelompok: pembagian bagian, penyatuan hasil, dan perapian format agar siap dikumpulkan. Cocok untuk tugas proyek atau studi kasus.',
   50000, '2-3 hari', 2),
  ('Bantuan Tugas Kuliah', 'tugas-kuliah', 'Joki Tugas',
   'Bantuan tugas kuliah beserta penjelasan konsepnya.',
   'Bantuan mengerjakan tugas kuliah lintas mata kuliah dengan penjelasan konsep agar kamu memahami materinya, bukan sekadar menyalin jawaban.',
   35000, '1-3 hari', 3),
  ('Bantuan Tugas Sekolah', 'tugas-sekolah', 'Joki Tugas',
   'Bantuan PR dan tugas sekolah untuk jenjang SD hingga SMA.',
   'Pendampingan tugas sekolah (PR, proyek, laporan sederhana) dengan bahasa yang mudah dipahami siswa dan tetap mengikuti kaidah kejujuran akademik.',
   20000, '1-2 hari', 4),
  ('Bantuan Tugas Presentasi', 'tugas-presentasi', 'Joki Tugas',
   'Bahan dan naskah presentasi tugas, siap tampil.',
   'Penyusunan poin materi, naskah pembicara, dan slide pendukung untuk tugas presentasi, lengkap dengan saran cara menyampaikannya.',
   30000, '1-2 hari', 5),

  -- B. Joki Laporan Praktikum
  ('Laporan Praktikum Informatika', 'laporan-praktikum-informatika', 'Joki Laporan Praktikum',
   'Laporan praktikum informatika lengkap dengan pembahasan hasil.',
   'Penyusunan laporan praktikum informatika: tujuan, landasan teori, langkah kerja, hasil, dan pembahasan, mengikuti format modul kampusmu.',
   60000, '2-4 hari', 6),
  ('Laporan Praktikum Pemrograman', 'laporan-praktikum-pemrograman', 'Joki Laporan Praktikum',
   'Laporan praktikum pemrograman plus penjelasan kode.',
   'Laporan praktikum mata kuliah pemrograman: struktur kode, penjelasan algoritma, output program, dan analisis kesalahan.',
   65000, '2-4 hari', 7),
  ('Laporan Praktikum Jaringan Komputer', 'laporan-praktikum-jaringan', 'Joki Laporan Praktikum',
   'Laporan praktikum jaringan dengan dokumentasi topologi.',
   'Penyusunan laporan praktikum jaringan komputer: topologi, konfigurasi, hasil pengujian (ping/traceroute), dan analisis, termasuk dokumentasi gambar.',
   70000, '3-4 hari', 8),
  ('Laporan Praktikum Elektronika dan IoT', 'laporan-praktikum-iot', 'Joki Laporan Praktikum',
   'Laporan praktikum elektronika dan IoT dengan rangkaian serta data sensor.',
   'Laporan praktikum elektronika dan IoT: skema rangkaian, kode mikrokontroler, data pembacaan sensor, dan pembahasan hasil pengujian.',
   75000, '3-5 hari', 9),
  ('Laporan Praktikum Data Science', 'laporan-praktikum-data-science', 'Joki Laporan Praktikum',
   'Laporan praktikum Data Science dengan visualisasi hasil.',
   'Laporan praktikum Data Science: dataset, praproses, model, evaluasi, dan visualisasi hasil, disusun runtut sesuai format modul.',
   75000, '3-5 hari', 10),
  ('Laporan Praktikum Database', 'laporan-praktikum-database', 'Joki Laporan Praktikum',
   'Laporan praktikum database dengan ERD dan query.',
   'Laporan praktikum database: perancangan ERD, normalisasi, query SQL, dan pembahasan hasil pengujian, siap dilampirkan.',
   65000, '2-4 hari', 11),

  -- C. Layanan Penulisan
  ('Makalah', 'makalah', 'Layanan Penulisan',
   'Makalah lengkap dengan struktur dan daftar pustaka.',
   'Penyusunan makalah: latar belakang, rumusan masalah, pembahasan, kesimpulan, dan daftar pustaka sesuai gaya sitasi kampusmu.',
   75000, '3-5 hari', 12),
  ('Artikel', 'artikel', 'Layanan Penulisan',
   'Artikel populer maupun ilmiah sesuai kebutuhan.',
   'Penulisan artikel populer atau ilmiah dengan gaya bahasa yang disesuaikan, dilengkapi referensi pendukung.',
   60000, '2-4 hari', 13),
  ('Esai', 'esai', 'Layanan Penulisan',
   'Esai argumentatif dengan alur gagasan yang kuat.',
   'Penulisan esai argumentatif/reflektif: tesis, pengembangan argumen, dan kesimpulan yang runtut, plus penyuntingan bahasa.',
   40000, '2-3 hari', 14),
  ('Paper', 'paper', 'Layanan Penulisan',
   'Paper ilmiah dengan kajian pustaka dan sitasi.',
   'Penyusunan paper ilmiah: abstrak, pendahuluan, kajian pustaka, metode, pembahasan, dan daftar pustaka dengan sitasi yang konsisten.',
   100000, '3-6 hari', 15),
  ('Resume Materi', 'resume-materi', 'Layanan Penulisan',
   'Ringkasan materi kuliah yang padat dan mudah dibaca.',
   'Penyusunan resume materi dari slide, buku, atau catatan kuliah: poin penting, tabel perbandingan, dan peta konsep.',
   35000, '1-3 hari', 16),
  ('Rangkuman Jurnal', 'rangkuman-jurnal', 'Layanan Penulisan',
   'Rangkuman jurnal dengan identifikasi metode dan temuan.',
   'Rangkuman 1-3 jurnal: tujuan penelitian, metode, temuan, dan keterbatasan, disajikan dalam format tabel agar mudah dibandingkan.',
   45000, '2-3 hari', 17),

  -- D. Layanan Pemrograman
  ('HTML, CSS & JavaScript', 'pemrograman-web', 'Layanan Pemrograman',
   'Landing page, web app sederhana, atau perbaikan tampilan.',
   'Bantuan pembuatan halaman web dengan HTML, CSS, dan JavaScript: layout responsif, interaksi dasar, dan struktur kode yang rapi.',
   100000, '3-5 hari', 18),
  ('Python', 'pemrograman-python', 'Layanan Pemrograman',
   'Script Python untuk tugas, otomasi, atau proyek kecil.',
   'Bantuan penulisan program Python: struktur data, fungsi, file handling, dan pustaka umum, disertai penjelasan alur kode.',
   120000, '3-5 hari', 19),
  ('Java', 'pemrograman-java', 'Layanan Pemrograman',
   'Program Java berbasis OOP untuk tugas kuliah.',
   'Bantuan program Java: class, inheritance, koleksi, dan koneksi database, lengkap dengan komentar penjelas.',
   130000, '3-6 hari', 20),
  ('C++', 'pemrograman-cpp', 'Layanan Pemrograman',
   'Program C++ untuk tugas struktur data dan algoritma.',
   'Bantuan program C++: pointer, struct, sorting, dan struktur data dasar, dengan pembahasan logika di tiap bagian.',
   130000, '3-6 hari', 21),
  ('SQL & Database', 'pemrograman-sql', 'Layanan Pemrograman',
   'Perancangan database dan query SQL yang efisien.',
   'Bantuan membuat skema, relasi, dan query SQL (join, agregasi, subquery) beserta penjelasan hasilnya.',
   110000, '2-5 hari', 22),
  ('Debugging & Perbaikan Kode', 'debugging-kode', 'Layanan Pemrograman',
   'Telusuri error dan perbaiki kode yang bermasalah.',
   'Analisis kode yang error: menemukan penyebab, memperbaiki bug, dan menjelaskan solusinya agar tidak terulang.',
   75000, '1-3 hari', 23),

  -- E. Presentasi & Dokumen
  ('Pembuatan PPT', 'pembuatan-ppt', 'Presentasi & Dokumen',
   'Slide presentasi rapi sesuai materi yang kamu berikan.',
   'Pembuatan slide PPT dari materi yang kamu kirim: struktur poin, tata letak konsisten, dan visual pendukung.',
   50000, '1-3 hari', 24),
  ('Desain Presentasi', 'desain-presentasi', 'Presentasi & Dokumen',
   'Perombakan desain slide agar lebih profesional.',
   'Desain ulang slide yang sudah ada: pemilihan warna, tipografi, ikon, dan infografis sederhana agar tampil profesional.',
   75000, '2-3 hari', 25),
  ('Pembuatan Dokumen Word', 'dokumen-word', 'Presentasi & Dokumen',
   'Dokumen Word lengkap dengan format standar.',
   'Penyusunan dokumen Word: heading otomatis, daftar isi, tabel, caption, dan penomoran halaman sesuai pedoman.',
   40000, '1-3 hari', 26),
  ('Format Laporan', 'format-laporan', 'Presentasi & Dokumen',
   'Penyesuaian format laporan ke pedoman kampus.',
   'Perapian format laporan: margin, spasi, penomoran bab, daftar tabel/gambar, dan sitasi agar sesuai pedoman kampus.',
   35000, '1-2 hari', 27),
  ('Perapian Dokumen', 'perapian-dokumen', 'Presentasi & Dokumen',
   'Rapikan dokumen berantakan jadi siap cetak.',
   'Perapian dokumen: konsistensi gaya huruf, jarak, tabel, gambar, dan penomoran, plus pemeriksaan salah ketik ringan.',
   30000, '1-2 hari', 28),

  -- F. Layanan Data
  ('Pengolahan Data', 'pengolahan-data', 'Layanan Data',
   'Bersihkan dan siapkan data mentah untuk dianalisis.',
   'Pengolahan data mentah: pembersihan, penggabungan, dan penyusunan tabel siap analisis, disertai dokumentasi langkah.',
   60000, '2-4 hari', 29),
  ('Excel', 'layanan-excel', 'Layanan Data',
   'Rumus, pivot, dan dashboard Excel sederhana.',
   'Bantuan Excel: rumus lanjutan, pivot table, grafik, dan dashboard ringkas untuk kebutuhan tugas maupun kerja.',
   50000, '1-3 hari', 30),
  ('Python Pandas', 'python-pandas', 'Layanan Data',
   'Analisis data dengan Pandas, dari impor sampai ringkasan.',
   'Pengolahan data dengan Python Pandas: impor file, filtering, groupby, merge, dan ekspor hasil, lengkap dengan notebook.',
   90000, '2-4 hari', 31),
  ('Visualisasi Data', 'visualisasi-data', 'Layanan Data',
   'Grafik dan dashboard yang komunikatif.',
   'Pembuatan visualisasi data dengan Matplotlib, Seaborn, atau Excel: pemilihan grafik yang tepat dan tata letak yang mudah dibaca.',
   80000, '2-4 hari', 32),
  ('Analisis Data Dasar', 'analisis-data-dasar', 'Layanan Data',
   'Analisis deskriptif dan interpretasi hasil.',
   'Analisis data dasar: statistik deskriptif, pola awal, dan interpretasi hasil dalam bahasa sederhana, siap dipakai untuk laporan.',
   100000, '3-5 hari', 33)
) as v(title, slug, category, short_desc, long_desc, price, duration, sort_order)
join public.categories c on c.name = v.category
on conflict (slug) do update set
  title             = excluded.title,
  category          = excluded.category,
  category_id       = excluded.category_id,
  short_description = excluded.short_description,
  description       = excluded.description,
  price             = excluded.price,
  duration          = excluded.duration,
  sort_order        = excluded.sort_order,
  updated_at        = now();

-- ---------- Verifikasi ----------
select c.name as kategori, count(s.id) as jumlah_layanan
from public.categories c
left join public.services s on s.category_id = c.id and s.is_active = true
group by c.name, c.sort_order
order by c.sort_order;
