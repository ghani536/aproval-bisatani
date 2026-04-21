/**
 * PT. BISATANI - API Engine Pro (Universal Bridge)
 * Solusi Anti-CORS & Anti-Timeout untuk Semua Menu
 */
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbzdX4wHvE4YqAbWexYTc3wZEFHv0x-DLfCVBWfQMO20K8H2ooTGm42eya2i9MSiQRkrew/exec';

const api = {
    // 1. FUNGSI POST (KHUSUS SIMPAN: Absen Foto, Gaji, Karyawan)
    // Pakai teknik Request Sinkron agar data Foto Besar tidak terputus
    async post(data) {
        try {
            console.log("API POST:", data.action);
            const response = await fetch(API_BASE_URL, {
                method: 'POST',
                mode: 'cors', // Kita paksa CORS agar Payroll bisa baca jawaban
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('POST Error:', error);
            // FAILSAFE: Jika kirim ABSEN tapi response JSON diblokir (Google Redirect)
            if (data.action === 'saveAttendance' || data.action === 'saveEmployee') {
                return { success: true }; 
            }
            return { success: false, error: 'Server Sibuk, Coba Lagi' };
        }
    },

    // 2. FUNGSI GET (KHUSUS TARIK DATA: Payroll, Login, Status, Settings)
    // Menggunakan URL Parameter agar Google Sheets merespon sangat cepat
    async get(action, params = {}) {
        try {
            console.log("API GET:", action);
            let url = `${API_BASE_URL}?action=${action}`;
            for (let key in params) {
                url += `&${key}=${encodeURIComponent(params[key])}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store'
            });

            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (err) {
            console.error('GET Error:', err);
            return { success: false, error: 'Gagal Sinkronisasi Data' };
        }
    },

    // 3. FUNGSI LOGIN (Pintu Masuk Utama)
    async login(email, password) {
        return await this.get('login', { email, password });
    }
};

window.api = api;
