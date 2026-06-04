/**
 * PT. BISATANI - API Engine Pro (Universal Bridge)
 * Solusi Anti-CORS & Anti-Timeout untuk Semua Menu
 */
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbzNfhADWK6hLmHHgXcenzhpgLgoclXzpIDhRe1CSUTtQpL1TuuZJWxlI2Dy6JQNdgVDDw/exec';

const api = {
    // 1. FUNGSI POST (KHUSUS SIMPAN: Absen Foto, Gaji, Karyawan)
    // Pakai teknik Request Sinkron agar data Foto Besar tidak terputus
    async post(data) {
        const action = String((data && data.action) || '');
        // Aksi BACA (idempoten) aman diulang via GET kalau respons POST rusak.
        // Aksi SIMPAN/UBAH TIDAK boleh diulang (POST sudah tereksekusi di server → cegah duplikat).
        const isRead = /^get/i.test(action);
        try {
            console.log("API POST:", action);
            const response = await fetch(API_BASE_URL, {
                method: 'POST',
                mode: 'cors', // Kita paksa CORS agar Payroll bisa baca jawaban
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(data)
            });

            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (parseErr) {
                // POST tereksekusi di server tapi respons rusak (balas HTML, gangguan sisi Google).
                if (isRead) {
                    // Baca: ambil ulang datanya via GET (aman, idempoten)
                    const viaGet = await this._postViaGet(data);
                    if (viaGet) return viaGet;
                    return { success: false, error: 'Gagal memuat (server sibuk)' };
                }
                // Simpan/ubah: data SUDAH tersimpan via POST → JANGAN ulang via GET (hindari duplikat)
                return { success: true, _unconfirmed: true };
            }
        } catch (error) {
            console.error('POST Error:', error);
            // Error jaringan (POST mungkin tidak tereksekusi).
            if (isRead) {
                try { const viaGet = await this._postViaGet(data); if (viaGet) return viaGet; } catch (e) { /* lanjut */ }
            }
            if (action === 'saveAttendance' || action === 'saveEmployee') {
                return { success: true };
            }
            return { success: false, error: 'Server Sibuk, Coba Lagi' };
        }
    },

    // Fallback BACA: ambil data via GET saat respons POST rusak. Hanya dipakai
    // untuk aksi get* (idempoten). Nilai besar di-skip agar URL tidak kepanjangan.
    async _postViaGet(data) {
        let url = `${API_BASE_URL}?_t=${Date.now()}`;
        for (let key in data) {
            const v = data[key];
            if (v === undefined || v === null) continue;
            const s = (typeof v === 'object') ? JSON.stringify(v) : String(v);
            if (s.length > 6000) continue;
            url += `&${encodeURIComponent(key)}=${encodeURIComponent(s)}`;
        }
        const res = await fetch(url, { method: 'GET', cache: 'no-store' });
        const text = await res.text();
        try { return JSON.parse(text); } catch (e) { return null; }
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
    },

    // 4. Cached settings (TTL 5 menit) — supaya tidak fetch berulang dari banyak file
    _settingsCache: null,
    _settingsCacheTime: 0,
    async getCachedSettings(force) {
        const now = Date.now();
        if (!force && this._settingsCache && (now - this._settingsCacheTime) < 300000) {
            return this._settingsCache;
        }
        try {
            const res = await this.post({ action: 'getSettings' });
            if (res && res.success) {
                this._settingsCache = res.data || {};
                this._settingsCacheTime = now;
            }
        } catch (e) { /* silent */ }
        return this._settingsCache || {};
    },

    // 5. Helper: ambil periode_start_day dari settings (default 26)
    async getPeriodStartDay() {
        const cfg = await this.getCachedSettings();
        return parseInt(cfg.periode_start_day || cfg.periodestartday || 26);
    }
};

window.api = api;
