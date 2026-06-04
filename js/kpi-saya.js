/**
 * Portal Karyawan - KPI Saya (Phase 2)
 * Karyawan isi capaian harian per indikator + lihat skor bulan berjalan.
 */
const kpiSaya = {
    items: [],
    score: null,
    daily: [],        // semua capaian bulan ini
    tanggal: '',

    _esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    _actor() {
        const u = (typeof auth !== 'undefined' && auth.user) || {};
        return { actor_id: u.id || '', actor_name: u.name || u.nama || '' };
    },
    _today() {
        const n = new Date();
        return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
    },
    _bulan() { return this._today().substring(0, 7); },

    async init() {
        if (!this.tanggal) this.tanggal = this._today();
        await this.loadAll();
    },

    async loadAll() {
        const wrap = document.getElementById('kpi-saya-content');
        if (wrap) wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat KPI...</div>';
        const a = this._actor();
        try {
            const [resKpi, resScore, resDaily] = await Promise.all([
                api.post({ action: 'getEmployeeKpi', userId: a.actor_id, actor_id: a.actor_id }),
                api.post({ action: 'getKpiScore', userId: a.actor_id, actor_id: a.actor_id, bulan: this._bulan() }),
                api.post({ action: 'getKpiDaily', userId: a.actor_id, actor_id: a.actor_id, bulan: this._bulan() })
            ]);
            this.items = (resKpi && resKpi.success) ? (resKpi.items || []) : [];
            this.score = (resScore && resScore.success) ? resScore : null;
            this.daily = (resDaily && resDaily.success) ? (resDaily.data || []) : [];
        } catch (e) { this.items = []; }
        this.render();
    },

    _valueFor(itemId, tanggal) {
        const r = this.daily.find(x => String(x.kpi_item_id) === String(itemId) && x.tanggal === tanggal);
        return r ? r.nilai : '';
    },

    render() {
        const wrap = document.getElementById('kpi-saya-content');
        if (!wrap) return;
        if (!this.items.length) {
            wrap.innerHTML = '<div style="background:#f1f5f9;color:#64748b;padding:24px;border-radius:12px;text-align:center;">Belum ada KPI yang ditetapkan untukmu. Hubungi admin.</div>';
            return;
        }
        const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][parseInt(this._bulan().substring(5, 7)) - 1];

        // ---- Skor bulan ini ----
        let scoreHtml = '';
        if (this.score) {
            // Normalisasi: skor = % dari bobot aktual (aman walau total bobot != 100)
            const tb = Number(this.score.totalBobot) || 0;
            const total = tb > 0 ? ((Number(this.score.total) || 0) / tb * 100) : 0;
            const c = total >= 90 ? '#16a34a' : (total >= 70 ? '#f59e0b' : '#ef4444');
            const areaRows = (this.score.areas || []).map(ar => {
                const pc = Math.round(ar.persen);
                const bw = Math.min(100, pc);
                const bc = pc >= 90 ? '#16a34a' : (pc >= 70 ? '#f59e0b' : '#ef4444');
                return `<div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#475569;margin-bottom:3px;"><span>${this._esc(ar.area)}</span><b style="color:${bc};">${pc}%</b></div>
                    <div style="height:6px;background:#e2e8f0;border-radius:4px;overflow:hidden;"><div style="height:100%;width:${bw}%;background:${bc};"></div></div>
                </div>`;
            }).join('');
            scoreHtml = `
            <div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border-radius:14px;padding:18px;margin-bottom:16px;">
                <div style="font-size:12px;opacity:0.9;">Skor KPI ${namaBulan}</div>
                <div style="font-size:40px;font-weight:800;line-height:1;margin:4px 0;">${Math.round(total)}<small style="font-size:16px;opacity:0.8;">%</small></div>
                <div style="font-size:11px;opacity:0.85;">capaian dari ${this.score.totalBobot}% bobot aktif · ${this.score.workingDays} hari kerja/bulan</div>
            </div>
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:16px;">
                <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:10px;">Skor per Area</div>
                ${areaRows}
            </div>`;
        }

        // ---- Input capaian per tanggal ----
        // KUNCI: hanya HARI INI yang bisa diisi. Hari lampau = lihat saja. Besok = terkunci.
        const isToday = this.tanggal === this._today();
        const groups = {}; const order = [];
        this.items.forEach(it => { if (!groups[it.area]) { groups[it.area] = []; order.push(it.area); } groups[it.area].push(it); });
        let inputHtml = `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                <div style="font-size:13px;font-weight:700;color:#334155;"><i class="fas fa-${isToday ? 'pen' : 'eye'}" style="color:#7c3aed;"></i> ${isToday ? 'Isi Capaian Hari Ini' : 'Lihat Capaian'}</div>
                <input type="date" id="kpi-saya-tanggal" value="${this.tanggal}" max="${this._today()}" onchange="kpiSaya.changeDate(this.value)" style="padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">
            </div>
            ${isToday ? '' : '<div style="background:#fef9c3;color:#854d0e;border-radius:8px;padding:8px 11px;font-size:12px;margin-bottom:10px;"><i class="fas fa-lock"></i> Hari lampau hanya bisa <b>dilihat</b>. Pengisian hanya untuk hari ini.</div>'}`;
        order.forEach(area => {
            inputHtml += `<div style="background:#f8fafc;padding:7px 11px;border-radius:6px;font-weight:700;font-size:12px;color:#334155;margin:10px 0 8px;">${this._esc(area)}</div>`;
            groups[area].forEach(it => {
                const val = this._valueFor(it.id, this.tanggal);
                const inputAttr = isToday
                    ? `onchange="kpiSaya.saveItem('${this._esc(it.id)}', this.value)" style="width:80px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;text-align:center;font-size:15px;"`
                    : `readonly style="width:80px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;text-align:center;font-size:15px;background:#f8fafc;color:#94a3b8;"`;
                inputHtml += `<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:600;color:#1e293b;">${this._esc(it.indikator)}</div>
                        <div style="font-size:11px;color:#94a3b8;">Target: ${this._esc(it.target)} ${this._esc(it.satuan)} · ${this._esc(it.periode_target || it.periode)}</div>
                    </div>
                    <input type="number" min="0" step="any" value="${val}" placeholder="${isToday ? '0' : '-'}" id="kpi-in-${this._esc(it.id)}" ${inputAttr}>
                </div>`;
            });
        });
        inputHtml += `<div style="font-size:11px;color:#94a3b8;margin-top:12px;">${isToday ? 'Isi sesuai capaianmu hari ini. Tersimpan otomatis. Admin akan verifikasi.' : 'Mode lihat. Untuk mengisi, pilih tanggal hari ini.'}</div></div>`;

        wrap.innerHTML = scoreHtml + inputHtml;
    },

    changeDate(val) {
        this.tanggal = val || this._today();
        this.render();
    },

    async saveItem(itemId, val) {
        // KUNCI: hanya boleh simpan untuk hari ini
        if (this.tanggal !== this._today()) { alert('Hanya bisa mengisi capaian untuk hari ini.'); return; }
        const a = this._actor();
        const nilai = parseFloat(val) || 0;
        // update cache lokal
        const ex = this.daily.find(x => String(x.kpi_item_id) === String(itemId) && x.tanggal === this.tanggal);
        if (ex) ex.nilai = nilai; else this.daily.push({ kpi_item_id: String(itemId), tanggal: this.tanggal, nilai: nilai, status: 'PENDING' });
        const inp = document.getElementById('kpi-in-' + itemId);
        if (inp) { inp.style.borderColor = '#16a34a'; }
        try {
            const res = await api.post({ action: 'saveKpiDaily', userId: a.actor_id, kpi_item_id: itemId, tanggal: this.tanggal, nilai: nilai, actor_id: a.actor_id });
            if (!res || !res.success) { alert('❌ ' + ((res && res.error) || 'gagal simpan')); return; }
            // refresh skor saja (tanpa re-render input agar fokus tidak hilang)
            const resScore = await api.post({ action: 'getKpiScore', userId: a.actor_id, actor_id: a.actor_id, bulan: this._bulan() });
            if (resScore && resScore.success) { this.score = resScore; this._refreshScoreOnly(); }
        } catch (e) { alert('❌ Error: ' + e.message); }
    },

    _refreshScoreOnly() {
        // re-render hanya bagian skor di atas (cari elemen pertama). Paling simpel: render ulang penuh
        // tapi pertahankan tanggal & nilai input dari cache.
        this.render();
    }
};

window.kpiSaya = kpiSaya;
