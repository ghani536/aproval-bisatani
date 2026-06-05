/**
 * Portal Karyawan - Tugas Sopir (rotasi gudang)
 * Karyawan yang dijadwalkan admin → konfirmasi berangkat (hari-H) → tunggu ACC → honor.
 * Honor per berangkat (1x/hari), Senin–Kamis.
 */
const sopirSaya = {
    data: [],
    today: '',
    rate: 0,
    todaySopir: null,
    sudahPulang: false,

    _esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    _actor() {
        const u = (typeof auth !== 'undefined' && auth.user) || {};
        return { id: u.id || '', name: u.name || u.nama || '' };
    },
    _rp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); },
    _bulan() { return (this.today || '').substring(0, 7); },

    async init() { await this.load(); },

    async load() {
        const wrap = document.getElementById('sopir-saya-content');
        if (wrap) wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        const a = this._actor();
        try {
            const res = await api.post({ action: 'getMySopir', userId: a.id });
            if (res && res.success) {
                this.data = res.data || [];
                this.today = res.today || '';
                this.rate = Number(res.rate) || 0;
                this.todaySopir = res.todaySopir || null;
                this.sudahPulang = !!res.sudahPulang;
            } else { this.data = []; this.todaySopir = null; }
        } catch (e) { this.data = []; }
        this.render();
    },

    _badge(st) {
        const map = {
            'DIJADWALKAN': ['#eff6ff', '#1d4ed8', 'Dijadwalkan'],
            'PENDING': ['#fef9c3', '#854d0e', 'Menunggu ACC'],
            'DISETUJUI': ['#dcfce7', '#166534', 'Disetujui'],
            'DITOLAK': ['#fee2e2', '#991b1b', 'Ditolak']
        };
        const m = map[st] || ['#f1f5f9', '#64748b', st];
        return `<span style="background:${m[0]};color:${m[1]};padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">${m[2]}</span>`;
    },

    render() {
        const wrap = document.getElementById('sopir-saya-content');
        if (!wrap) return;

        // honor bulan ini (DISETUJUI)
        const bln = this._bulan();
        let honorBulan = 0, tripBulan = 0;
        this.data.forEach(t => { if (t.status === 'DISETUJUI' && String(t.tanggal).substring(0, 7) === bln) { honorBulan += Number(t.honor) || 0; tripBulan++; } });

        let html = `
        <div style="background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;border-radius:14px;padding:18px;margin-bottom:16px;">
            <div style="font-size:12px;opacity:0.9;">Honor Sopir Bulan Ini</div>
            <div style="font-size:34px;font-weight:800;line-height:1.1;margin:4px 0;">${this._rp(honorBulan)}</div>
            <div style="font-size:11px;opacity:0.85;">${tripBulan} berangkat disetujui · ${this._rp(this.rate)}/berangkat</div>
        </div>`;

        // Kartu aksi hari ini — berdasarkan status efektif (pola/ganti) dari server
        const ts = this.todaySopir;
        if (ts && (ts.status === 'POLA' || ts.status === 'DIJADWALKAN')) {
            const bisa = this.sudahPulang;
            html += `
            <div style="background:#fff;border:2px solid #0ea5e9;border-radius:12px;padding:16px;margin-bottom:16px;">
                <div style="font-size:13px;font-weight:700;color:#0369a1;margin-bottom:4px;"><i class="fas fa-truck"></i> Kamu sopir hari ini</div>
                ${bisa
                    ? `<div style="font-size:12px;color:#64748b;margin-bottom:10px;">Konfirmasi setelah selesai berangkat. Isi tujuan/catatan (opsional).</div>
                       <textarea id="sopir-catatan" rows="2" placeholder="Mis: antar ke Wonosobo & Magelang" style="width:100%;box-sizing:border-box;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:10px;resize:vertical;"></textarea>
                       <button onclick="sopirSaya.konfirmasi()" id="sopir-btn-konfirm" style="width:100%;background:#0ea5e9;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;"><i class="fas fa-check"></i> Konfirmasi Berangkat (${this._rp(this.rate)})</button>`
                    : `<div style="background:#fef9c3;color:#854d0e;border-radius:8px;padding:11px;font-size:12.5px;"><i class="fas fa-lock"></i> Selesaikan <b>Absen Pulang</b> dulu, baru bisa konfirmasi berangkat sopir.</div>`
                }
            </div>`;
        } else if (ts && (ts.status === 'PENDING' || ts.status === 'DISETUJUI')) {
            const acc = ts.status === 'DISETUJUI';
            const todayRow = this.data.find(t => t.tanggal === this.today);
            html += `
            <div style="background:${acc ? '#dcfce7' : '#fef9c3'};border-radius:12px;padding:14px 16px;margin-bottom:16px;">
                <div style="font-size:13px;font-weight:700;color:${acc ? '#166534' : '#854d0e'};">
                    <i class="fas fa-${acc ? 'check-circle' : 'hourglass-half'}"></i> ${acc ? 'Keberangkatan hari ini sudah disetujui ✓' : 'Keberangkatan hari ini menunggu ACC admin'}
                </div>
                ${todayRow && todayRow.catatan ? `<div style="font-size:12px;color:#475569;margin-top:5px;">Catatan: ${this._esc(todayRow.catatan)}</div>` : ''}
            </div>`;
        }

        // Riwayat
        html += `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:10px;">Riwayat Tugas Sopir</div>`;
        if (!this.data.length) {
            html += '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:14px;">Belum ada jadwal sopir.</div>';
        } else {
            this.data.forEach(t => {
                html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;">
                    <div style="min-width:0;">
                        <div style="font-size:13px;font-weight:600;color:#1e293b;">${this._esc(t.tanggal)}</div>
                        ${t.catatan ? `<div style="font-size:11px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;">${this._esc(t.catatan)}</div>` : ''}
                    </div>
                    <div style="text-align:right;white-space:nowrap;">
                        ${this._badge(t.status)}
                        ${t.status === 'DISETUJUI' ? `<div style="font-size:11px;color:#0f766e;font-weight:700;margin-top:2px;">+${this._rp(t.honor)}</div>` : ''}
                    </div>
                </div>`;
            });
        }
        html += '</div>';

        wrap.innerHTML = html;
    },

    async konfirmasi() {
        const btn = document.getElementById('sopir-btn-konfirm');
        const catatan = (document.getElementById('sopir-catatan') || {}).value || '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Menyimpan...'; }
        const a = this._actor();
        try {
            const res = await api.post({ action: 'konfirmasiSopir', userId: a.id, catatan: catatan });
            if (!res || !res.success) {
                alert('❌ ' + ((res && res.error) || 'Gagal konfirmasi'));
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Konfirmasi Berangkat'; }
                return;
            }
            alert('✅ Keberangkatan terkirim. Menunggu ACC admin.');
            await this.load();
        } catch (e) {
            alert('❌ Error: ' + e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Konfirmasi Berangkat'; }
        }
    }
};

window.sopirSaya = sopirSaya;
