/**
 * Portal Admin - Pengajuan Cuti & Izin
 * Approve/Reject pengajuan karyawan
 */
const adminPengajuan = {
    _items: [],
    _tab: 'ALL',
    _decideRow: null,
    _decideStatus: null,

    init() {
        this.load();
    },

    setTab(tab) {
        this._tab = tab;
        // Update tab styles
        ['all', 'cuti', 'izin'].forEach(t => {
            const btn = document.getElementById('ap-tab-' + t);
            if (!btn) return;
            const active = t.toUpperCase() === tab;
            btn.style.background = active ? '#fff' : 'transparent';
            btn.style.color = active ? '#1e293b' : '#64748b';
            btn.style.boxShadow = active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none';
        });
        this.render();
    },

    async load() {
        const wrap = document.getElementById('ap-cards');
        wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px 20px;"><i class="fas fa-sync fa-spin"></i> Memuat data pengajuan...</div>';
        try {
            const res = await api.post({ action: 'getAllPengajuan' });
            if (!res || !res.success) {
                wrap.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Gagal: ${(res && res.error) || 'cek koneksi'}</div>`;
                return;
            }
            this._items = res.data || [];
            this._updateBadge();
            this.render();
        } catch (err) {
            wrap.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Error: ${err.message}</div>`;
        }
    },

    _updateBadge() {
        const pendingCount = this._items.filter(it => String(it.status).toUpperCase() === 'PENDING').length;
        const badge = document.getElementById('pengajuan-badge');
        if (badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }
    },

    render() {
        const wrap = document.getElementById('ap-cards');
        const statusFilter = document.getElementById('ap-status-filter').value;

        // Hitung count per tab
        const byTab = (tipe) => this._items.filter(it => {
            if (tipe !== 'ALL' && String(it.tipe).toUpperCase() !== tipe) return false;
            if (statusFilter && String(it.status).toUpperCase() !== statusFilter) return false;
            return true;
        });
        document.getElementById('ap-cnt-all').textContent = byTab('ALL').length;
        document.getElementById('ap-cnt-cuti').textContent = byTab('CUTI').length;
        document.getElementById('ap-cnt-izin').textContent = byTab('IZIN').length;

        const filtered = byTab(this._tab);
        if (filtered.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px 20px;"><i class="fas fa-inbox" style="font-size:2rem; opacity:0.5;"></i><p style="margin:8px 0 0;">Tidak ada pengajuan untuk filter ini</p></div>';
            return;
        }
        wrap.innerHTML = filtered.map(it => this._renderCard(it)).join('');
    },

    _renderCard(it) {
        const st = String(it.status || 'PENDING').toUpperCase();
        const stColor = st === 'APPROVED' ? '#10b981' : st === 'REJECTED' ? '#ef4444' : '#f59e0b';
        const stBg = st === 'APPROVED' ? '#dcfce7' : st === 'REJECTED' ? '#fee2e2' : '#fef3c7';
        const stText = st === 'APPROVED' ? 'Approved' : st === 'REJECTED' ? 'Rejected' : 'Pending';
        const tipeIcon = it.tipe === 'CUTI' ? 'fa-umbrella-beach' : 'fa-file-medical';
        const tipeColor = it.tipe === 'CUTI' ? '#10b981' : '#3b82f6';
        const tipeBg = it.tipe === 'CUTI' ? '#dcfce7' : '#dbeafe';
        const isPending = st === 'PENDING';

        return `
            <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px; background:white;">
                <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:42px; height:42px; background:${tipeBg}; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                            <i class="fas ${tipeIcon}" style="color:${tipeColor}; font-size:18px;"></i>
                        </div>
                        <div>
                            <div style="font-weight:600; color:#1e293b;">${this._esc(it.nama || '-')} <span style="color:#94a3b8; font-weight:400; font-size:12px;">· ID ${it.id}</span></div>
                            <div style="font-size:12px; color:#64748b;">${it.tipe} · ${it.jumlah_hari} hari · ${it.tanggal_mulai} → ${it.tanggal_selesai}</div>
                        </div>
                    </div>
                    <span style="background:${stBg}; color:${stColor}; padding:4px 12px; border-radius:12px; font-size:11px; font-weight:700;">${stText}</span>
                </div>
                <div style="font-size:13px; color:#475569; background:#f8fafc; padding:10px; border-radius:6px; margin-bottom:8px;">${this._esc(it.alasan || '-')}</div>
                ${it.has_foto ? `<button onclick="adminPengajuan.viewFoto(${it.rowId})" style="background:#f1f5f9; border:1px solid #e2e8f0; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; color:#475569; margin-bottom:8px;"><i class="fas fa-image"></i> Lihat Lampiran</button>` : ''}
                ${it.catatan_admin ? `<div style="font-size:12px; color:#64748b; border-left:3px solid ${stColor}; padding-left:8px; margin-bottom:8px;"><b>Catatan:</b> ${this._esc(it.catatan_admin)}</div>` : ''}
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                    <div style="font-size:11px; color:#94a3b8;">Diajukan ${it.submitted_at}${it.decided_at ? ' · diputuskan ' + it.decided_at + (it.decided_by ? ' oleh ' + this._esc(it.decided_by) : '') : ''}</div>
                    ${isPending ? `
                        <div style="display:flex; gap:6px;">
                            <button onclick="adminPengajuan.openDecide(${it.rowId}, 'REJECTED')" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;"><i class="fas fa-times"></i> Reject</button>
                            <button onclick="adminPengajuan.openDecide(${it.rowId}, 'APPROVED')" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;"><i class="fas fa-check"></i> Approve</button>
                        </div>` : `
                        <button onclick="adminPengajuan.openDecide(${it.rowId}, 'PENDING')" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;"><i class="fas fa-undo"></i> Reset ke Pending</button>`}
                </div>
            </div>`;
    },

    _esc(s) {
        return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    openDecide(rowId, status) {
        const it = this._items.find(x => x.rowId === rowId);
        if (!it) return;
        this._decideRow = rowId;
        this._decideStatus = status;
        const title = status === 'APPROVED' ? 'Setujui Pengajuan' : status === 'REJECTED' ? 'Tolak Pengajuan' : 'Reset ke Pending';
        const color = status === 'APPROVED' ? '#10b981' : status === 'REJECTED' ? '#ef4444' : '#f59e0b';
        document.getElementById('ap-decide-title').textContent = title;
        document.getElementById('ap-decide-info').innerHTML =
            `<b>${this._esc(it.nama)}</b> · ${it.tipe} · ${it.jumlah_hari} hari<br>
             <span style="color:#64748b;">${it.tanggal_mulai} → ${it.tanggal_selesai}</span>`;
        document.getElementById('ap-decide-catatan').value = it.catatan_admin || '';
        const btn = document.getElementById('ap-decide-confirm');
        btn.style.background = color;
        btn.innerHTML = `<i class="fas fa-${status === 'APPROVED' ? 'check' : status === 'REJECTED' ? 'times' : 'undo'}"></i> ${title}`;
        document.getElementById('ap-decide-modal').style.display = 'flex';
    },

    closeDecide() {
        document.getElementById('ap-decide-modal').style.display = 'none';
        this._decideRow = null;
        this._decideStatus = null;
    },

    async confirmDecide() {
        if (!this._decideRow || !this._decideStatus) return;
        const btn = document.getElementById('ap-decide-confirm');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        try {
            const res = await api.post({
                action: 'decidePengajuan',
                rowId: this._decideRow,
                status: this._decideStatus,
                decided_by: (auth.user && (auth.user.name || auth.user.nama)) || 'admin',
                catatan_admin: document.getElementById('ap-decide-catatan').value.trim(),
                actor_id: (auth.user && auth.user.id) || '',
                actor_name: (auth.user && (auth.user.name || auth.user.nama)) || 'admin'
            });
            if (res && res.success) {
                this.closeDecide();
                this.load();
            } else {
                alert('Gagal: ' + ((res && res.error) || 'cek koneksi'));
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        } catch (err) {
            alert('Error: ' + err.message);
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    },

    async viewFoto(rowId) {
        const res = await api.post({ action: 'getPengajuanFoto', rowId: rowId });
        if (!res || !res.success || !res.image) { alert('Lampiran tidak tersedia'); return; }
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; cursor:pointer;';
        overlay.innerHTML = `<img src="${res.image}" style="max-width:100%; max-height:90vh; border-radius:8px;">`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    },

    // Dipanggil saat login (mirip approval badge) untuk preload count
    async preloadBadge() {
        try {
            const res = await api.post({ action: 'getAllPengajuan' });
            if (res && res.success) {
                this._items = res.data || [];
                this._updateBadge();
            }
        } catch (e) { /* silent */ }
    }
};

window.adminPengajuan = adminPengajuan;
