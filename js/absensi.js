/**
 * Portal Karyawan - Absensi Engine PT. BISATANI
 * Versi: Optimized v2 (Date Tolerant + Foto Kecil + No Reload + Settings Cache + Progress Jelas)
 */
const absensi = {
    stream: null,
    location: null,
    locationName: "Mencari lokasi...",
    settingsCache: null,
    statusCache: null,
    SETTINGS_CACHE_KEY: 'bisatani_settings_v1',
    SETTINGS_TTL: 60 * 60 * 1000, // 1 jam
    STATUS_CACHE_KEY: 'bisatani_status_v1',

    async init() {
        this.loadSettingsFromLocalCache();
        this.loadStatusFromLocalCache();
        this.startCamera();
        this.getLocation();
        this.bindQuoteCounter();
        this.startLiveClock();

        // Render instant dari cache (kalau ada), lalu sync GAS di background
        if (this.statusCache !== null) {
            this.paintButtons();
            this.refreshFromServer();
        } else {
            await this.renderButtons();
        }
    },

    // Live clock + durasi sejak action terakhir
    startLiveClock() {
        if (this._clockTimer) return; // sudah jalan
        const tick = () => this.tickClock();
        tick();
        this._clockTimer = setInterval(tick, 1000);
    },

    tickClock() {
        const clockEl = document.getElementById('live-clock');
        const durEl = document.getElementById('live-duration');
        if (!clockEl && !durEl) return;

        const last = this.statusCache;
        const todayStr = this.todayStr();
        const lastDateStr = last ? this.normalizeDateStr(last.date || last.timestamp || last.timestampISO) : '';
        const isToday = lastDateStr === todayStr;
        const lastType = isToday && last ? (last.type || last.Tipe) : null;

        const tsStr = isToday && last ? (last.timestampISO || last.timestamp) : null;
        const ts = tsStr ? new Date(tsStr) : null;
        const now = new Date();

        // Aktif counting saat MASUK atau MULAI_LEMBUR
        const isCounting = (lastType === 'MASUK' || lastType === 'MULAI_LEMBUR') && ts && !isNaN(ts);

        if (isCounting) {
            const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
            const h = Math.floor(diffSec / 3600);
            const m = Math.floor((diffSec % 3600) / 60);
            const s = diffSec % 60;
            const txt = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
            if (clockEl) {
                clockEl.textContent = txt;
                clockEl.style.color = lastType === 'MASUK' ? '#10b981' : '#6366f1';
            }
            if (durEl) {
                if (lastType === 'MASUK') {
                    durEl.innerHTML = '<i class="fas fa-briefcase"></i> Sudah bekerja';
                    durEl.style.color = '#10b981';
                } else {
                    durEl.innerHTML = '<i class="fas fa-moon"></i> Sedang lembur';
                    durEl.style.color = '#6366f1';
                }
            }
        } else {
            // Timer tidak jalan: tampilkan dash
            if (clockEl) {
                clockEl.textContent = '--:--:--';
                clockEl.style.color = '#cbd5e1';
            }
            if (durEl) {
                if (!lastType) {
                    durEl.innerHTML = '<i class="far fa-clock"></i> Belum absen masuk';
                    durEl.style.color = '#94a3b8';
                } else if (lastType === 'PULANG') {
                    durEl.innerHTML = '<i class="fas fa-check-circle" style="color:#10b981;"></i> Sudah absen pulang';
                    durEl.style.color = '#64748b';
                } else if (lastType === 'SELESAI_LEMBUR') {
                    durEl.innerHTML = '<i class="fas fa-heart" style="color:#ef4444;"></i> Lembur selesai';
                    durEl.style.color = '#64748b';
                } else {
                    durEl.innerHTML = '<i class="far fa-clock"></i> ' + lastType;
                    durEl.style.color = '#94a3b8';
                }
            }
        }
    },

    bindQuoteCounter() {
        const ta = document.getElementById('absen-quote');
        const counter = document.getElementById('quote-counter');
        if (!ta || !counter || ta.dataset.bound === '1') return;
        ta.addEventListener('input', () => {
            counter.textContent = String(ta.value.length);
        });
        ta.dataset.bound = '1';
    },

    setQuoteWrapperVisible(show) {
        const w = document.getElementById('quote-wrapper');
        if (w) w.style.display = show ? 'block' : 'none';
    },

    updateQuoteLabel(lastType) {
        const labelEl = document.querySelector('#quote-wrapper label');
        const ta = document.getElementById('absen-quote');
        if (!labelEl || !ta) return;
        // Label sama untuk pagi & sore: "Quote (opsional)"
        labelEl.innerHTML = '<i class="fas fa-quote-left"></i> Quote (opsional)';
        if (lastType === 'MASUK') {
            ta.placeholder = 'Tulis quote favorit / mood sore kamu...';
            // Clear input (supaya tidak terbawa dari sesi pagi)
            if (ta.dataset.lastType !== lastType) {
                ta.value = '';
                const counter = document.getElementById('quote-counter');
                if (counter) counter.textContent = '0';
            }
        } else {
            ta.placeholder = 'Tulis quote favorit / mood pagi kamu...';
            if (ta.dataset.lastType !== 'null') {
                ta.value = '';
                const counter = document.getElementById('quote-counter');
                if (counter) counter.textContent = '0';
            }
        }
        ta.dataset.lastType = lastType || 'null';
    },

    loadSettingsFromLocalCache() {
        try {
            const raw = localStorage.getItem(this.SETTINGS_CACHE_KEY);
            if (!raw) return;
            const cached = JSON.parse(raw);
            if (Date.now() - cached.t < this.SETTINGS_TTL) {
                this.settingsCache = cached.data;
                console.log("Settings dimuat dari cache lokal");
            }
        } catch (e) {}
    },

    saveSettingsToLocalCache(data) {
        try {
            localStorage.setItem(this.SETTINGS_CACHE_KEY, JSON.stringify({
                t: Date.now(),
                data: data
            }));
        } catch (e) {}
    },

    statusCacheKeyForUser() {
        const uid = (window.auth && auth.user && auth.user.id) ? auth.user.id : 'anon';
        return this.STATUS_CACHE_KEY + ':' + uid;
    },

    loadStatusFromLocalCache() {
        try {
            const raw = localStorage.getItem(this.statusCacheKeyForUser());
            if (!raw) return;
            const cached = JSON.parse(raw);
            // Cache hanya valid kalau tanggal masih hari ini
            const today = this.todayStr();
            const cachedDate = this.normalizeDateStr(cached.date || cached.timestamp);
            if (cachedDate === today) {
                this.statusCache = cached;
                console.log("Status absen dimuat dari cache lokal:", cached.type);
            } else {
                // cache basi (hari sudah ganti), hapus
                localStorage.removeItem(this.statusCacheKeyForUser());
            }
        } catch (e) {}
    },

    saveStatusToLocalCache(status) {
        try {
            if (status) {
                localStorage.setItem(this.statusCacheKeyForUser(), JSON.stringify(status));
            }
        } catch (e) {}
    },

    async startCamera() {
        const video = document.getElementById('webcam-preview');
        if (!video) return;
        try {
            if (this.stream) this.stream.getTracks().forEach(t => t.stop());
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 480 } },
                audio: false
            });
            video.srcObject = this.stream;
        } catch (err) { console.error("Kamera error:", err); }
    },

    _gpsWatchId: null,
    _bestAccuracy: Infinity,

    setLocStatus(html, color) {
        const locText = document.getElementById('location-text');
        if (locText) {
            locText.innerHTML = html;
            locText.style.color = color || '#10b981';
        }
    },

    getLocation() {
        if (!navigator.geolocation) {
            this.setLocStatus('<i class="fas fa-times-circle"></i> Browser tidak support GPS', '#ef4444');
            return;
        }
        // Reset state
        this._bestAccuracy = Infinity;
        this.setLocStatus('<i class="fas fa-spinner fa-spin"></i> Mencari lokasi...', '#f59e0b');

        // 1) Quick getCurrentPosition (HIGH accuracy) — biar segera muncul perkiraan
        const opts = { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 };
        navigator.geolocation.getCurrentPosition(
            (pos) => this._handlePosition(pos),
            (err) => this._handleGpsError(err),
            opts
        );

        // 2) Watch position — terus update saat akurasi membaik / user pindah
        if (this._gpsWatchId !== null) {
            try { navigator.geolocation.clearWatch(this._gpsWatchId); } catch (e) {}
        }
        try {
            this._gpsWatchId = navigator.geolocation.watchPosition(
                (pos) => this._handlePosition(pos),
                () => { /* silent error - error sudah handled di getCurrentPosition */ },
                { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
            );
        } catch (e) {}
    },

    async _handlePosition(pos) {
        const acc = pos.coords.accuracy || 9999;
        // Skip kalau akurasi lebih buruk dari yang sudah ada
        if (acc >= this._bestAccuracy && this.location) return;
        this._bestAccuracy = acc;
        this.location = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc };

        // Status: tampilkan dengan akurasi
        const accLabel = acc < 50 ? `±${Math.round(acc)}m` : `±${Math.round(acc)}m (sedang menajamkan...)`;
        const accColor = acc < 50 ? '#10b981' : (acc < 200 ? '#f59e0b' : '#ef4444');
        this.setLocStatus(`<i class="fas fa-map-marker-alt"></i> <span id="loc-name">${this.locationName || 'Memuat alamat...'}</span> <small style="color:${accColor}; margin-left:6px;">${accLabel}</small>`, '#10b981');

        // Update nama lokasi (reverse geocoding) hanya 1x atau saat akurasi membaik signifikan
        if (!this.locationName || this.locationName === 'Mencari lokasi...' || this._lastGeocodeAcc > acc * 2) {
            await this.updateLocationName(this.location.lat, this.location.lng);
            const nameEl = document.getElementById('loc-name');
            if (nameEl) nameEl.textContent = this.locationName || 'Lokasi terdeteksi';
            this._lastGeocodeAcc = acc;
        }
    },

    _handleGpsError(err) {
        let msg = 'GPS error';
        let hint = '';
        switch (err && err.code) {
            case 1: // PERMISSION_DENIED
                msg = 'Izin lokasi ditolak';
                hint = 'Aktifkan di setting browser';
                break;
            case 2: // POSITION_UNAVAILABLE
                msg = 'Lokasi tidak terdeteksi';
                hint = 'Coba ke area terbuka';
                break;
            case 3: // TIMEOUT
                msg = 'GPS lambat / timeout';
                hint = 'Klik refresh di samping';
                break;
        }
        this.setLocStatus(
            `<i class="fas fa-times-circle"></i> ${msg} <small style="color:#94a3b8;">· ${hint}</small> ` +
            `<button onclick="absensi.getLocation()" style="background:#10b981; color:white; border:none; padding:3px 8px; border-radius:6px; cursor:pointer; font-size:11px; margin-left:6px;"><i class="fas fa-sync"></i> Coba lagi</button>`,
            '#ef4444'
        );
    },

    async updateLocationName(lat, lng) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            this.locationName = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch (e) { this.locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
    },

    normalizeDateStr(input) {
        if (!input) return '';
        const s = String(input).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
        const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) {
            return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
        }
        const d = new Date(s);
        if (!isNaN(d)) {
            return d.getFullYear() + '-' +
                   String(d.getMonth()+1).padStart(2,'0') + '-' +
                   String(d.getDate()).padStart(2,'0');
        }
        return '';
    },

    todayStr() {
        const now = new Date();
        return now.getFullYear() + "-" +
               String(now.getMonth() + 1).padStart(2, '0') + "-" +
               String(now.getDate()).padStart(2, '0');
    },

    async renderButtons() {
        const container = document.getElementById('attendance-btns');
        if (!container) return;
        container.innerHTML = '<div style="text-align:center; padding:10px;"><i class="fas fa-sync fa-spin"></i> Sinkronisasi Data...</div>';

        try {
            const fetches = [api.post({ action: 'getAttendanceStatus', userId: auth.user.id })];
            const needSettings = !this.settingsCache;
            if (needSettings) fetches.push(api.post({ action: 'getSettings' }));

            const results = await Promise.all(fetches);
            const statusRes = results[0];
            const settingsRes = needSettings ? results[1] : null;

            if (settingsRes && settingsRes.success) {
                this.settingsCache = settingsRes.data;
                this.saveSettingsToLocalCache(settingsRes.data);
            }
            this.statusCache = (statusRes && statusRes.success) ? statusRes.data : null;
            this.saveStatusToLocalCache(this.statusCache);

            this.paintButtons();
        } catch (e) {
            console.error("Render Error:", e);
            container.innerHTML = '<button onclick="location.reload()" class="btn-primary" style="width:100%; padding:15px;">Gagal Sinkron, Klik untuk Refresh</button>';
        }
    },

    // Background refresh: tarik data baru dari GAS tanpa block UI
    async refreshFromServer() {
        try {
            const fetches = [api.post({ action: 'getAttendanceStatus', userId: auth.user.id })];
            const needSettings = !this.settingsCache;
            if (needSettings) fetches.push(api.post({ action: 'getSettings' }));

            const results = await Promise.all(fetches);
            const statusRes = results[0];
            const settingsRes = needSettings ? results[1] : null;

            if (settingsRes && settingsRes.success) {
                this.settingsCache = settingsRes.data;
                this.saveSettingsToLocalCache(settingsRes.data);
            }

            if (statusRes && statusRes.success) {
                const fresh = statusRes.data;
                const cachedType = this.statusCache ? (this.statusCache.type || this.statusCache.Tipe) : null;
                const freshType = fresh ? (fresh.type || fresh.Tipe) : null;

                this.statusCache = fresh;
                this.saveStatusToLocalCache(fresh);

                // Repaint hanya kalau ada perubahan dari cache
                if (cachedType !== freshType) {
                    console.log("Status berubah:", cachedType, "->", freshType, "(repaint)");
                    this.paintButtons();
                }
            }
        } catch (e) {
            console.warn("Background sync gagal, pakai cache:", e);
        }
    },

    paintButtons() {
        const container = document.getElementById('attendance-btns');
        if (!container) return;

        const todayStr = this.todayStr();
        const lastData = this.statusCache;
        const rawDate = lastData ? (lastData.date || lastData.timestamp || lastData.Timestamp || '') : '';
        const lastDateNormalized = this.normalizeDateStr(rawDate);
        const isActionToday = (lastDateNormalized === todayStr);
        const lastType = isActionToday ? (lastData.type || lastData.Tipe) : null;

        const config = this.settingsCache || {};
        const now = new Date();
        const jamNow = now.getHours().toString().padStart(2, '0') + ":" +
                       now.getMinutes().toString().padStart(2, '0');

        // Prioritas: jam lembur personal karyawan -> global setting
        const personalJam = (auth.user && auth.user.jam_mulai_lembur) ? String(auth.user.jam_mulai_lembur).trim() : "";
        let rawJam = personalJam || config['jamlemburmin'] || config['jam_lembur_min'] || config['jammulailembur'] || config['jamkeluar'] || "17:00";
        let jamMinLembur = "17:00";
        const match = String(rawJam).match(/\d{1,2}:\d{2}/);
        if (match) {
            let [h, m] = match[0].split(':');
            jamMinLembur = h.padStart(2, '0') + ":" + m;
        }
        const sumberJam = personalJam ? "personal" : "global";

        console.log("--- DEBUG PT. BISATANI ---");
        console.log("Tanggal Hari Ini:", todayStr);
        console.log("Tanggal Absen Terakhir:", rawDate, "→", lastDateNormalized);
        console.log("Match Hari Ini:", isActionToday);
        console.log("Status Terakhir:", lastType);
        console.log("Jam Patokan Lembur:", jamMinLembur, "(sumber:", sumberJam + ")");

        // Quote wrapper muncul saat user akan absen MASUK ATAU saat user sudah MASUK (siap absen PULANG)
        // Sembunyikan saat sudah PULANG / lembur (sudah lewat momen tulis quote)
        const showQuote = !lastType || lastType === 'MASUK';
        this.setQuoteWrapperVisible(showQuote);
        // Update label sesuai konteks
        this.updateQuoteLabel(lastType);

        let html = '';

        if (!lastType) {
            html = `<button onclick="absensi.submit('MASUK')" class="btn-masuk" style="background:#10b981; color:white; width:100%; padding:15px; border:none; border-radius:12px; font-weight:bold; cursor:pointer;"><i class="fas fa-sign-in-alt"></i> ABSEN MASUK</button>`;
        }
        else if (lastType === 'SELESAI_LEMBUR') {
            html = `
                <div style="text-align:center; padding:20px; background:#f0f9ff; color:#0369a1; border-radius:12px; border: 1px solid #bae6fd;">
                    <i class="fas fa-heart" style="font-size:2rem; color:#0ea5e9; margin-bottom:10px;"></i><br>
                    <strong style="font-size:1.1rem;">Terima kasih sudah lembur!</strong><br>
                    <p style="margin-top:5px; font-size:0.9rem;">Selamat istirahat dan sampai jumpa esok hari.</p>
                </div>
            `;
        }
        else if (lastType === 'MASUK' || lastType === 'PULANG') {
            if (lastType === 'PULANG') {
                html += `<div style="text-align:center; padding:15px; background:#dcfce7; color:#166534; border-radius:12px; font-weight:600; margin-bottom:15px; border: 1px solid #bdfdc6;"><i class="fas fa-check-circle"></i> Tugas Utama Selesai</div>`;
            } else {
                html += `<button onclick="absensi.submit('PULANG')" class="btn-pulang" style="background:#f43f5e; color:white; width:100%; padding:15px; border:none; border-radius:12px; font-weight:bold; cursor:pointer; margin-bottom:10px;"><i class="fas fa-sign-out-alt"></i> ABSEN PULANG</button>`;
            }

            if (jamNow >= jamMinLembur) {
                html += `<button onclick="absensi.submit('MULAI_LEMBUR')" class="btn-lembur" style="background:#6366f1; color:white; width:100%; padding:15px; border:none; border-radius:12px; font-weight:bold; cursor:pointer;"><i class="fas fa-moon"></i> MULAI LEMBUR</button>`;
            } else {
                html += `<button disabled style="background:#cbd5e1; color:#94a3b8; width:100%; padding:15px; border:none; border-radius:12px; font-weight:bold; cursor:not-allowed;"><i class="fas fa-lock"></i> LEMBUR (Aktif ${jamMinLembur})</button>`;
            }
        }
        else if (lastType === 'MULAI_LEMBUR') {
            html = `<button onclick="absensi.submit('SELESAI_LEMBUR')" class="btn-selesai-lembur" style="background:#0ea5e9; color:white; width:100%; padding:15px; border:none; border-radius:12px; font-weight:bold; cursor:pointer;"><i class="fas fa-check-double"></i> SELESAI LEMBUR</button>`;
        }

        container.innerHTML = html;
    },

    setStatus(msg, color) {
        const container = document.getElementById('attendance-btns');
        if (!container) return;
        container.innerHTML = `<div style="text-align:center; padding:18px; background:${color || '#eff6ff'}; color:#1e40af; border-radius:12px; font-weight:600;">
            <i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>${msg}
        </div>`;
    },

    async submit(type) {
        if (!this.location) {
            alert("⚠️ GPS belum siap.\n\nSebab umum:\n- Browser belum dapat izin lokasi\n- Sinyal lemah (coba ke area terbuka)\n- Lokasi mati di pengaturan HP\n\nKlik 'Coba lagi' di samping lokasi, lalu tunggu sampai akurasi muncul.");
            // Retry GPS otomatis
            this.getLocation();
            return;
        }
        // Warning kalau akurasi sangat buruk (>500m) — biarkan tetap submit tapi konfirmasi
        if (this.location.accuracy && this.location.accuracy > 500) {
            if (!confirm(`⚠️ Akurasi GPS rendah (±${Math.round(this.location.accuracy)}m).\n\nLanjut absen pakai lokasi ini?`)) return;
        }

        this.setStatus("📷 Mengambil foto...");
        const image = this.captureImage();

        this.setStatus("📤 Mengirim data ke server...");

        try {
            const payload = {
                action: 'saveAttendance',
                userId: auth.user.id,
                userName: auth.user.name,
                type: type,
                location: this.locationName,
                image: image
            };
            // Quote ikut dikirim saat absen MASUK atau PULANG
            if (type === 'MASUK' || type === 'PULANG') {
                const ta = document.getElementById('absen-quote');
                payload.quote = ta ? ta.value.trim().substring(0, 200) : "";
            }
            await api.post(payload);

            this.setStatus("✅ Tersimpan!", "#dcfce7");

            this.statusCache = {
                date: this.todayStr(),
                type: type,
                timestamp: new Date().toISOString()
            };
            this.saveStatusToLocalCache(this.statusCache);

            setTimeout(() => this.paintButtons(), 700);

        } catch (e) {
            console.error("Submit error:", e);
            alert("❌ Gagal absen. Cek koneksi internet, lalu refresh halaman.");
            this.paintButtons();
        }
    },

    captureImage() {
        const video = document.getElementById('webcam-preview');
        if (!video) return "";
        const canvas = document.createElement('canvas');
        canvas.width = 240; canvas.height = 180;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 240, 180);
        return canvas.toDataURL('image/jpeg', 0.3);
    }
};
window.absensi = absensi;
