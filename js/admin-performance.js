/**
 * Portal Admin - Performance Review
 * Review kinerja karyawan per quarter dengan 4 kategori (5-star rating)
 */
const adminPerformance = {
    employees: [],
    reviews: [],
    _editId: null,
    _selectedEmp: null,

    CATEGORIES: [
        { key: 'kehadiran', label: 'Kehadiran', icon: 'fa-clock', desc: 'Ketepatan & konsistensi datang' },
        { key: 'produktivitas', label: 'Produktivitas', icon: 'fa-tasks', desc: 'Output kerja & target' },
        { key: 'attitude', label: 'Attitude', icon: 'fa-smile', desc: 'Sikap & kerjasama tim' },
        { key: 'kpi', label: 'KPI', icon: 'fa-bullseye', desc: 'Pencapaian indikator kunci' }
    ],

    async init() {
        this._populateTahunFilter();
        await this.load();
    },

    _esc(s) {
        return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _populateTahunFilter() {
        const sel = document.getElementById('perf-tahun-filter');
        if (!sel || sel.options.length > 0) return;
        const now = new Date().getFullYear();
        const allOpt = document.createElement('option');
        allOpt.value = ''; allOpt.textContent = 'Semua Tahun';
        sel.appendChild(allOpt);
        for (let y = now + 1; y >= now - 2; y--) {
            const opt = document.createElement('option');
            opt.value = y; opt.textContent = y;
            if (y === now) opt.selected = true;
            sel.appendChild(opt);
        }
    },

    async load() {
        try {
            const [resEmp, resPerf] = await Promise.all([
                api.post({ action: 'getEmployees' }),
                api.post({ action: 'getPerformanceReviews' })
            ]);
            this.employees = (resEmp && resEmp.success) ? (resEmp.data || []) : [];
            this.reviews = (resPerf && resPerf.success) ? (resPerf.data || []) : [];
            this.render();
        } catch (e) {
            console.error(e);
        }
    },

    render() {
        const wrap = document.getElementById('perf-list');
        if (!wrap) return;
        if (this.employees.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px;">Belum ada karyawan</div>';
            return;
        }
        const qFilter = document.getElementById('perf-quarter-filter')?.value || '';
        const yFilter = document.getElementById('perf-tahun-filter')?.value || '';

        wrap.innerHTML = this.employees.map(emp => {
            const myReviews = this.reviews.filter(r => {
                if (String(r.userId) !== String(emp.id)) return false;
                if (qFilter && ('Q' + r.quarter) !== qFilter) return false;
                if (yFilter && String(r.tahun) !== String(yFilter)) return false;
                return true;
            });
            const latest = myReviews[0];
            const totalAvg = myReviews.length > 0
                ? (myReviews.reduce((sum, r) => sum + Number(r.total || 0), 0) / myReviews.length).toFixed(2)
                : null;
            return `<div style="border:1px solid #e2e8f0; padding:14px; border-radius:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                <div style="flex:1; min-width:160px;">
                    <div style="font-weight:600; color:#1e293b;">${this._esc(emp.name)}</div>
                    <div style="font-size:11px; color:#64748b;">${this._esc(emp.position || '-')} · ${myReviews.length} review${myReviews.length !== 1 ? 's' : ''}</div>
                </div>
                ${latest ? `<div style="text-align:center; min-width:80px;">
                    <div style="font-size:10px; color:#64748b;">Q${latest.quarter} ${latest.tahun}</div>
                    <div style="font-size:18px; font-weight:700; color:${this._scoreColor(latest.total)};">${Number(latest.total).toFixed(1)}</div>
                    <div style="font-size:10px; color:#94a3b8;">${this._stars(latest.total)}</div>
                </div>` : '<div style="font-size:11px; color:#94a3b8; min-width:80px; text-align:center;">Belum ada review</div>'}
                ${totalAvg ? `<div style="text-align:center; min-width:70px;">
                    <div style="font-size:10px; color:#64748b;">Avg</div>
                    <div style="font-size:14px; font-weight:600; color:#475569;">${totalAvg}</div>
                </div>` : ''}
                <div style="display:flex; gap:4px;">
                    ${myReviews.length > 0 ? `<button onclick="adminPerformance.showHistory('${String(emp.id).replace(/'/g, "\\'")}')" style="background:#dbeafe; color:#1e40af; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:12px;"><i class="fas fa-history"></i> Riwayat</button>` : ''}
                    <button onclick="adminPerformance.openForm('${String(emp.id).replace(/'/g, "\\'")}')" style="background:#7c3aed; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;"><i class="fas fa-plus"></i> Review Baru</button>
                </div>
            </div>`;
        }).join('');
    },

    _scoreColor(score) {
        const s = Number(score) || 0;
        if (s >= 4) return '#10b981';
        if (s >= 3) return '#3b82f6';
        if (s >= 2) return '#f59e0b';
        return '#ef4444';
    },

    _stars(score) {
        const s = Math.round(Number(score) || 0);
        return '★'.repeat(s) + '☆'.repeat(5 - s);
    },

    openForm(empId, editReview) {
        const emp = this.employees.find(e => String(e.id) === String(empId));
        if (!emp) return;
        this._selectedEmp = emp;
        this._editId = editReview ? editReview.id : null;

        document.getElementById('perf-modal-title').innerHTML = editReview
            ? '<i class="fas fa-edit" style="color:#7c3aed;"></i> Edit Review'
            : '<i class="fas fa-star" style="color:#7c3aed;"></i> Review Baru';
        document.getElementById('perf-form-emp-info').innerHTML =
            `<b>${this._esc(emp.name)}</b> (${this._esc(emp.id)}) · ${this._esc(emp.position || '-')}`;

        const now = new Date();
        document.getElementById('perf-quarter').value = editReview ? editReview.quarter : (Math.floor(now.getMonth() / 3) + 1);
        document.getElementById('perf-tahun').value = editReview ? editReview.tahun : now.getFullYear();

        // Render 4 score sliders
        const wrap = document.getElementById('perf-scores-wrap');
        wrap.innerHTML = this.CATEGORIES.map(cat => {
            const val = editReview ? editReview[cat.key] : 3;
            return `<div style="margin-bottom:14px;">
                <label style="font-size:12px; font-weight:700; color:#475569; display:flex; justify-content:space-between; align-items:center;">
                    <span><i class="fas ${cat.icon}" style="color:#7c3aed;"></i> ${cat.label} <small style="color:#94a3b8; font-weight:400;">${cat.desc}</small></span>
                    <span id="perf-score-${cat.key}-val" style="font-size:16px; color:#7c3aed;">${val}/5</span>
                </label>
                <input type="range" id="perf-score-${cat.key}" min="1" max="5" step="1" value="${val}" oninput="adminPerformance._updateScore()" style="width:100%; margin-top:6px; accent-color:#7c3aed;">
                <div id="perf-stars-${cat.key}" style="text-align:center; font-size:20px; color:#fbbf24; letter-spacing:4px;">${this._stars(val)}</div>
            </div>`;
        }).join('');

        document.getElementById('perf-catatan').value = editReview ? (editReview.catatan || '') : '';
        this._updateScore();
        document.getElementById('modal-perf').style.display = 'flex';
    },

    _updateScore() {
        let total = 0, count = 0;
        this.CATEGORIES.forEach(cat => {
            const el = document.getElementById('perf-score-' + cat.key);
            if (el) {
                const v = Number(el.value) || 0;
                document.getElementById('perf-score-' + cat.key + '-val').textContent = v + '/5';
                document.getElementById('perf-stars-' + cat.key).textContent = this._stars(v);
                total += v;
                count++;
            }
        });
        const avg = count > 0 ? (total / count) : 0;
        const totalEl = document.getElementById('perf-total-preview');
        if (totalEl) {
            totalEl.textContent = avg.toFixed(2) + ' / 5';
            totalEl.style.color = this._scoreColor(avg);
        }
    },

    async save() {
        if (!this._selectedEmp) return;
        const quarter = Number(document.getElementById('perf-quarter').value);
        const tahun = Number(document.getElementById('perf-tahun').value);
        if (!quarter || !tahun) { alert('Quarter & tahun wajib'); return; }
        const payload = {
            action: 'savePerformanceReview',
            userId: this._selectedEmp.id,
            nama: this._selectedEmp.name,
            quarter, tahun,
            kehadiran: Number(document.getElementById('perf-score-kehadiran').value),
            produktivitas: Number(document.getElementById('perf-score-produktivitas').value),
            attitude: Number(document.getElementById('perf-score-attitude').value),
            kpi: Number(document.getElementById('perf-score-kpi').value),
            catatan: document.getElementById('perf-catatan').value.trim(),
            dibuat_oleh: (auth.user && (auth.user.name || auth.user.nama)) || 'admin'
        };
        if (this._editId) payload.id = this._editId;
        try {
            const res = await api.post(payload);
            if (res && res.success) {
                document.getElementById('modal-perf').style.display = 'none';
                this.load();
            } else {
                alert('❌ ' + ((res && res.error) || 'gagal'));
            }
        } catch (e) {
            alert('❌ Error: ' + e.message);
        }
    },

    showHistory(empId) {
        const emp = this.employees.find(e => String(e.id) === String(empId));
        if (!emp) return;
        const reviews = this.reviews.filter(r => String(r.userId) === String(empId))
            .sort((a, b) => (b.tahun * 10 + b.quarter) - (a.tahun * 10 + a.quarter));

        const wrap = document.getElementById('perf-history-content');
        if (reviews.length === 0) {
            wrap.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px;">Belum ada riwayat review untuk ${this._esc(emp.name)}</div>`;
        } else {
            wrap.innerHTML = `<div style="background:#f8fafc; padding:10px 12px; border-radius:8px; margin-bottom:12px; font-size:13px; color:#475569;">
                <b>${this._esc(emp.name)}</b> · ${reviews.length} review · Avg: <b>${(reviews.reduce((s, r) => s + Number(r.total || 0), 0) / reviews.length).toFixed(2)}</b>/5
            </div>` + reviews.map(r => `<div style="border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                    <div>
                        <div style="font-weight:700; color:#1e293b;">Q${r.quarter} ${r.tahun}</div>
                        <div style="font-size:11px; color:#94a3b8;">${r.dibuat_pada} oleh ${this._esc(r.dibuat_oleh)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:20px; font-weight:700; color:${this._scoreColor(r.total)};">${Number(r.total).toFixed(2)}</div>
                        <div style="font-size:14px; color:#fbbf24;">${this._stars(r.total)}</div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:8px;">
                    ${this.CATEGORIES.map(cat => `<div style="background:#f1f5f9; padding:6px 8px; border-radius:6px; text-align:center;">
                        <div style="font-size:10px; color:#64748b;">${cat.label}</div>
                        <div style="font-size:14px; font-weight:600; color:${this._scoreColor(r[cat.key])};">${r[cat.key]}/5</div>
                    </div>`).join('')}
                </div>
                ${r.catatan ? `<div style="font-size:12px; color:#475569; background:#fffbeb; padding:8px 10px; border-radius:6px; border-left:3px solid #f59e0b;"><b>Catatan:</b> ${this._esc(r.catatan)}</div>` : ''}
                <div style="display:flex; gap:4px; justify-content:flex-end; margin-top:8px;">
                    <button onclick='adminPerformance.openForm("${String(empId).replace(/"/g, "\\\"")}", ${JSON.stringify(r).replace(/'/g, "\\'")})' style="background:#dbeafe; color:#1e40af; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:11px;"><i class="fas fa-edit"></i> Edit</button>
                    <button onclick="adminPerformance.del(${r.id})" style="background:#fee2e2; color:#dc2626; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:11px;"><i class="fas fa-trash"></i> Hapus</button>
                </div>
            </div>`).join('');
        }
        document.getElementById('modal-perf-history').style.display = 'flex';
    },

    async del(id) {
        if (!confirm('Hapus review ini?')) return;
        try {
            const res = await api.post({ action: 'deletePerformanceReview', id: id });
            if (res && res.success) {
                document.getElementById('modal-perf-history').style.display = 'none';
                this.load();
            } else alert('❌ ' + ((res && res.error) || 'gagal'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    }
};

window.adminPerformance = adminPerformance;
