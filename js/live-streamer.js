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
    startClock() {
        if (this._clockTimer) clearInterval(this._clockTimer);
        const tick = () => {
            const el = document.getElementById('live-clock-2');
            if (el) {
                const n = new Date();
                el.textContent = [n.getHours(), n.getMinutes(), n.getSeconds()].map(x => String(x).padStart(2, '0')).join(':');
            }
        };
        tick();
        this._clockTimer = setInterval(tick, 1000);
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
