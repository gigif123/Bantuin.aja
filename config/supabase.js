// ============================================================
// Konfigurasi Supabase - Bantuin.aja
// Ganti nilai di bawah dengan kredensial proyek Supabase Anda
// ============================================================

const SUPABASE_URL = 'https://aozgnkpyhvyhtmhwtihn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvemdua3B5aHZ5aHRtaHd0aWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMjAyMTAsImV4cCI6MjEwODg5NjIxMH0.sQ56yxk4GO8VxLivTXMqN_ehxzstEPkIsiZotexrbvM';

// Inisialisasi client Supabase (diakses via window.supabase setelah CDN dimuat)
let supabaseClient = null;

function initSupabase() {
  if (typeof supabase !== 'undefined' && !supabaseClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

function getSupabase() {
  if (!supabaseClient) {
    initSupabase();
  }
  return supabaseClient;
}

// Ekspor agar bisa diakses dari file lain melalui window
window.supabaseConfig = {
  initSupabase,
  getSupabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
};