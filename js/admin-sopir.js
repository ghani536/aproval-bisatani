/**
 * Admin - Sopir (rotasi gudang): Pola Mingguan + Ganti (izin) + ACC keberangkatan.
 * Pola tetap per hari (Sen–Kamis) → berlaku otomatis tiap minggu, tak perlu isi tanggal.
 */
const adminSopir = {
    employees: [],
    trips: [],
    pola: {},
    rate: 0,
    bulan: '',
    HARI: { 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis' },

    _esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    _actor() {
        const u = (typeof auth !== 'undefined' && auth.user) || {};
        return { actor_id: u.id || '', actor_name: u.name || u.nama || '' };
    },
    _rp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); },
    _thisBulan() {
        const n = new Date();
        return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
    },
    _range(bulan) {
        const y = parseInt(bulan.substring(0, 4)), m = parseInt(bulan.substring(5, 7));
        const pad = x => String(x).padStart(2, '0');
        const last = new Date(y, m, 0).getDate();
        return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
    },
    _isSenKam(tgl) {
        const m = String(tgl).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return false;
        const d = new Date(+m[1], +m[2] - 1, +m[3]).getDay();
        return d >= 1 && d <= 4;
    },

    async init() {
        if (!this.bulan) this.bulan = this._thisBulan();
        await this.load();
    },

    // Badge notif sidebar = jumlah keberangkatan sopir yang perlu di-ACC (PENDING)
    async refreshBadge() {
        try {
            const a = this._actor();
            if (!a.actor_id) return;
            const res = await api.post({ action: 'getSopirPendingCount', actor_id: a.actor_id });
            const badge = document.getElementById('sopir-acc-badge');
            if (!badge) return;
            const n = (res && res.success) ? Number(res.count) || 0 : 0;
            if (n > 0) { badge.textContent = n > 99 ? '99+' : n; badge.style.display = 'inline-block'; }
            else badge.style.display = 'none';
        } catch (e) { /* silent */ }
    },

    async load() {
        const wrap = document.getElementById('admin-sopir-content');
        if (wrap) wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        const a = this._actor();
        const r = this._range(this.bulan);
        try {
            const [resEmp, resTrip, resRate, resPola] = await Promise.all([
                this.employees.length ? Promise.resolve({ success: true, data: this.employees }) : api.post({ action: 'getEmployees' }),
                api.post({ action: 'getJadwalSopir', start: r.start, end: r.end, actor_id: a.actor_id }),
                api.post({ action: 'getSopirHonorRate' }),
                api.post({ action: 'getSopirPola' })
            ]);
            if (resEmp && resEmp.success) this.employees = resEmp.data || [];
            this.trips = (resTrip && resTrip.success) ? (resTrip.data || []) : [];
            this.rate = (resRate && resRate.success) ? (Number(resRate.rate) || 0) : 0;
            this.pola = (resPola && resPola.success) ? (resPola.data || {}) : {};
        } catch (e) { this.trips = []; }
        this.render();
        this.refreshBadge();
    },

    _gudangEmployees() {
        const g = this.employees.filter(e => {
            const s = (String(e.department || '') + ' ' + String(e.position || e.jabatan || '')).toLowerCase();
            return s.indexOf('gudang') !== -1;
        });
        return g.length ? g : this.employees;
    },
    _opts(selectedId) {
        const emps = this._gudangEmployees();
        let o = `<option value="">— kosong —</option>`;
        emps.forEach(e => {
            const id = this._esc(e.id);
            o += `<option value="${id}" ${String(e.id) === String(selectedId) ? 'selected' : ''}>${this._esc(e.name || e.nama)}</option>`;
        });
        return o;
    },

    _badge(st) {
        const map = {
            'DIJADWALKAN': ['#eff6ff', '#1d4ed8', 'Dijadwalkan'],
            'PENDING': ['#fef9c3', '#854d0e', 'Perlu ACC'],
            'DISETUJUI': ['#dcfce7', '#166534', 'Disetujui'],
            'DITOLAK': ['#fee2e2', '#991b1b', 'Ditolak']
        };
        const m = map[st] || ['#f1f5f9', '#64748b', st];
        return `<span style="background:${m[0]};color:${m[1]};padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">${m[2]}</span>`;
    },

    render() {
        const wrap = document.getElementById('admin-sopir-content');
        if (!wrap) return;
        const pending = this.trips.filter(t => t.status === 'PENDING').length;
        const honorBulan = this.trips.filter(t => t.status === 'DISETUJUI').reduce((s, t) => s + (Number(t.honor) || 0), 0);

        // ---- Pola Mingguan ----
        let polaRows = '';
        [1, 2, 3, 4].forEach(wd => {
            const cur = this.pola[String(wd)] ? this.pola[String(wd)].userId : '';
            polaRows += `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #f1f5f9;">
                <div style="width:62px;font-size:13px;font-weight:600;color:#334155;">${this.HARI[wd]}</div>
                <select onchange="adminSopir.savePola(${wd}, this.value)" style="flex:1;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">${this._opts(cur)}</select>
            </div>`;
        });

        let html = `
        <!-- Honor -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div style="font-size:13px;color:#334155;font-weight:600;"><i class="fas fa-money-bill-wave" style="color:#0ea5e9;"></i> Honor per berangkat:</div>
            <input type="number" id="sopir-rate" value="${this.rate}" min="0" step="1000" style="width:130px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;">
            <button onclick="adminSopir.saveRate()" style="background:#0ea5e9;color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Simpan</button>
        </div>

        <!-- Pola mingguan -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:14px;">
            <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:4px;"><i class="fas fa-calendar-week" style="color:#0ea5e9;"></i> Pola Sopir Mingguan</div>
            <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Set sekali → berlaku otomatis tiap minggu. Tak perlu isi tanggal.</div>
            ${polaRows}
        </div>

        <!-- Ganti (izin) -->
        <div style="background:#fff;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin-bottom:14px;">
            <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:4px;"><i class="fas fa-exchange-alt"></i> Ganti Sopir (izin/khusus)</div>
            <div style="font-size:11px;color:#a16207;margin-bottom:10px;">Untuk 1 tanggal tertentu saja (mis. yang giliran izin). Minggu depan balik ke pola.</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <input type="date" id="sopir-date" style="padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">
                <select id="sopir-emp" style="flex:1;min-width:140px;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">${this._opts('')}</select>
                <button onclick="adminSopir.ganti()" style="background:#f59e0b;color:#fff;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;"><i class="fas fa-exchange-alt"></i> Ganti</button>
            </div>
        </div>

        <!-- Keberangkatan -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
            <div style="font-size:13px;font-weight:700;color:#334155;"><i class="fas fa-truck" style="color:#0ea5e9;"></i> Keberangkatan</div>
            <input type="month" value="${this.bulan}" onchange="adminSopir.changeBulan(this.value)" style="padding:7px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">
        </div>
        <div style="font-size:12px;color:#475569;margin-bottom:10px;">
            ${pending ? `<span style="background:#ef4444;color:#fff;padding:2px 9px;border-radius:20px;font-weight:700;">${pending} perlu ACC</span> · ` : ''}
            Honor disetujui bulan ini: <b style="color:#0f766e;">${this._rp(honorBulan)}</b>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">`;

        const visible = this.trips.filter(t => t.status !== 'DITOLAK' || true); // tampilkan semua
        if (!visible.length) {
            html += '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:24px;">Belum ada keberangkatan di bulan ini.<br><span style="font-size:11px;">Muncul otomatis saat karyawan konfirmasi berangkat.</span></div>';
        } else {
            this.trips.forEach(t => {
                let actions = '';
                if (t.status === 'PENDING') {
                    actions = `<button onclick="adminSopir.verify('${this._esc(t.id)}',true)" style="background:#16a34a;color:#fff;border:none;padding:6px 11px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;">ACC</button>
                               <button onclick="adminSopir.verify('${this._esc(t.id)}',false)" style="background:#fee2e2;color:#991b1b;border:none;padding:6px 11px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;">Tolak</button>`;
                } else if (t.status === 'DIJADWALKAN') {
                    actions = `<span style="font-size:11px;color:#94a3b8;">menunggu berangkat</span> <button onclick="adminSopir.hapus('${this._esc(t.id)}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;"><i class="fas fa-trash"></i></button>`;
                } else if (t.status === 'DISETUJUI') {
                    actions = `<span style="font-size:12px;color:#0f766e;font-weight:700;">+${this._rp(t.honor)}</span>`;
                }
                html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid #f1f5f9;">
                    <div style="min-width:0;flex:1;">
                        <div style="font-size:13px;font-weight:600;color:#1e293b;">${this._esc(t.nama)}</div>
                        <div style="font-size:11px;color:#94a3b8;">${this._esc(t.tanggal)}${t.catatan ? ' · ' + this._esc(t.catatan) : ''}</div>
                    </div>
                    <div style="text-align:right;display:flex;align-items:center;gap:8px;white-space:nowrap;">
                        ${this._badge(t.status)}
                        ${actions}
                    </div>
                </div>`;
            });
        }
        html += '</div>';
        wrap.innerHTML = html;
    },

    changeBulan(v) { this.bulan = v || this._thisBulan(); this.load(); },

    async savePola(weekday, userId) {
        const a = this._actor();
        const res = await api.post({ action: 'saveSopirPola', weekday: weekday, userId: userId, actor_id: a.actor_id, actor_name: a.actor_name });
        if (res && res.success) {
            if (userId) {
                const e = this._gudangEmployees().find(x => String(x.id) === String(userId));
                this.pola[String(weekday)] = { userId: userId, nama: e ? (e.name || e.nama) : '' };
            } else { delete this.pola[String(weekday)]; }
        } else alert('❌ ' + ((res && res.error) || 'gagal'));
    },

    async saveRate() {
        const v = Number((document.getElementById('sopir-rate') || {}).value);
        if (isNaN(v) || v < 0) { alert('Nominal tidak valid.'); return; }
        const a = this._actor();
        const res = await api.post({ action: 'saveSopirHonorRate', rate: v, actor_id: a.actor_id, actor_name: a.actor_name });
        if (res && res.success) { this.rate = v; alert('✅ Honor per berangkat: ' + this._rp(v)); }
        else alert('❌ ' + ((res && res.error) || 'gagal'));
    },

    async ganti() {
        const tanggal = (document.getElementById('sopir-date') || {}).value;
        const userId = (document.getElementById('sopir-emp') || {}).value;
        if (!tanggal || !userId) { alert('Pilih tanggal & pengganti.'); return; }
        if (!this._isSenKam(tanggal)) { alert('⚠️ Sopir hanya Senin–Kamis.'); return; }
        const a = this._actor();
        const res = await api.post({ action: 'addJadwalSopir', userId: userId, tanggal: tanggal, actor_id: a.actor_id, actor_name: a.actor_name });
        if (res && res.success) { await this.load(); }
        else alert('❌ ' + ((res && res.error) || 'gagal'));
    },

    async hapus(id) {
        if (!confirm('Hapus keberangkatan ini?')) return;
        const a = this._actor();
        const res = await api.post({ action: 'deleteJadwalSopir', id: id, actor_id: a.actor_id, actor_name: a.actor_name });
        if (res && res.success) await this.load();
        else alert('❌ ' + ((res && res.error) || 'gagal'));
    },

    async verify(id, approve) {
        if (!confirm(approve ? 'Setujui keberangkatan ini? Honor akan dihitung.' : 'Tolak keberangkatan ini?')) return;
        const a = this._actor();
        const res = await api.post({ action: 'verifySopir', id: id, approve: approve, actor_id: a.actor_id, actor_name: a.actor_name });
        if (res && res.success) await this.load();
        else alert('❌ ' + ((res && res.error) || 'gagal'));
    }
};

window.adminSopir = adminSopir;
