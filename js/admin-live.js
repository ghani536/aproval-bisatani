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

    // Badge notif sidebar: jumlah sesi SELESAI yang belum di-ACC
    async refreshBadge() {
        try {
            const a = this._actor();
            if (!a.actor_id) return;
            const res = await api.post({ action: 'getLivePendingCount', actor_id: a.actor_id });
            const badge = document.getElementById('live-approval-badge');
            if (!badge) return;
            const n = (res && res.success) ? Number(res.count) || 0 : 0;
            if (n > 0) { badge.textContent = n > 99 ? '99+' : n; badge.style.display = 'inline-block'; }
            else badge.style.display = 'none';
        } catch (e) { /* silent */ }
    },

    init() {
        // Default rentang tanggal = bulan berjalan
        const n = new Date();
        const first = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-01';
        const today = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
        const f = document.getElementById('al-from'); const t = document.getElementById('al-to');
        if (f && !f.value) f.value = first;
        if (t && !t.value) t.value = today;
        const hf = document.getElementById('alh-from'); const ht = document.getElementById('alh-to');
        if (hf && !hf.value) hf.value = first;
        if (ht && !ht.value) ht.value = today;
        this.switchTab(this.currentTab || 'rekap');
        this.loadRate();
        this.loadSessions();
        this.loadToko();
        this.refreshBadge();
    },

    switchTab(tab) {
        this.currentTab = tab;
        ['rekap', 'host', 'toko', 'komisi'].forEach(x => {
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
        if (tab === 'host') this.loadPerHost();
    },

    // ---------- PER HOST (total durasi + detail foto/quote) ----------
    async loadPerHost() {
        const wrap = document.getElementById('al-host-content');
        wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        const a = this._actor();
        try {
            const res = await api.post({ action: 'getLiveSessions', actor_id: a.actor_id, date_from: document.getElementById('alh-from').value, date_to: document.getElementById('alh-to').value });
            this.hostSessions = (res && res.success) ? (res.data || []) : [];
            this._renderHostSummary();
        } catch (e) { wrap.innerHTML = `<div style="color:#ef4444;padding:20px;">Error: ${e.message}</div>`; }
    },
    _renderHostSummary() {
        const wrap = document.getElementById('al-host-content');
        const map = {};
        (this.hostSessions || []).forEach(s => {
            const k = String(s.userId);
            if (!map[k]) map[k] = { userId: k, nama: s.nama, sesi: 0, durasi: 0, closing: 0, komisi: 0 };
            map[k].sesi += 1;
            map[k].durasi += Number(s.durasi_menit) || 0;
            map[k].closing += Number(s.jumlah_closing) || 0;
            map[k].komisi += Number(s.komisi_host) || 0;
        });
        const rows = Object.values(map).sort((p, q) => q.durasi - p.durasi);
        if (!rows.length) { wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;">Tidak ada sesi pada rentang ini.</div>'; return; }
        wrap.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:520px;">
            <thead><tr style="background:#f8fafc;text-align:left;">
                <th style="padding:9px 8px;font-size:11px;color:#64748b;">Host</th>
                <th style="padding:9px 8px;font-size:11px;color:#64748b;text-align:center;">Sesi</th>
                <th style="padding:9px 8px;font-size:11px;color:#64748b;text-align:center;">Total Durasi</th>
                <th style="padding:9px 8px;font-size:11px;color:#64748b;text-align:center;">Closing</th>
                <th style="padding:9px 8px;font-size:11px;color:#64748b;text-align:right;">Komisi</th>
            </tr></thead><tbody>
            ${rows.map(r => `<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="adminLive.showHostSessions('${this._esc(r.userId)}')">
                <td style="padding:9px 8px;font-size:13px;font-weight:600;color:#2563eb;border-bottom:1px dotted #cbd5e1;">${this._esc(r.nama)}</td>
                <td style="padding:9px 8px;font-size:13px;text-align:center;">${r.sesi}</td>
                <td style="padding:9px 8px;font-size:13px;text-align:center;font-weight:700;color:#7e22ce;">${this._fmtDur(r.durasi)}</td>
                <td style="padding:9px 8px;font-size:13px;text-align:center;">${r.closing}</td>
                <td style="padding:9px 8px;font-size:13px;text-align:right;color:#0f766e;font-weight:600;">${this._rupiah(r.komisi)}</td>
            </tr>`).join('')}
            </tbody></table></div>
            <div id="al-host-detail" style="margin-top:16px;"></div>`;
    },
    showHostSessions(userId) {
        const sessions = (this.hostSessions || []).filter(s => String(s.userId) === String(userId));
        const det = document.getElementById('al-host-detail');
        if (!sessions.length) { det.innerHTML = ''; return; }
        const nama = sessions[0].nama;
        det.innerHTML = `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
            <h4 style="margin:0 0 10px;font-size:14px;">Sesi ${this._esc(nama)}</h4>
            ${sessions.map(s => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #f1f5f9;">
                <div><div style="font-size:13px;font-weight:600;color:#1e293b;">${this._esc(s.tanggal)} · Sesi ${this._esc(s.sesi)} · ${this._esc(s.toko)}</div>
                <div style="font-size:11px;color:#64748b;">${this._esc(s.lokasi_tipe)} · ${this._fmtDur(s.durasi_menit)} · ${s.jumlah_closing} closing${s.cohost_nama ? ' · co: ' + this._esc(s.cohost_nama) : ''}</div></div>
                <button onclick="adminLive.openSessionDetail('${this._esc(s.id)}')" style="background:#fee2e2;color:#b91c1c;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;"><i class="fas fa-image"></i> Foto & Quote</button>
            </div>`).join('')}
        </div>`;
        det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    async openSessionDetail(id) {
        const modal = document.getElementById('modal-live-detail');
        const body = document.getElementById('ld-body');
        modal.style.display = 'flex';
        body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:24px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        const a = this._actor();
        try {
            const res = await api.post({ action: 'getLiveSessionDetail', id: id, actor_id: a.actor_id });
            if (!res || !res.success) { body.innerHTML = `<div style="color:#ef4444;padding:16px;">${(res && res.error) || 'gagal'}</div>`; return; }
            const s = res.data;
            // Simpan foto bukti utk lightbox (klik perbesar di halaman, bukan tab baru).
            this._detailFotos = (s.bukti_fotos && s.bukti_fotos.length) ? s.bukti_fotos : (s.bukti_foto ? [s.bukti_foto] : []);
            const photo = (src, label, jam, lok, quote) => `
                <div style="flex:1;min-width:140px;">
                    <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;">${label}${jam ? ' · ' + this._esc(String(jam).substring(11, 16)) : ''}</div>
                    ${src ? `<img src="${src}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;">` : '<div style="background:#f1f5f9;border-radius:8px;padding:24px;text-align:center;color:#cbd5e1;font-size:12px;">tidak ada foto</div>'}
                    ${lok ? `<div style="font-size:10px;color:#94a3b8;margin-top:3px;">${this._esc(lok)}</div>` : ''}
                    ${quote ? `<div style="font-size:11px;color:#475569;margin-top:5px;font-style:italic;">"${this._esc(quote)}"</div>` : ''}
                </div>`;
            body.innerHTML = `
                <div style="font-size:13px;color:#475569;margin-bottom:12px;line-height:1.6;">
                    <b>${this._esc(s.nama)}</b> · Sesi ${this._esc(s.sesi)} · ${this._esc(s.toko)}${s.platform ? ' (' + this._esc(s.platform) + ')' : ''}<br>
                    ${this._esc(s.tanggal)} · ${this._esc(s.lokasi_tipe)} · durasi <b>${this._fmtDur(s.durasi_menit)}</b> · ${s.jumlah_closing} closing${s.cohost_nama ? ' · co-host ' + this._esc(s.cohost_nama) : ''}
                </div>
                ${s.catatan ? `<div style="background:#fef9c3;color:#854d0e;padding:9px 12px;border-radius:8px;font-size:12px;margin-bottom:12px;"><b>Catatan:</b> ${this._esc(s.catatan)}</div>` : ''}
                <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                    ${photo(s.mulai_foto, '📷 Selfie Mulai', s.mulai_jam, s.mulai_lokasi, s.quote_mulai)}
                    ${photo(s.selesai_foto, '📷 Selfie Selesai', s.selesai_jam, s.selesai_lokasi, s.quote_selesai)}
                </div>
                <div>
                    ${(() => {
                        const fotos = this._detailFotos;
                        const head = `<div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;">🧾 Bukti Dashboard Live (${s.jumlah_closing} closing · ${fotos.length} foto)</div>`;
                        if (!fotos.length) return head + '<div style="background:#f1f5f9;border-radius:8px;padding:18px;text-align:center;color:#cbd5e1;font-size:12px;">tidak ada bukti</div>';
                        return head + '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + fotos.map((f, i) => `<img src="${f}" onclick="adminLive.zoomFoto(${i})" style="width:140px;border-radius:8px;border:1px solid #e2e8f0;cursor:zoom-in;">`).join('') + '</div>';
                    })()}
                </div>`;
        } catch (e) { body.innerHTML = `<div style="color:#ef4444;padding:16px;">Error: ${e.message}</div>`; }
    },

    // Lightbox: perbesar foto bukti di halaman (BUKAN tab baru — data URI diblokir browser).
    zoomFoto(i) {
        const src = (this._detailFotos || [])[i];
        if (!src) return;
        let ov = document.getElementById('live-foto-zoom');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'live-foto-zoom';
            ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out;';
            ov.onclick = () => { ov.style.display = 'none'; };
            ov.innerHTML = '<img id="live-foto-zoom-img" style="max-width:100%;max-height:100%;border-radius:8px;">';
            document.body.appendChild(ov);
        }
        document.getElementById('live-foto-zoom-img').src = src;
        ov.style.display = 'flex';
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
            this.refreshBadge();
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
            const delBtn = `<button onclick="adminLive.deleteSession('${this._esc(s.id)}')" title="Hapus sesi" style="background:#fee2e2;color:#dc2626;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-trash"></i></button>`;
            const detailBtn = berlangsung ? '' : `<button onclick="adminLive.openSessionDetail('${this._esc(s.id)}')" title="Lihat foto, catatan & bukti" style="background:#f3e8ff;color:#7c3aed;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-image"></i></button>`;
            const editApprove = berlangsung ? '' : `
                <button onclick="adminLive.openEditModal('${this._esc(s.id)}')" title="Edit closing" style="background:#dbeafe;color:#1e40af;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-edit"></i></button>
                <button onclick="adminLive.toggleApprove('${this._esc(s.id)}', ${approved})" title="${approved ? 'Batalkan ACC' : 'Setujui'}" style="background:${approved ? '#fef3c7' : '#dcfce7'};color:${approved ? '#92400e' : '#15803d'};border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-${approved ? 'undo' : 'check'}"></i></button>`;
            const actions = detailBtn + ' ' + editApprove + ' ' + delBtn;
            return `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 6px;font-size:12px;white-space:nowrap;">${this._esc(s.tanggal)}<br><small style="color:#94a3b8;">Sesi ${this._esc(s.sesi)}</small></td>
                <td style="padding:8px 6px;font-size:12px;">${this._esc(s.nama)}</td>
                <td style="padding:8px 6px;font-size:12px;">${s.cohost_nama ? this._esc(s.cohost_nama) : '<span style="color:#cbd5e1;">—</span>'}</td>
                <td style="padding:8px 6px;font-size:12px;white-space:nowrap;">${lokasiCell}</td>
                <td style="padding:8px 6px;font-size:11px;white-space:nowrap;">${this._jam(s.mulai_jam) || '—'} <span style="color:#cbd5e1;">→</span> ${this._jam(s.selesai_jam) || '—'}</td>
                <td style="padding:8px 6px;font-size:12px;">${this._esc(s.toko)}</td>
                <td style="padding:8px 6px;font-size:12px;text-align:center;">${this._fmtDur(s.durasi_menit)}</td>
                <td style="padding:8px 6px;font-size:12px;text-align:center;font-weight:600;">${s.jumlah_closing}${s.catatan ? ' <i class="fas fa-note-sticky" title="' + this._esc(s.catatan) + '" style="color:#a16207;font-size:10px;"></i>' : ''}</td>
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
    async deleteSession(id) {
        const s = this.sessions.find(x => String(x.id) === String(id));
        const info = s ? `${s.tanggal} · Sesi ${s.sesi} · ${s.nama} · ${s.toko}` : '';
        if (!confirm('Hapus sesi live ini?\n\n' + info + '\n\nData & komisi sesi ini akan dihapus permanen.')) return;
        const a = this._actor();
        try {
            const res = await api.post({ action: 'deleteLiveSession', id: id, actor_id: a.actor_id, actor_name: a.actor_name });
            if (res && res.success) this.loadSessions();
            else alert('❌ ' + ((res && res.error) || 'gagal hapus'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    },

    // ---------- EDIT SESI ----------
    async _loadStreamers() {
        if (this.streamers && this.streamers.length) return this.streamers;
        try {
            const res = await api.post({ action: 'getLiveStreamers' });
            this.streamers = (res && res.success) ? (res.data || []) : [];
        } catch (e) { this.streamers = []; }
        return this.streamers;
    },
    async openEditModal(id) {
        const s = this.sessions.find(x => String(x.id) === String(id));
        if (!s) return;
        document.getElementById('le-id').value = s.id;
        document.getElementById('le-closing').value = s.jumlah_closing || 0;
        document.getElementById('le-info').textContent = `${s.tanggal} · Sesi ${s.sesi} · ${s.nama} · ${s.toko}`;
        this._editTarget = s;
        // Isi dropdown co-host (kecuali host sendiri), pilih co-host saat ini kalau ada
        await this._loadStreamers();
        const sel = document.getElementById('le-cohost');
        if (sel) {
            const opts = (this.streamers || []).filter(c => String(c.id) !== String(s.userId))
                .map(c => `<option value="${this._esc(c.id)}" ${String(c.id) === String(s.cohost_userId || '') ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('');
            sel.innerHTML = '<option value="">— tanpa co-host —</option>' + opts;
            sel.onchange = () => this._updateEditPreview();
        }
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
        const sel = document.getElementById('le-cohost');
        const hasCo = !!(sel && sel.value);
        const prev = document.getElementById('le-komisi-preview');
        prev.innerHTML = `Tarif terkunci: <b>${this._rupiah(rate)}</b>/closing → Komisi: <b>${this._rupiah(komisi)}</b>` +
            (hasCo ? ` (host ${this._rupiah(komisi / 2)} + co-host ${this._rupiah(komisi / 2)})` : '');
    },
    async saveEdit() {
        const id = document.getElementById('le-id').value;
        const closing = document.getElementById('le-closing').value;
        const sel = document.getElementById('le-cohost');
        const cohost = sel ? sel.value : '';
        const a = this._actor();
        try {
            const res = await api.post({ action: 'editLiveSession', id: id, jumlah_closing: closing, cohost_userId: cohost, actor_id: a.actor_id, actor_name: a.actor_name });
            if (res && res.success) { this.closeModal('modal-live-edit'); this.loadSessions(); }
            else alert('❌ ' + ((res && res.error) || 'gagal simpan'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    }
};

window.adminLive = adminLive;
