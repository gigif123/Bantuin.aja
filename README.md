# Bantuin.aja — Joki Tugas & Layanan Akademik

Website katalog + pemesanan lewat WhatsApp CS. Pelanggan **tidak perlu akun**;
hanya admin yang login untuk mencatat pesanan, pembayaran, dan progres.

Teknologi: HTML5, CSS3, JavaScript vanilla, Supabase (database + auth admin).

---

## 1. Struktur File

```
Bantuin.aja/
├── index.html              Landing page
├── layanan.html            Katalog + filter kategori
├── detail-layanan.html     Detail layanan (?id=) + form konsultasi
├── cara-pemesan.html       Alur pemesanan
├── kontak.html             Kontak + FAQ
├── login_admin.html        Login admin
├── admin.html              Dashboard admin
├── config/supabase.js      URL + anon key Supabase
├── css/
│   ├── style.css           Tema utama (putih–ungu)
│   ├── responsive.css      Penyesuaian mobile/tablet
│   ├── auth.css            Halaman login admin
│   └── dashboard.css       Layout dashboard admin
├── js/
│   ├── main.js             WA, navbar, helper, guard admin
│   ├── beranda.js          Kategori + layanan populer
│   ├── layanan.js          Katalog: cari, filter, urutkan
│   ├── detail-layanan.js   Detail + form → WhatsApp
│   ├── login_admin.js      Login admin
│   └── admin.js            Dashboard admin
├── database/
│   ├── 01_schema.sql             Tabel, RLS, storage
│   ├── 03_promote_admin.sql      Jadikan user Auth sebagai admin master
│   ├── 04_kategori_katalog.sql   6 kategori + 33 layanan
│   ├── 05_diagnosa_admin.sql     Cek konfirmasi email + status admin
│   └── 06_admin_management.sql   Kelola admin dari dashboard
└── assets/images/placeholder.svg
```

> `02_seed_services.sql` sudah tidak dipakai (digantikan `04_kategori_katalog.sql`).

---

## 2. Setup Supabase (sekali saja)

