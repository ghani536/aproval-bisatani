/**
 * Portal Admin - Live Streamer (Tahap A)
 * Rekap sesi live (approve + edit), master toko, setting komisi per closing.
 */
const adminLive = {
    currentTab: 'rekap',
    sessions: [],
    toko: [],
    rate: 0,

    _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    _actor() {
        const u = (typeof auth !== 'undefined' && auth.user) || {};
        return { actor_id: u.id || '', actor_name: u.name || u.nama || '' };
    },
    _fmtDur(min) {
        min = Number(min) || 0;
        const h = Math.floor(min / 60), m = min % 60;
        return (h ? h + 'j ' : '') + m + 'm';
    },
    _rupiah(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); },

    closeModal(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; },

    init() {
        // Default rentang tanggal = bulan berjalan
        const n = new Date();
        const first = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-01';
        const today = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
        const f = document.getElementById('al-from'); const t = document.getElementById('al-to');
        if (f && !f.value) f.value = first;
        if (t && !t.value) t.value = today;
        this.switchTab(this.currentTab || 'rekap');
        this.loadRate();
        this.loadSessions();
        this.loadToko();
    },

    switchTab(tab) {
        this.currentTab = tab;
        ['rekap', 'toko', 'komisi'].forEach(x => {
            const pane = document.getElementById('al-tab-' + x);
            if (pane) pane.style.display = x === tab ? 'block' : 'none';
            const btn = document.getElementById('al-tabbtn-' + x);
            if (btn) {
                const on = x === tab;
                btn.style.borderBottomColor = on ? '#ef4444' : 'transparent';
                btn.style.color = on ? '#ef4444' : '#64748b';
                btn.style.fontWeight = on ? '700' : '600';
            }
        });
    },

    // ---------- KOMISI RATE ----------
    async loadRate() {
        try {
            const res = await api.post({ action: 'getLiveKomisiRate' });
            if (res && res.success) {
                this.rate = Number(res.rate) || 0;
                const i = document.getElementById('al-rate');
                if (i) i.value = this.rate;
                const info = document.getElementById('al-rate-info');
                if (info) info.textContent = 'Tarif aktif: ' + this._rupiah(this.rate) + ' / closing.';
            }
        } catch (e) {}
    },
    async saveRate() {
        const val = Number(document.getElementById('al-rate').value);
        if (isNaN(val) || val < 0) { alert('Tarif tidak valid.'); return; }
        const a = this._actor();
        try {
            const res = await api.post({ action: 'saveLiveKomisiRate', rate: val, actor_id: a.actor_id, actor_name: a.actor_name });
            if (res && res.success) { this.rate = res.rate; alert('✅ Tarif komisi disimpan: ' + this._rupiah(res.rate) + ' / closing.'); this.loadRate(); }
            else alert('❌ ' + ((res && res.error) || 'gagal simpan'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    },

    // ---------- MASTER TOKO ----------
    async loadToko() {
        const wrap = document.getElementById('al-toko-content');
        try {
            const res = await api.post({ action: 'getLiveToko' });
            this.toko = (res && res.success) ? (res.data || []) : [];
        } catch (e) { this.toko = []; }
        if (!this.toko.length) { wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:24px;">Belum ada toko. Klik "Tambah Toko".</div>'; return; }
        wrap.innerHTML = this.toko.map(t => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 13px;border:1px solid #e2e8f0;border-radius:9px;margin-bottom:7px;${t.aktif ? '' : 'opacity:0.55;'}">
                <div>
                    <div style="font-weight:600;color:#1e293b;font-size:14px;">${this._esc(t.nama_toko)}</div>
                    <div style="font-size:11px;color:#64748b;">${this._esc(t.platform || '-')}${t.aktif ? '' : ' · NONAKTIF'}</div>
                </div>
                <div style="display:flex;gap:6px;">
                    <button onclick="adminLive.openTokoModal('${this._esc(t.id)}')" style="background:#dbeafe;color:#1e40af;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"><i class="fas fa-edit"></i></button>
                    <button onclick="adminLive.deleteToko('${this._esc(t.id)}')" style="background:#fee2e2;color:#dc2626;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');
    },
    openTokoModal(id) {
        const t = id ? this.toko.find(x => String(x.id) === String(id)) : null;
        document.getElementById('lt-id').value = t ? t.id : '';
        document.getElementById('lt-nama').value = t ? t.nama_toko : '';
        document.getElementById('lt-platform').value = t ? (t.platform || 'TikTok') : 'TikTok';
        document.getElementById('lt-aktif').checked = t ? !!t.aktif : true;
        document.getElementById('modal-live-toko-title').textContent = (t ? 'Edit' : 'Tambah') + ' Toko';
        document.getElementById('modal-live-toko').style.display = 'flex';
    },
    async saveToko() {
        const nama = document.getElementById('lt-nama').value.trim();
        if (!nama) { alert('Nama toko wajib diisi.'); return; }
        const id = document.getElementById('lt-id').value;
        const a = this._actor();
        const payload = {
            action: 'saveLiveToko', nama_toko: nama,
            platform: document.getElementById('lt-platform').value,
            aktif: document.getElementById('lt-aktif').checked,
            actor_id: a.actor_id, actor_name: a.actor_name
        };
        if (id) payload.id = id;
        try {
            const res = await api.post(payload);
            if (res && res.success) { this.closeModal('modal-live-toko'); this.loadToko(); }
            else alert('❌ ' + ((res && res.error) || 'gagal simpan'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    },
    async deleteToko(id) {
        if (!confirm('Hapus toko ini?')) return;
        const a = this._actor();
        try {
            const res = await api.post({ action: 'deleteLiveToko', id: id, actor_id: a.actor_id, actor_name: a.actor_name });
            if (res && res.success) this.loadToko();
            else alert('❌ ' + ((res && res.error) || 'gagal hapus'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    },

    // ---------- REKAP SESI ----------
    async loadSessions() {
        const wrap = document.getElementById('al-rekap-content');
        wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        const a = this._actor();
        const payload = {
            action: 'getLiveSessions', actor_id: a.actor_id,
            date_from: document.getElementById('al-from').value,
            date_to: document.getElementById('al-to').value,
            status: document.getElementById('al-status').value
        };
        try {
            const res = await api.post(payload);
            if (!res || !res.success) { wrap.innerHTML = `<div style="color:#ef4444;padding:20px;">${(res && res.error) || 'gagal memuat'}</div>`; return; }
            this.sessions = res.data || [];
            this.rate = Number(res.rate) || this.rate;
            this._renderRekap();
        } catch (e) { wrap.innerHTML = `<div style="color:#ef4444;padding:20px;">Error: ${e.message}</div>`; }
    },
    _mapsLink(lat, lng) {
        if (lat === '' || lat == null || lng === '' || lng == null) return '';
        return `https://www.google.com/maps?q=${lat},${lng}`;
    },
    _renderRekap() {
        const wrap = document.getElementById('al-rekap-content');
        if (!this.sessions.length) { wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;">Tidak ada sesi pada rentang ini.</div>'; return; }
        let totKomisi = 0, totClosing = 0, totMenit = 0;
        const rows = this.sessions.map(s => {
            totKomisi += Number(s.komisi) || 0; totClosing += Number(s.jumlah_closing) || 0; totMenit += Number(s.durasi_menit) || 0;
            const maps = this._mapsLink(s.mulai_lat, s.mulai_lng);
            const lokasiCell = maps
                ? `${this._esc(s.lokasi_tipe)} <a href="${maps}" target="_blank" rel="noopener" style="color:#3b82f6;" title="${this._esc(s.mulai_lokasi)}"><i class="fas fa-map-marker-alt"></i></a>`
                : this._esc(s.lokasi_tipe);
            const berlangsung = String(s.status).toUpperCase() === 'BERLANGSUNG';
            const approved = String(s.disetujui).toUpperCase() === 'APPROVED';
            const statusBadge = berlangsung
                ? '<span style="font-size:10px;background:#fee2e2;color:#b91c1c;padding:2px 7px;border-radius:4px;">LIVE</span>'
                : (approved
                    ? '<span style="font-size:10px;background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:4px;">ACC</span>'
                    : '<span style="font-size:10px;background:#fef9c3;color:#a16207;padding:2px 7px;border-radius:4px;">PENDING</span>');
            const komisiTxt = s.cohost_nama
                ? `${this._rupiah(s.komisi)}<br><small style="color:#64748b;">@${this.numShort(s.komisi_host)} + co ${this.numShort(s.komisi_cohost)}</small>`
                : this._rupiah(s.komisi);
            const actions = berlangsung ? '' : `
                <button onclick="adminLive.openEditModal('${this._esc(s.id)}')" title="Edit closing" style="background:#dbeafe;color:#1e40af;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-edit"></i></button>
                <button onclick="adminLive.toggleApprove('${this._esc(s.id)}', ${approved})" title="${approved ? 'Batalkan ACC' : 'Setujui'}" style="background:${approved ? '#fef3c7' : '#dcfce7'};color:${approved ? '#92400e' : '#15803d'};border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-${approved ? 'undo' : 'check'}"></i></button>`;
            return `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 6px;font-size:12px;white-space:nowrap;">${this._esc(s.tanggal)}<br><small style="color:#94a3b8;">Sesi ${this._esc(s.sesi)}</small></td>
                <td style="padding:8px 6px;font-size:12px;">${this._esc(s.nama)}</td>
                <td style="padding:8px 6px;font-size:12px;">${s.cohost_nama ? this._esc(s.cohost_nama) : '<span style="color:#cbd5e1;">—</span>'}</td>
                <td style="padding:8px 6px;font-size:12px;white-space:nowrap;">${lokasiCell}</td>
                <td style="padding:8px 6px;font-size:11px;white-space:nowrap;">${this._jam(s.mulai_jam) || '—'} <span style="color:#cbd5e1;">→</span> ${this._jam(s.selesai_jam) || '—'}</td>
                <td style="padding:8px 6px;font-size:12px;">${this._esc(s.toko)}</td>
                <td style="padding:8px 6px;font-size:12px;text-align:center;">${this._fmtDur(s.durasi_menit)}</td>
                <td style="padding:8px 6px;font-size:12px;text-align:center;font-weight:600;">${s.jumlah_closing}</td>
                <td style="padding:8px 6px;font-size:12px;white-space:nowrap;">${komisiTxt}</td>
                <td style="padding:8px 6px;text-align:center;">${statusBadge}</td>
                <td style="padding:8px 6px;white-space:nowrap;">${actions}</td>
            </tr>`;
        }).join('');
        wrap.innerHTML = `
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
                <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:9px;padding:10px 12px;"><div style="font-size:11px;color:#16a34a;">Total Komisi</div><div style="font-size:16px;font-weight:700;color:#15803d;">${this._rupiah(totKomisi)}</div></div>
                <div style="flex:1;min-width:90px;background:#eff6ff;border-radius:9px;padding:10px 12px;"><div style="font-size:11px;color:#3b82f6;">Total Closing</div><div style="font-size:16px;font-weight:700;color:#1e40af;">${totClosing}</div></div>
                <div style="flex:1;min-width:90px;background:#fdf4ff;border-radius:9px;padding:10px 12px;"><div style="font-size:11px;color:#a855f7;">Total Durasi</div><div style="font-size:16px;font-weight:700;color:#7e22ce;">${this._fmtDur(totMenit)}</div></div>
            </div>
            <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:880px;">
                <thead><tr style="background:#f8fafc;text-align:left;">
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;">Tgl/Sesi</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;">Host</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;">Co-host</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;">Tempat</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;">Jam (Mulai→Selesai)</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;">Toko</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;text-align:center;">Durasi</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;text-align:center;">Closing</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;">Komisi</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;text-align:center;">Status</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;">Aksi</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            </div>`;
    },
    numShort(n) {
        n = Number(n) || 0;
        if (n >= 1000) return (n / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'rb';
        return String(n);
    },
    _jam(dt) {
        const m = String(dt || '').match(/\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})/);
        return m ? m[1] : '';
    },
    async toggleApprove(id, currentlyApproved) {
        const a = this._actor();
        try {
            const res = await api.post({ action: 'approveLiveSession', id: id, disetujui: currentlyApproved ? 'PENDING' : 'APPROVED', actor_id: a.actor_id, actor_name: a.actor_name });
            if (res && res.success) this.loadSessions();
            else alert('❌ ' + ((res && res.error) || 'gagal'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    },

    // ---------- EDIT SESI ----------
    openEditModal(id) {
        const s = this.sessions.find(x => String(x.id) === String(id));
        if (!s) return;
        document.getElementById('le-id').value = s.id;
        document.getElementById('le-closing').value = s.jumlah_closing || 0;
        document.getElementById('le-info').textContent = `${s.tanggal} · Sesi ${s.sesi} · ${s.nama} · ${s.toko}${s.cohost_nama ? ' (co-host: ' + s.cohost_nama + ')' : ''}`;
        this._editTarget = s;
        this._updateEditPreview();
        const inp = document.getElementById('le-closing');
        inp.oninput = () => this._updateEditPreview();
        document.getElementById('modal-live-edit').style.display = 'flex';
    },
    _updateEditPreview() {
        const s = this._editTarget; if (!s) return;
        const closing = Math.max(0, parseInt(document.getElementById('le-closing').value) || 0);
        const rate = Number(s.komisi_per_closing) || 0;
        const komisi = closing * rate;
        const hasCo = !!s.cohost_nama;
        const prev = document.getElementById('le-komisi-preview');
        prev.innerHTML = `Tarif terkunci: <b>${this._rupiah(rate)}</b>/closing → Komisi: <b>${this._rupiah(komisi)}</b>` +
            (hasCo ? ` (host ${this._rupiah(komisi / 2)} + co-host ${this._rupiah(komisi / 2)})` : '');
    },
    async saveEdit() {
        const id = document.getElementById('le-id').value;
        const closing = document.getElementById('le-closing').value;
        const a = this._actor();
        try {
            const res = await api.post({ action: 'editLiveSession', id: id, jumlah_closing: closing, actor_id: a.actor_id, actor_name: a.actor_name });
            if (res && res.success) { this.closeModal('modal-live-edit'); this.loadSessions(); }
            else alert('❌ ' + ((res && res.error) || 'gagal simpan'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    }
};

window.adminLive = adminLive;
