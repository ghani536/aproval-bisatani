/**
 * Portal Karyawan - Live Streamer (Tahap A)
 * Absen sesi live: mulai/selesai, pilih toko/lokasi/co-host, input closing + quote.
 */
const liveStreamer = {
    stream: null,
    location: null,
    locationName: 'Mencari lokasi...',
    _bestAcc: Infinity,
    _gpsWatchId: null,
    _clockTimer: null,
    toko: [],
    cohosts: [],
    sessions: [],
    active: null,

    _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    _actor() {
        const u = (typeof auth !== 'undefined' && auth.user) || {};
        return { actor_id: u.id || '', actor_name: u.name || u.nama || '' };
    },
    _bulanIni() {
        const n = new Date();
        return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
    },

    async init() {
        this.startCamera();
        this.getLocation();
        this.startClock();
        await Promise.all([this._loadToko(), this._loadCohosts()]);
        this.refresh();
    },

    // ---------- KAMERA ----------
    async startCamera() {
        try {
            // Stop kamera lain (mis. absensi) agar tidak rebutan device
            if (typeof absensi !== 'undefined' && absensi.stream) {
                try { absensi.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
            }
            if (this.stream) { try { this.stream.getTracks().forEach(t => t.stop()); } catch (e) {} }
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            this.stream = s;
            const v = document.getElementById('live-webcam');
            if (v) v.srcObject = s;
        } catch (e) {
            const v = document.getElementById('live-webcam');
            if (v) v.parentElement.innerHTML = '<div style="color:#fff;text-align:center;padding-top:80px;font-size:13px;">Kamera tidak aktif<br>Izinkan akses kamera</div>';
        }
    },
    stopCamera() {
        if (this.stream) { try { this.stream.getTracks().forEach(t => t.stop()); } catch (e) {} this.stream = null; }
    },
    captureImage() {
        const video = document.getElementById('live-webcam');
        if (!video || !video.videoWidth) return { thumb: '' };
        const c = document.createElement('canvas');
        c.width = 240; c.height = 180;
        const ctx = c.getContext('2d');
        ctx.translate(c.width, 0); ctx.scale(-1, 1); // un-mirror
        ctx.drawImage(video, 0, 0, c.width, c.height);
        return { thumb: c.toDataURL('image/jpeg', 0.5) };
    },

    // ---------- GPS ----------
    _parseDT(s) {
        if (!s) return null;
        const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
        if (!m) { const d = new Date(s); return isNaN(d) ? null : d; }
        return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    },
    // Timer = durasi sesi yang sedang berlangsung. Sebelum mulai live: 00:00:00.
    startClock() {
        if (this._clockTimer) clearInterval(this._clockTimer);
        const tick = () => {
            const el = document.getElementById('live-clock-2');
            if (!el) return;
            const start = this.active && this.active.mulai_jam ? this._parseDT(this.active.mulai_jam) : null;
            if (start) {
                let sec = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
                const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
                el.textContent = [h, m, s].map(x => String(x).padStart(2, '0')).join(':');
                el.style.color = '#ef4444';
            } else {
                el.textContent = '00:00:00';
                el.style.color = '#1e293b';
            }
        };
        tick();
        this._clockTimer = setInterval(tick, 1000);
    },

    // Home khusus streamer: ringkasan performa live (sesi hari ini + total bulan berjalan)
    async renderHome() {
        const page = document.getElementById('page-dashboard');
        if (!page) return;
        let host = document.getElementById('live-home');
        if (!host) {
            host = document.createElement('div'); host.id = 'live-home';
            const anchor = document.getElementById('emp-welcome-card');
            if (anchor) page.insertBefore(host, anchor); else page.insertBefore(host, page.firstChild);
        }
        host.style.display = 'block';
        host.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat performa live...</div>';

        const a = this._actor();
        let sessions = [];
        try {
            const res = await api.post({ action: 'getMyLiveSessions', userId: a.actor_id, actor_id: a.actor_id, bulan: this._bulanIni() });
            sessions = (res && res.success) ? (res.data || []) : [];
        } catch (e) {}
        this.sessions = sessions;
        this.active = sessions.find(s => String(s.status).toUpperCase() === 'BERLANGSUNG') || null;

        const n = new Date();
        const today = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
        const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][n.getMonth()];
        const todaySessions = sessions.filter(s => s.tanggal === today);
        const bySesi = {}; todaySessions.forEach(s => { bySesi[String(s.sesi)] = s; });
        const done = sessions.filter(s => String(s.status).toUpperCase() === 'SELESAI');
        let totClosing = 0, totKomisi = 0, totMenit = 0;
        done.forEach(s => { totClosing += Number(s.jumlah_closing) || 0; totKomisi += Number(s.komisi_host) || 0; totMenit += Number(s.durasi_menit) || 0; });
        const closingHariIni = todaySessions.reduce((x, s) => x + (Number(s.jumlah_closing) || 0), 0);
        const nama = (auth.user && (auth.user.name || auth.user.nama) || 'Streamer').split(' ')[0];

        const sesiRows = ['1', '2', '3'].map(num => {
            const s = bySesi[num];
            const isCadangan = num === '3';
            if (!s) {
                return `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #f1f5f9;">
                    <div style="font-size:13px;color:#94a3b8;">Sesi ${num}${isCadangan ? ' (pengganti)' : ''}</div>
                    <div style="font-size:12px;color:#cbd5e1;">belum live</div></div>`;
            }
            const berlangsung = String(s.status).toUpperCase() === 'BERLANGSUNG';
            const badge = berlangsung
                ? '<span style="font-size:10px;background:#fee2e2;color:#b91c1c;padding:1px 7px;border-radius:4px;">LIVE</span>'
                : (String(s.disetujui).toUpperCase() === 'APPROVED' ? '<span style="font-size:10px;background:#dcfce7;color:#15803d;padding:1px 7px;border-radius:4px;">ACC</span>' : '<span style="font-size:10px;background:#fef9c3;color:#a16207;padding:1px 7px;border-radius:4px;">menunggu</span>');
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #f1f5f9;">
                <div>
                    <div style="font-size:13px;font-weight:600;color:#1e293b;">Sesi ${num} · ${this._esc(s.toko)}</div>
                    <div style="font-size:11px;color:#64748b;">${this._esc(s.lokasi_tipe)}${berlangsung ? '' : ' · ' + this._fmtDur(s.durasi_menit)}${s.cohost_nama ? ' · co: ' + this._esc(s.cohost_nama) : ''}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:15px;font-weight:700;color:#0f766e;">${berlangsung ? '—' : (Number(s.jumlah_closing) || 0)}<small style="font-size:10px;color:#94a3b8;font-weight:500;"> closing</small></div>
                    ${badge}
                </div></div>`;
        }).join('');

        host.innerHTML = `
        <div style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;padding:18px 20px;border-radius:14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div style="flex:1;min-width:0;">
                <h2 style="margin:0;font-size:18px;">Halo, ${this._esc(nama)}! 📹</h2>
                <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">Ringkasan performa live ${namaBulan}</p>
            </div>
            <div style="font-size:40px;opacity:0.9;flex-shrink:0;"><i class="fas fa-video"></i></div>
        </div>

        <div style="display:flex;gap:10px;margin-bottom:14px;">
            <div style="flex:1;background:#fff;border-radius:12px;padding:14px;text-align:center;">
                <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Closing Hari Ini</div>
                <div style="font-size:26px;font-weight:800;color:#ef4444;margin-top:4px;">${closingHariIni}</div>
            </div>
            <div style="flex:1;background:#fff;border-radius:12px;padding:14px;text-align:center;">
                <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Sesi Hari Ini</div>
                <div style="font-size:26px;font-weight:800;color:#1e293b;margin-top:4px;">${todaySessions.length}<small style="font-size:12px;color:#94a3b8;font-weight:500;">/3</small></div>
            </div>
        </div>

        <div style="background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:14px;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:6px;"><i class="fas fa-list-ol" style="color:#ef4444;"></i> Sesi Hari Ini</div>
            ${sesiRows}
            <button onclick="router.navigate('live-streamer')" style="width:100%;margin-top:12px;background:#ef4444;color:#fff;border:none;padding:11px;border-radius:10px;cursor:pointer;font-weight:700;font-size:14px;"><i class="fas fa-video"></i> Buka Absen Live</button>
        </div>

        <div style="background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border-radius:12px;padding:16px;margin-bottom:14px;">
            <div style="font-size:11px;opacity:0.9;font-weight:700;text-transform:uppercase;margin-bottom:10px;"><i class="fas fa-chart-line"></i> Total Bulan ${namaBulan}</div>
            <div style="display:flex;justify-content:space-between;gap:8px;text-align:center;">
                <div style="flex:1;"><div style="font-size:22px;font-weight:800;">${totClosing}</div><div style="font-size:10px;opacity:0.85;">Closing</div></div>
                <div style="flex:1;"><div style="font-size:22px;font-weight:800;">${this._fmtDur(totMenit)}</div><div style="font-size:10px;opacity:0.85;">Durasi</div></div>
                <div style="flex:1;"><div style="font-size:18px;font-weight:800;">Rp ${totKomisi.toLocaleString('id-ID')}</div><div style="font-size:10px;opacity:0.85;">Komisi (bagian saya)</div></div>
            </div>
        </div>`;
    },
    _setLoc(html, color) {
        const el = document.getElementById('live-loc-text');
        if (el) { el.innerHTML = html; el.style.color = color || '#10b981'; }
    },
    getLocation() {
        if (!navigator.geolocation) { this._setLoc('<i class="fas fa-times-circle"></i> Browser tidak support GPS', '#ef4444'); return; }
        this._bestAcc = Infinity;
        this._setLoc('<i class="fas fa-spinner fa-spin"></i> Mencari lokasi...', '#f59e0b');
        const opts = { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 };
        navigator.geolocation.getCurrentPosition(p => this._onPos(p), e => this._onGpsErr(e), opts);
        if (this._gpsWatchId !== null) { try { navigator.geolocation.clearWatch(this._gpsWatchId); } catch (e) {} }
        try {
            this._gpsWatchId = navigator.geolocation.watchPosition(p => this._onPos(p), () => {}, { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 });
        } catch (e) {}
    },
    async _onPos(pos) {
        const acc = pos.coords.accuracy || 9999;
        if (acc >= this._bestAcc && this.location) return;
        this._bestAcc = acc;
        this.location = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc };
        const accLabel = '±' + Math.round(acc) + 'm';
        this._setLoc(`<i class="fas fa-map-marker-alt"></i> <span id="live-loc-name">${this._esc(this.locationName)}</span> <small style="color:#94a3b8;">${accLabel}</small>`, '#10b981');
        if (this._needGeocode()) {
            const ok = await this._geocode(this.location.lat, this.location.lng);
            const nm = document.getElementById('live-loc-name');
            if (nm) nm.textContent = this.locationName;
            if (ok) this._lastGeoAcc = acc;
        }
    },
    _onGpsErr(err) {
        let msg = 'GPS error';
        if (err && err.code === 1) msg = 'Izin lokasi ditolak';
        else if (err && err.code === 2) msg = 'Lokasi tidak terdeteksi';
        else if (err && err.code === 3) msg = 'GPS lambat / timeout';
        this._setLoc(`<i class="fas fa-times-circle"></i> ${msg} <button onclick="liveStreamer.getLocation()" style="background:#10b981;color:#fff;border:none;padding:3px 8px;border-radius:6px;cursor:pointer;font-size:11px;margin-left:6px;"><i class="fas fa-sync"></i> Coba lagi</button>`, '#ef4444');
    },
    _isPlaceholder(s) {
        const t = String(s || '').trim();
        return !t || t === 'Mencari lokasi...' || t === 'Memuat alamat...' || t === 'Lokasi terdeteksi';
    },
    _needGeocode() {
        if (this._isPlaceholder(this.locationName)) return true;
        return /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(this.locationName);
    },
    async _geocode(lat, lng) {
        const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 7000);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`, { signal: ctrl.signal, headers: { 'Accept-Language': 'id' } });
            if (!res.ok) throw new Error('http ' + res.status);
            const data = await res.json();
            const a = data.address || {};
            const parts = [a.road || a.hamlet || a.neighbourhood, a.village || a.suburb || a.town, a.city_district || a.municipality, a.county || a.city || a.regency];
            const seen = {}; const out = [];
            parts.forEach(p => { if (p && !seen[p]) { seen[p] = 1; out.push(p); } });
            const name = out.slice(0, 3).join(', ') || data.display_name;
            if (name) { this.locationName = name; return true; }
            this.locationName = coordStr; return false;
        } catch (e) { this.locationName = coordStr; return false; }
        finally { clearTimeout(timer); }
    },
    _locStr() {
        if (!this.location) return '';
        return this._isPlaceholder(this.locationName) ? `${this.location.lat.toFixed(6)}, ${this.location.lng.toFixed(6)}` : this.locationName;
    },

    // ---------- LOADERS ----------
    async _loadToko() {
        try {
            const res = await api.post({ action: 'getLiveToko', activeOnly: true });
            if (res && res.success) this.toko = res.data || [];
        } catch (e) {}
    },
    async _loadCohosts() {
        try {
            const a = this._actor();
            const res = await api.post({ action: 'getLiveStreamers', actor_id: a.actor_id });
            if (res && res.success) this.cohosts = (res.data || []).filter(c => String(c.id) !== String(a.actor_id));
        } catch (e) {}
    },
    async refresh() {
        const a = this._actor();
        const wrap = document.getElementById('live-content');
        try {
            const res = await api.post({ action: 'getMyLiveSessions', userId: a.actor_id, actor_id: a.actor_id, bulan: this._bulanIni() });
            this.sessions = (res && res.success) ? (res.data || []) : [];
        } catch (e) { this.sessions = []; }
        this.active = this.sessions.find(s => String(s.status).toUpperCase() === 'BERLANGSUNG') || null;
        if (this.active) this._renderSelesai(); else this._renderMulai();
        this._renderHistory();
    },

    // ---------- RENDER: MULAI ----------
    _renderMulai() {
        const wrap = document.getElementById('live-content');
        if (!this.toko.length) {
            wrap.innerHTML = '<div style="background:#fef3c7;color:#92400e;padding:14px;border-radius:10px;text-align:center;font-size:13px;">Belum ada toko aktif. Hubungi admin untuk menambah toko.</div>';
            return;
        }
        const tokoOpts = this.toko.map(t => `<option value="${this._esc(t.nama_toko)}" data-platform="${this._esc(t.platform)}">${this._esc(t.nama_toko)}${t.platform ? ' (' + this._esc(t.platform) + ')' : ''}</option>`).join('');
        const cohostOpts = '<option value="">— tanpa co-host —</option>' + this.cohosts.map(c => `<option value="${this._esc(c.id)}">${this._esc(c.name)}</option>`).join('');
        wrap.innerHTML = `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
            <h4 style="margin:0 0 14px;color:#16a34a;"><i class="fas fa-play-circle"></i> Mulai Sesi Live</h4>
            <label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:4px;">Sesi</label>
            <select id="ls-sesi" style="width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;">
                <option value="1">Sesi 1</option><option value="2">Sesi 2</option><option value="3">Sesi 3 (pengganti/libur)</option>
            </select>
            <label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:4px;">Toko</label>
            <select id="ls-toko" style="width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;">${tokoOpts}</select>
            <label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:6px;">Lokasi</label>
            <div style="display:flex;gap:8px;margin-bottom:12px;">
                <label style="flex:1;text-align:center;padding:9px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;"><input type="radio" name="ls-lokasi" value="KANTOR" checked> Kantor</label>
                <label style="flex:1;text-align:center;padding:9px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;"><input type="radio" name="ls-lokasi" value="RUMAH"> Rumah</label>
            </div>
            <label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:4px;">Co-host (opsional)</label>
            <select id="ls-cohost" style="width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;">${cohostOpts}</select>
            <label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:4px;">Quote Awal (opsional)</label>
            <textarea id="ls-quote-mulai" rows="2" maxlength="200" placeholder="mis. target hari ini 20 closing" style="width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px;font-family:inherit;font-size:13px;resize:vertical;"></textarea>
            <button id="ls-start-btn" onclick="liveStreamer.doStart()" style="width:100%;background:#16a34a;color:#fff;border:none;padding:13px;border-radius:10px;cursor:pointer;font-weight:700;font-size:15px;"><i class="fas fa-video"></i> Mulai Live</button>
        </div>`;
    },

    async doStart() {
        if (!this.location) { alert('⚠️ GPS belum siap. Tunggu lokasi muncul lalu coba lagi.'); this.getLocation(); return; }
        const sesi = document.getElementById('ls-sesi').value;
        const toko = document.getElementById('ls-toko').value;
        const tokoEl = document.getElementById('ls-toko');
        const platform = tokoEl.options[tokoEl.selectedIndex] ? (tokoEl.options[tokoEl.selectedIndex].getAttribute('data-platform') || '') : '';
        const lokasiEl = document.querySelector('input[name="ls-lokasi"]:checked');
        const lokasi = lokasiEl ? lokasiEl.value : 'KANTOR';
        const cohost = document.getElementById('ls-cohost').value;
        const quote = document.getElementById('ls-quote-mulai').value.trim().substring(0, 200);
        const img = this.captureImage();
        const a = this._actor();
        const btn = document.getElementById('ls-start-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...'; }
        try {
            const res = await api.post({
                action: 'startLiveSession', actor_id: a.actor_id, actor_name: a.actor_name,
                sesi: sesi, toko: toko, platform: platform, lokasi_tipe: lokasi, cohost_userId: cohost,
                quote_mulai: quote, lat: this.location.lat, lng: this.location.lng, location: this._locStr(), thumbnail: img.thumb
            });
            if (res && res.success) this.refresh();
            else { alert('❌ ' + ((res && res.error) || 'gagal mulai live')); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-video"></i> Mulai Live'; } }
        } catch (e) { alert('❌ Error: ' + e.message); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-video"></i> Mulai Live'; } }
    },

    // ---------- RENDER: SELESAI ----------
    _renderSelesai() {
        const s = this.active;
        const wrap = document.getElementById('live-content');
        wrap.innerHTML = `
        <div style="background:#fff;border:2px solid #ef4444;border-radius:12px;padding:16px;">
            <div style="display:inline-block;background:#fee2e2;color:#b91c1c;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-bottom:10px;"><i class="fas fa-circle" style="font-size:8px;animation:none;"></i> LIVE BERLANGSUNG</div>
            <div style="font-size:13px;color:#475569;margin-bottom:14px;line-height:1.7;">
                <b>Sesi ${this._esc(s.sesi)}</b> · ${this._esc(s.toko)}${s.platform ? ' (' + this._esc(s.platform) + ')' : ''}<br>
                Lokasi: <b>${this._esc(s.lokasi_tipe)}</b> · Mulai: ${this._esc(s.mulai_jam).substring(11, 16)}
                ${s.cohost_nama ? '<br>Co-host: <b>' + this._esc(s.cohost_nama) + '</b> (komisi dibagi 2)' : ''}
            </div>
            <label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:4px;">Jumlah Closing</label>
            <input type="number" id="ls-closing" min="0" value="0" style="width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;font-size:15px;">
            <label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:4px;">Jumlah Penonton (opsional)</label>
            <input type="number" id="ls-penonton" min="0" placeholder="0" style="width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;font-size:15px;">
            <label style="display:block;font-size:12px;color:#475569;font-weight:600;margin-bottom:4px;">Quote Akhir (opsional)</label>
            <textarea id="ls-quote-selesai" rows="2" maxlength="200" placeholder="mis. closing 18, kendala sinyal" style="width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px;font-family:inherit;font-size:13px;resize:vertical;"></textarea>
            <button id="ls-end-btn" onclick="liveStreamer.doEnd()" style="width:100%;background:#ef4444;color:#fff;border:none;padding:13px;border-radius:10px;cursor:pointer;font-weight:700;font-size:15px;"><i class="fas fa-stop-circle"></i> Selesai Live</button>
        </div>`;
    },

    async doEnd() {
        if (!this.active) return;
        if (!this.location) { alert('⚠️ GPS belum siap. Tunggu lokasi muncul lalu coba lagi.'); this.getLocation(); return; }
        const closing = document.getElementById('ls-closing').value;
        const penonton = document.getElementById('ls-penonton').value;
        const quote = document.getElementById('ls-quote-selesai').value.trim().substring(0, 200);
        const img = this.captureImage();
        const a = this._actor();
        const btn = document.getElementById('ls-end-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...'; }
        try {
            const res = await api.post({
                action: 'endLiveSession', id: this.active.id, actor_id: a.actor_id, actor_name: a.actor_name,
                jumlah_closing: closing, jumlah_penonton: penonton, quote_selesai: quote,
                lat: this.location.lat, lng: this.location.lng, location: this._locStr(), thumbnail: img.thumb
            });
            if (res && res.success) {
                alert('✅ Sesi selesai. Durasi ' + this._fmtDur(res.durasi_menit) + '. Komisi menunggu approval admin.');
                this.refresh();
            } else { alert('❌ ' + ((res && res.error) || 'gagal selesai live')); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-stop-circle"></i> Selesai Live'; } }
        } catch (e) { alert('❌ Error: ' + e.message); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-stop-circle"></i> Selesai Live'; } }
    },

    // ---------- HISTORY ----------
    _fmtDur(min) {
        min = Number(min) || 0;
        const h = Math.floor(min / 60), m = min % 60;
        return (h ? h + 'j ' : '') + m + 'm';
    },
    _renderHistory() {
        const wrap = document.getElementById('live-history');
        const done = this.sessions.filter(s => String(s.status).toUpperCase() === 'SELESAI');
        if (!done.length) { wrap.innerHTML = ''; return; }
        let totalKomisi = 0;
        const rows = done.map(s => {
            totalKomisi += Number(s.komisi_host) || 0;
            const badge = String(s.disetujui).toUpperCase() === 'APPROVED'
                ? '<span style="font-size:10px;background:#dcfce7;color:#15803d;padding:1px 7px;border-radius:4px;">ACC</span>'
                : '<span style="font-size:10px;background:#fef9c3;color:#a16207;padding:1px 7px;border-radius:4px;">menunggu</span>';
            return `<div style="display:flex;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:12px;">
                <div style="flex:1;">
                    <div style="font-weight:600;color:#1e293b;">${this._esc(s.tanggal)} · Sesi ${this._esc(s.sesi)} · ${this._esc(s.toko)}</div>
                    <div style="color:#64748b;">${this._esc(s.lokasi_tipe)} · ${this._fmtDur(s.durasi_menit)} · ${s.jumlah_closing} closing${s.cohost_nama ? ' · co: ' + this._esc(s.cohost_nama) : ''}</div>
                </div>
                <div style="text-align:right;white-space:nowrap;">
                    <div style="font-weight:700;color:#0f766e;">Rp ${Number(s.komisi_host || 0).toLocaleString('id-ID')}</div>
                    ${badge}
                </div>
            </div>`;
        }).join('');
        wrap.innerHTML = `<h4 style="margin:0 0 8px;font-size:14px;color:#334155;"><i class="fas fa-history" style="color:#94a3b8;"></i> Riwayat Bulan Ini</h4>
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:6px 14px;">${rows}
            <div style="display:flex;justify-content:space-between;padding:10px 0 4px;font-size:13px;font-weight:700;color:#0f766e;"><span>Total komisi (bagian saya)</span><span>Rp ${totalKomisi.toLocaleString('id-ID')}</span></div></div>`;
    }
};

window.liveStreamer = liveStreamer;
