/**
 * Portal Admin - Pengumuman
 * CRUD pengumuman yang tampil sebagai banner di dashboard karyawan
 */
const adminPengumuman = {
    items: [],
    _editId: null,

    init() {
        this.load();
    },

    _esc(s) {
        return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    async load() {
        const wrap = document.getElementById('pengumuman-list');
        wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        try {
            const res = await api.post({ action: 'getAllPengumuman' });
            if (!res || !res.success) {
                wrap.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Gagal: ${(res && res.error) || 'cek koneksi'}</div>`;
                return;
            }
            this.items = res.data || [];
            this.render();
        } catch (e) {
            wrap.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Error: ${e.message}</div>`;
        }
    },

    render() {
        const wrap = document.getElementById('pengumuman-list');
        if (this.items.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px;"><i class="fas fa-inbox" style="font-size:2rem; opacity:0.5;"></i><p style="margin:8px 0 0;">Belum ada pengumuman. Klik <b>Pengumuman Baru</b> untuk mulai.</p></div>';
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const prioColor = { 'tinggi': '#ef4444', 'sedang': '#f59e0b', 'normal': '#3b82f6', 'rendah': '#94a3b8' };
        const prioBg = { 'tinggi': '#fee2e2', 'sedang': '#fef3c7', 'normal': '#dbeafe', 'rendah': '#f1f5f9' };

        wrap.innerHTML = this.items.map(p => {
            const aktif = p.tanggal_mulai <= today && (!p.tanggal_expired || p.tanggal_expired >= today);
            const expired = p.tanggal_expired && p.tanggal_expired < today;
            const upcoming = p.tanggal_mulai > today;
            const status = aktif ? 'AKTIF' : expired ? 'EXPIRED' : upcoming ? 'UPCOMING' : '—';
            const statusColor = aktif ? '#10b981' : expired ? '#94a3b8' : '#f59e0b';
            return `<div style="border:1px solid #e2e8f0; border-left:4px solid ${prioColor[p.prioritas] || '#3b82f6'}; padding:14px; border-radius:8px; margin-bottom:10px; ${expired ? 'opacity:0.7;' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:start; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
                    <div style="flex:1; min-width:200px;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span style="font-size:14px; font-weight:700; color:#1e293b;">${this._esc(p.judul)}</span>
                            <span style="background:${prioBg[p.prioritas] || '#dbeafe'}; color:${prioColor[p.prioritas] || '#3b82f6'}; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:700; text-transform:uppercase;">${p.prioritas}</span>
                            <span style="background:#fff; border:1px solid ${statusColor}; color:${statusColor}; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:700;">${status}</span>
                        </div>
                        <div style="font-size:11px; color:#64748b; margin-top:2px;">${p.tanggal_mulai} → ${p.tanggal_expired || 'tidak expired'} · oleh ${this._esc(p.dibuat_oleh)}</div>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button onclick="adminPengumuman.edit(${p.id})" style="background:#dbeafe; color:#1e40af; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px;"><i class="fas fa-edit"></i></button>
                        <button onclick="adminPengumuman.del(${p.id})" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px;"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div style="font-size:13px; color:#475569; background:#f8fafc; padding:8px 10px; border-radius:6px; white-space:pre-wrap;">${this._esc(p.isi)}</div>
            </div>`;
        }).join('');
    },

    openForm() {
        this._editId = null;
        document.getElementById('pgm-modal-title').innerHTML = '<i class="fas fa-bullhorn" style="color:#f59e0b;"></i> Pengumuman Baru';
        document.getElementById('pgm-judul').value = '';
        document.getElementById('pgm-isi').value = '';
        document.getElementById('pgm-mulai').value = new Date().toISOString().slice(0, 10);
        document.getElementById('pgm-expired').value = '';
        document.getElementById('pgm-prioritas').value = 'normal';
        document.getElementById('modal-pengumuman').style.display = 'flex';
    },

    edit(id) {
        const p = this.items.find(x => x.id === id);
        if (!p) return;
        this._editId = id;
        document.getElementById('pgm-modal-title').innerHTML = '<i class="fas fa-edit" style="color:#f59e0b;"></i> Edit Pengumuman';
        document.getElementById('pgm-judul').value = p.judul;
        document.getElementById('pgm-isi').value = p.isi;
        document.getElementById('pgm-mulai').value = p.tanggal_mulai;
        document.getElementById('pgm-expired').value = p.tanggal_expired || '';
        document.getElementById('pgm-prioritas').value = p.prioritas || 'normal';
        document.getElementById('modal-pengumuman').style.display = 'flex';
    },

    async save() {
        const judul = document.getElementById('pgm-judul').value.trim();
        const isi = document.getElementById('pgm-isi').value.trim();
        const mulai = document.getElementById('pgm-mulai').value;
        const expired = document.getElementById('pgm-expired').value;
        const prio = document.getElementById('pgm-prioritas').value;
        if (!judul || !isi || !mulai) { alert('Judul, isi, dan tanggal mulai wajib diisi'); return; }
        try {
            const user = auth.user || {};
            const payload = {
                action: 'savePengumuman',
                judul, isi,
                tanggal_mulai: mulai,
                tanggal_expired: expired,
                prioritas: prio,
                dibuat_oleh: user.name || user.nama || 'admin'
            };
            if (this._editId) payload.id = this._editId;
            const res = await api.post(payload);
            if (res && res.success) {
                document.getElementById('modal-pengumuman').style.display = 'none';
                this.load();
            } else {
                alert('❌ ' + ((res && res.error) || 'gagal'));
            }
        } catch (e) {
            alert('❌ Error: ' + e.message);
        }
    },

    async del(id) {
        const p = this.items.find(x => x.id === id);
        if (!p) return;
        if (!confirm(`Hapus pengumuman "${p.judul}"?`)) return;
        try {
            const res = await api.post({ action: 'deletePengumuman', id: id });
            if (res && res.success) this.load();
            else alert('❌ ' + ((res && res.error) || 'gagal'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    }
};

window.adminPengumuman = adminPengumuman;