1. Buat project di [supabase.com](https://supabase.com).
2. **SQL Editor** → jalankan `database/01_schema.sql`.
3. **SQL Editor** → jalankan `database/04_kategori_katalog.sql`.
   File ini membuat tabel `categories`, mengisi 6 kategori + 33 layanan,
   dan menghapus 4 layanan seed lama.
4. Buat akun admin master di **Authentication → Users → Add user**:
   email `gif20zaril@gmail.com`, password, centang **Auto Confirm User**.
   Akun yang belum dikonfirmasi tidak bisa login.
5. **SQL Editor** → jalankan `database/03_promote_admin.sql`.
   File ini menjadikan email tersebut admin **master**.
6. **SQL Editor** → jalankan `database/06_admin_management.sql`.
   File ini mengaktifkan menu **Admin** di dashboard untuk mengelola admin lain.
7. Pastikan pendaftaran publik tetap **nonaktif**:
   Supabase → Authentication → Sign In / Providers → Email →
   *Allow new users to sign up* dimatikan.

Setelah setup, tambah admin baru lewat:

1. **Authentication → Users → Add user** (centang *Auto Confirm User*).
2. Login sebagai admin master → menu **Admin** → **+ Tambah Admin** →
   masukkan email akun Auth tadi.

Dashboard hanya memberi/mencabut akses admin; akun Auth tetap dibuat di
Supabase. Untuk menghapus akun sepenuhnya, hapus juga user di
**Authentication → Users**.

### Jika login admin gagal

1. Jalankan `database/05_diagnosa_admin.sql` di SQL Editor.
2. Perhatikan kolom `email_confirmed_at`, `terdaftar_admin`, dan `is_master`:
   - `email_confirmed_at` kosong → konfirmasi email user tersebut.
   - `terdaftar_admin` false → jalankan `database/03_promote_admin.sql`
     (pastikan email di file itu sama dengan email akun Auth).
   - `terdaftar_admin` true tapi `is_master` false → jalankan
     `database/03_promote_admin.sql` lalu `database/06_admin_management.sql`.
3. Pastikan halaman dibuka lewat server lokal, bukan `file://`:
   `python -m http.server 8000` dari folder `Bantuin.aja/`.

## 3. Konfigurasi

- **Nomor WhatsApp CS** → `js/main.js` baris `const WA_NUMBER = '62812...'`
  (format internasional, tanpa `+`, spasi, atau tanda hubung).
- **URL & anon key** → `config/supabase.js`.
- **Email kontak** → `kontak.html` dan footer `index.html`
  (cari `gif20zaril@gmail.com`).
- **Email admin master** → `MASTER_ADMIN_EMAIL` di `js/admin.js`, serta email
  di `database/03_promote_admin.sql` dan `database/06_admin_management.sql`.
  Ketiganya harus sama.
- **Testimoni** → `index.html` (ganti dengan ulasan asli bila sudah ada).

## 4. Alur Pelanggan

1. Buka katalog, pilih kategori/layanan.
2. Klik **Lihat Detail** → isi nama + kebutuhan → **Lanjut ke WhatsApp**.
3. Pesan WhatsApp otomatis berisi: nama, layanan, kategori, harga acuan,
   estimasi, dan deskripsi kebutuhan.
4. CS menyepakati harga + deadline, mengirim instruksi pembayaran.
5. Admin mencatat pesanan/pembayaran dan memperbarui status sampai selesai.

## 5. Dashboard Admin

Login lewat `login_admin.html`, lalu kelola semuanya dari `admin.html`:

| Menu | Fungsi |
| --- | --- |
| Dashboard | Statistik pesanan, pendapatan terkonfirmasi, pesanan aktif, pelanggan |
| Pesanan | Buat/edit pesanan, ubah status, lihat detail + riwayat |
| Pembayaran | Catat, edit, verifikasi, dan hapus pembayaran |
| Layanan | Tambah/edit/hapus layanan, atur harga mulai, estimasi, aktif/nonaktif |
| Kategori | Tambah/edit/hapus kategori, atur ikon, urutan, dan aktif/nonaktif |
| Pelanggan | Data kontak pelanggan (diisi CS, bukan akun pelanggan) |
| Admin | Khusus admin master: daftar admin, tambah/cabut akses admin |

Alur kerja CS:

1. Setelah harga + deadline disepakati di WhatsApp, buka **Pesanan → + Buat Pesanan**.
   Pilih pelanggan lama atau **+ Pelanggan baru** (nama + nomor WhatsApp).
2. Kirim instruksi pembayaran, lalu catat di **Pembayaran → + Catat Pembayaran**.
3. Pembayaran berstatus **Terkonfirmasi** otomatis memindahkan pesanan dari
   `baru`/`menunggu_pembayaran` ke `diproses`.
4. Perbarui progres lewat tombol **Status**:
   `baru → menunggu_pembayaran → diproses → revisi → selesai` (atau `dibatalkan`).
5. Tombol **Detail** menampilkan ringkasan kebutuhan, pembayaran, dan riwayat status.
   Dari sana, **Chat Pelanggan** membuka WhatsApp dengan pesan tindak lanjut
   berisi kode pesanan, layanan, status, dan deadline.
6. Di menu **Pelanggan**, tombol **Chat** juga tersedia untuk menyapa pelanggan
   tanpa menyalin nomor secara manual.

> Jika tabel `categories` belum ada atau nomor WhatsApp CS masih placeholder,
> dashboard menampilkan banner **Setup belum selesai** berisi langkah perbaikannya.
> Menu lain tetap bisa dipakai.

Catatan kategori:

- Mengganti nama kategori otomatis menyinkronkan label kategori pada layanan,
  sehingga katalog publik tidak menampilkan nama lama.
- Menghapus kategori tidak menghapus layanan; layanan terkait dipindahkan ke
  kategori “Lainnya” agar tidak muncul sebagai kategori hantu.
- Kategori yang dinonaktifkan disembunyikan dari landing/katalog beserta layanan
  yang terhubung ke kategori tersebut. Aktifkan kembali untuk menampilkannya.
- Sebelum `04_kategori_katalog.sql` dijalankan, halaman publik tetap memakai
  kategori yang terbaca dari data layanan (mode fallback).

## 6. Menjalankan Lokal

```bash
cd Bantuin.aja
python -m http.server 8000
```

Buka `http://localhost:8000`.

---

## Catatan Etika

Layanan difokuskan pada bantuan belajar, bimbingan, penyusunan bersama, dan
konsultasi akademik. Website secara eksplisit menyatakan **tidak mengerjakan
ujian** dan tidak mengklaim hasil pekerjaan sebagai karya mandiri pelanggan.
