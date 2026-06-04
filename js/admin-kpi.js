/**
 * Portal Super Admin - KPI & Jobdesk
 * Kelola template KPI per divisi + KPI/jobdesk tiap karyawan
 */
const adminKpi = {
    employees: [],
    divisiList: [],
    currentTab: 'employee',
    currentUserId: '',
    currentDivisi: '',
    empItems: [],
    empJobdesk: [],
    tplItems: [],

    _actor() {
        const u = (typeof auth !== 'undefined' && auth.user) || {};
        return { actor_id: u.id || '', actor_name: u.name || u.nama || '' };
    },

    _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    async init() {
        this.switchTab(this.currentTab || 'ringkasan');
        await this._loadEmployees();
        await this._loadDivisiList(this.currentDivisi);
        this.loadTemplates();
    },

    switchTab(tab) {
        this.currentTab = tab;
        const tabs = ['ringkasan', 'employee', 'template'];
        tabs.forEach(t => {
            const pane = document.getElementById('kpi-tab-' + t);
            if (pane) pane.style.display = t === tab ? 'block' : 'none';
            const btn = document.getElementById('kpi-tabbtn-' + t);
            if (btn) {
                const on = t === tab;
                btn.style.borderBottomColor = on ? '#7c3aed' : 'transparent';
                btn.style.color = on ? '#7c3aed' : '#64748b';
                btn.style.fontWeight = on ? '700' : '600';
            }
        });
        if (tab === 'ringkasan') this.loadRingkasan();
    },

    _bulanIni() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); },

    // ---------- RINGKASAN NILAI (semua karyawan, 1 pintu) ----------
    async loadRingkasan() {
        const wrap = document.getElementById('kpi-ringkasan-content');
        if (!wrap) return;
        wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;"><i class="fas fa-sync fa-spin"></i> Memuat nilai semua karyawan...</div>';
        const a = this._actor();
        const bulan = this._bulanIni();
        if (!this.employees || !this.employees.length) await this._loadEmployees();
        const emps = (this.employees || []).filter(e => !['admin', 'superadmin'].includes(String(e.role || '').toLowerCase()));
        try {
            const results = await Promise.all(emps.map(e =>
                api.post({ action: 'getKpiScore', userId: e.id, actor_id: a.actor_id, bulan: bulan })
                    .then(r => ({ emp: e, score: (r && r.success) ? r : null }))
                    .catch(() => ({ emp: e, score: null }))
            ));
            const rows = results.filter(x => x.score && (x.score.items || []).length > 0)
                .map(x => ({ id: x.emp.id, name: x.emp.name, dept: x.emp.department || '-', jumlah: x.score.items.length, total: Number(x.score.total) || 0, totalBobot: x.score.totalBobot }))
                .sort((p, q) => q.total - p.total);
            if (!rows.length) { wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;">Belum ada karyawan dengan KPI. Assign dulu di tab "Per Karyawan".</div>'; return; }
            const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][parseInt(bulan.substring(5, 7)) - 1];
            wrap.innerHTML = `
                <p style="color:#64748b;font-size:13px;margin:0 0 12px;">Skor KPI semua karyawan — <b>${namaBulan}</b>. Klik nama untuk lihat detail.</p>
                <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:480px;">
                <thead><tr style="background:#f8fafc;text-align:left;">
                    <th style="padding:9px 8px;font-size:11px;color:#64748b;">#</th>
                    <th style="padding:9px 8px;font-size:11px;color:#64748b;">Karyawan</th>
                    <th style="padding:9px 8px;font-size:11px;color:#64748b;">Divisi</th>
                    <th style="padding:9px 8px;font-size:11px;color:#64748b;text-align:center;">Indikator</th>
                    <th style="padding:9px 8px;font-size:11px;color:#64748b;text-align:right;">Skor</th>
                </tr></thead><tbody>
                ${rows.map((r, i) => {
                const c = r.total >= 90 ? '#16a34a' : (r.total >= 70 ? '#f59e0b' : '#ef4444');
                return `<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="adminKpi.openDetail('${this._esc(r.id)}')">
                        <td style="padding:9px 8px;font-size:12px;color:#94a3b8;">${i + 1}</td>
                        <td style="padding:9px 8px;font-size:13px;font-weight:600;color:#2563eb;border-bottom:1px dotted #cbd5e1;">${this._esc(r.name)}</td>
                        <td style="padding:9px 8px;font-size:12px;color:#64748b;">${this._esc(r.dept)}</td>
                        <td style="padding:9px 8px;font-size:12px;text-align:center;">${r.jumlah}</td>
                        <td style="padding:9px 8px;font-size:15px;font-weight:800;color:${c};text-align:right;">${Math.round(r.total)}%</td>
                    </tr>`;
            }).join('')}
                </tbody></table></div>`;
        } catch (e) { wrap.innerHTML = `<div style="color:#ef4444;padding:20px;">Error: ${e.message}</div>`; }
    },

    openDetail(userId) {
        this.switchTab('employee');
        const sel = document.getElementById('kpi-emp-select');
        if (sel) sel.value = userId;
        this.loadEmployeeKpi();
    },

    closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    },

    // ---------- LOADERS ----------
    async _loadEmployees() {
        try {
            const res = await api.post({ action: 'getEmployees' });
            if (res && res.success) {
                this.employees = res.data || [];
                const sel = document.getElementById('kpi-emp-select');
                const cur = sel.value;
                sel.innerHTML = '<option value="">— pilih karyawan —</option>' + this.employees.map(e =>
                    `<option value="${this._esc(e.id)}">${this._esc(e.name)}${e.department ? ' · ' + this._esc(e.department) : ''}</option>`).join('');
                if (cur) sel.value = cur;
            }
        } catch (e) { /* silent */ }
    },

    async _loadDivisiList(preferDivisi) {
        try {
            const res = await api.post({ action: 'getKpiTemplates' });
            if (res && res.success) {
                this.divisiList = res.divisiList || [];
                const tsel = document.getElementById('kpi-tpl-divisi');
                if (tsel) {
                    tsel.innerHTML = this.divisiList.length
                        ? this.divisiList.map(d => `<option value="${this._esc(d)}">${this._esc(d)}</option>`).join('')
                        : '<option value="">(belum ada divisi)</option>';
                    if (preferDivisi && this.divisiList.indexOf(preferDivisi) >= 0) tsel.value = preferDivisi;
                    this.currentDivisi = tsel.value;
                }
            }
        } catch (e) { /* silent */ }
    },

    async loadTemplates() {
        const sel = document.getElementById('kpi-tpl-divisi');
        this.currentDivisi = sel ? sel.value : '';
        const wrap = document.getElementById('kpi-tpl-content');
        if (!wrap) return;
        if (!this.currentDivisi) {
            wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;">Belum ada template. Klik "Tambah Indikator" untuk membuat divisi baru.</div>';
            this.tplItems = [];
            return;
        }
        wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        try {
            const res = await api.post({ action: 'getKpiTemplates', divisi: this.currentDivisi });
            if (!res || !res.success) {
                wrap.innerHTML = `<div style="color:#ef4444;padding:20px;">${(res && res.error) || 'gagal memuat'}</div>`;
                return;
            }
            this.tplItems = res.data || [];
            wrap.innerHTML = this._renderItems(this.tplItems, 'template');
        } catch (e) {
            wrap.innerHTML = `<div style="color:#ef4444;padding:20px;">Error: ${e.message}</div>`;
        }
    },

    async loadEmployeeKpi() {
        const sel = document.getElementById('kpi-emp-select');
        this.currentUserId = sel.value;
        const wrap = document.getElementById('kpi-emp-content');
        if (!this.currentUserId) {
            wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;">Pilih karyawan untuk melihat KPI &amp; jobdesk-nya.</div>';
            return;
        }
        wrap.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        try {
            const a = this._actor();
            const res = await api.post({ action: 'getEmployeeKpi', userId: this.currentUserId, actor_id: a.actor_id });
            if (!res || !res.success) {
                wrap.innerHTML = `<div style="color:#ef4444;padding:20px;">${(res && res.error) || 'gagal memuat'}</div>`;
                return;
            }
            this.empItems = res.items || [];
            this.empJobdesk = res.jobdesk || [];
            try {
                const bulan = (function () { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); })();
                this.empBulan = bulan;
                const rs = await api.post({ action: 'getKpiScore', userId: this.currentUserId, actor_id: a.actor_id, bulan: bulan });
                this.empScore = (rs && rs.success) ? rs : null;
            } catch (e) { this.empScore = null; }
            this._renderEmployee(wrap);
        } catch (e) {
            wrap.innerHTML = `<div style="color:#ef4444;padding:20px;">Error: ${e.message}</div>`;
        }
    },

    _renderScoreCard() {
        if (!this.empScore) return '';
        const s = this.empScore;
        const total = Number(s.total) || 0;
        const c = total >= 90 ? '#16a34a' : (total >= 70 ? '#f59e0b' : '#ef4444');
        const areaRows = (s.areas || []).map(ar => {
            const pc = Math.round(ar.persen); const bw = Math.min(100, pc);
            const bc = pc >= 90 ? '#16a34a' : (pc >= 70 ? '#f59e0b' : '#ef4444');
            return `<div style="margin-bottom:7px;"><div style="display:flex;justify-content:space-between;font-size:11px;color:#475569;margin-bottom:2px;"><span>${this._esc(ar.area)}</span><b style="color:${bc};">${pc}%</b></div><div style="height:5px;background:#e2e8f0;border-radius:4px;overflow:hidden;"><div style="height:100%;width:${bw}%;background:${bc};"></div></div></div>`;
        }).join('');
        const itemRows = (s.items || []).map(it => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:5px 6px;font-size:11px;">${this._esc(it.indikator)}</td><td style="padding:5px 6px;font-size:11px;text-align:right;">${it.achieved}/${it.expected}</td><td style="padding:5px 6px;font-size:11px;text-align:right;color:#0f766e;font-weight:600;">${(Number(it.skor)||0).toFixed(1)}</td></tr>`).join('');
        return `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:14px 16px;margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h4 style="margin:0;"><i class="fas fa-chart-line" style="color:#7c3aed;"></i> Skor Bulan Ini</h4>
                <button onclick="adminKpi.openVerifyModal()" style="background:#ede9fe;color:#5b21b6;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;"><i class="fas fa-check-double"></i> Verifikasi Capaian</button>
            </div>
            <div style="font-size:34px;font-weight:800;color:${c};line-height:1;">${Math.round(total)}<small style="font-size:14px;color:#94a3b8;">% / ${s.totalBobot}%</small></div>
            <div style="font-size:11px;color:#94a3b8;margin:2px 0 12px;">${s.workingDays} hari kerja/bulan</div>
            ${areaRows}
            <details style="margin-top:10px;"><summary style="cursor:pointer;font-size:12px;color:#7c3aed;font-weight:600;">Rincian per indikator</summary>
            <table style="width:100%;border-collapse:collapse;margin-top:8px;"><thead><tr style="text-align:left;"><th style="font-size:10px;color:#94a3b8;padding:4px 6px;">Indikator</th><th style="font-size:10px;color:#94a3b8;padding:4px 6px;text-align:right;">Capaian/Target</th><th style="font-size:10px;color:#94a3b8;padding:4px 6px;text-align:right;">Skor</th></tr></thead><tbody>${itemRows}</tbody></table></details>
        </div>`;
    },

    // ---------- RENDER ----------
    _renderItems(items, mode) {
        if (!items.length) return '<div style="text-align:center;color:#94a3b8;padding:24px;">Belum ada indikator.</div>';
        const groups = {};
        const order = [];
        items.forEach(it => {
            const key = it.area || '(Tanpa Area)';
            if (!groups[key]) { groups[key] = { ua: it.urutan_area || 0, rows: [] }; order.push(key); }
            groups[key].rows.push(it);
        });
        order.sort((a, b) => groups[a].ua - groups[b].ua);
        const totalBobot = items.filter(i => i.aktif).reduce((s, i) => s + (Number(i.bobot) || 0), 0);
        const ok = totalBobot === 100;
        const c = ok ? '#10b981' : '#f59e0b';
        let html = `<div style="display:inline-block;background:${c}1a;color:${c};padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:14px;">Total Bobot Aktif: ${totalBobot}%${ok ? '' : ' · idealnya 100%'}</div>`;
        order.forEach(area => {
            const g = groups[area];
            g.rows.sort((a, b) => a.urutan - b.urutan);
            html += `<div style="margin-bottom:14px;">
                <div style="background:#f1f5f9;padding:8px 12px;border-radius:6px;font-weight:700;font-size:13px;color:#334155;margin-bottom:6px;">${this._esc(area)}</div>`;
            g.rows.forEach(it => {
                const src = (it.source && mode === 'employee')
                    ? `<span style="font-size:10px;background:${it.source === 'TEMPLATE' ? '#dbeafe' : '#fef3c7'};color:${it.source === 'TEMPLATE' ? '#1e40af' : '#92400e'};padding:1px 6px;border-radius:4px;margin-left:6px;">${this._esc(it.source)}</span>`
                    : '';
                html += `<div style="display:flex;gap:10px;align-items:start;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;${it.aktif ? '' : 'opacity:0.55;'}">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:600;color:#1e293b;">${this._esc(it.indikator)}${src}</div>
                        <div style="font-size:11px;color:#64748b;margin-top:3px;">Target: <b>${this._esc(it.target)}</b> ${this._esc(it.satuan)} · ${this._esc(it.periode_target)} · Bobot: <b>${this._esc(it.bobot)}%</b></div>
                        ${it.sop ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;">${this._esc(it.sop)}</div>` : ''}
                    </div>
                    <button onclick="adminKpi.openItemModal('${mode}', '${this._esc(it.id)}')" style="background:#dbeafe;color:#1e40af;border:none;padding:5px 9px;border-radius:5px;cursor:pointer;font-size:12px;"><i class="fas fa-edit"></i></button>
                    <button onclick="adminKpi.deleteItem('${mode}', '${this._esc(it.id)}')" style="background:#fee2e2;color:#dc2626;border:none;padding:5px 9px;border-radius:5px;cursor:pointer;font-size:12px;"><i class="fas fa-trash"></i></button>
                </div>`;
            });
            html += '</div>';
        });
        return html;
    },

    _renderEmployee(wrap) {
        let jd = `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h4 style="margin:0;"><i class="fas fa-tasks" style="color:#7c3aed;"></i> Jobdesk</h4>
                <button onclick="adminKpi.openJobdeskModal()" style="background:#ede9fe;color:#5b21b6;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;"><i class="fas fa-plus"></i> Tambah</button>
            </div>`;
        if (!this.empJobdesk.length) {
            jd += '<div style="color:#94a3b8;font-size:13px;">Belum ada jobdesk.</div>';
        } else {
            jd += this.empJobdesk.map(j => `<div style="display:flex;gap:8px;align-items:start;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <div style="flex:1;font-size:13px;color:#1e293b;${j.aktif ? '' : 'opacity:0.5;text-decoration:line-through;'}">${this._esc(j.jobdesk)}</div>
                <button onclick="adminKpi.openJobdeskModal('${this._esc(j.id)}')" style="background:#dbeafe;color:#1e40af;border:none;padding:4px 8px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-edit"></i></button>
                <button onclick="adminKpi.deleteJobdesk('${this._esc(j.id)}')" style="background:#fee2e2;color:#dc2626;border:none;padding:4px 8px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-trash"></i></button>
            </div>`).join('');
        }
        jd += '</div>';

        const kpiHeader = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h4 style="margin:0;"><i class="fas fa-bullseye" style="color:#7c3aed;"></i> Indikator KPI</h4>
            <button onclick="adminKpi.openItemModal('employee')" style="background:#7c3aed;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;"><i class="fas fa-plus"></i> Tambah Item</button>
        </div>`;

        wrap.innerHTML = this._renderScoreCard() + jd + kpiHeader + this._renderItems(this.empItems, 'employee');
    },

    // ---------- VERIFIKASI CAPAIAN HARIAN ----------
    async openVerifyModal() {
        if (!this.currentUserId) return;
        const modal = document.getElementById('modal-kpi-verify');
        const body = document.getElementById('kpi-verify-body');
        modal.style.display = 'flex';
        body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:24px;"><i class="fas fa-sync fa-spin"></i> Memuat capaian...</div>';
        const a = this._actor();
        try {
            const res = await api.post({ action: 'getKpiDaily', userId: this.currentUserId, actor_id: a.actor_id, bulan: this.empBulan });
            const daily = (res && res.success) ? (res.data || []) : [];
            this.empDaily = daily;
            if (!daily.length) { body.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:24px;">Belum ada capaian yang diisi karyawan bulan ini.</div>'; return; }
            const itemName = {}; (this.empItems || []).forEach(it => itemName[String(it.id)] = it.indikator);
            daily.sort((x, y) => (y.tanggal).localeCompare(x.tanggal));
            body.innerHTML = daily.map(r => {
                const st = String(r.status).toUpperCase();
                const stColor = st === 'VERIFIED' ? '#16a34a' : (st === 'REJECTED' ? '#dc2626' : '#a16207');
                const stBg = st === 'VERIFIED' ? '#dcfce7' : (st === 'REJECTED' ? '#fee2e2' : '#fef9c3');
                return `<div style="display:flex;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #f1f5f9;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:12px;font-weight:600;color:#1e293b;">${this._esc(itemName[String(r.kpi_item_id)] || ('Item ' + r.kpi_item_id))}</div>
                        <div style="font-size:11px;color:#64748b;">${this._esc(r.tanggal)} · nilai <b>${r.nilai}</b> <span style="background:${stBg};color:${stColor};padding:1px 6px;border-radius:4px;font-size:10px;">${st}</span></div>
                    </div>
                    <button onclick="adminKpi.verifyDaily('${this._esc(r.id)}','VERIFIED')" title="Verifikasi" style="background:#dcfce7;color:#15803d;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-check"></i></button>
                    <button onclick="adminKpi.verifyDaily('${this._esc(r.id)}','REJECTED')" title="Tolak" style="background:#fee2e2;color:#dc2626;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;"><i class="fas fa-times"></i></button>
                </div>`;
            }).join('');
        } catch (e) { body.innerHTML = `<div style="color:#ef4444;padding:20px;">Error: ${e.message}</div>`; }
    },

    async verifyDaily(id, status) {
        const a = this._actor();
        try {
            const res = await api.post({ action: 'verifyKpiDaily', id: id, status: status, actor_id: a.actor_id, actor_name: a.actor_name });
            if (res && res.success) { this.openVerifyModal(); this.loadEmployeeKpi(); }
            else alert('❌ ' + ((res && res.error) || 'gagal'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    },

    // ---------- ITEM MODAL ----------
    openItemModal(mode, id) {
        if (mode === 'employee' && !this.currentUserId) { alert('Pilih karyawan dulu.'); return; }
        const editing = id != null && id !== '';
        const arr = mode === 'template' ? this.tplItems : this.empItems;
        const it = editing ? arr.find(x => String(x.id) === String(id)) : null;

        document.getElementById('kpi-item-mode').value = mode;
        document.getElementById('kpi-item-id').value = editing ? id : '';
        const divWrap = document.getElementById('kpi-item-divisi-wrap');
        divWrap.style.display = mode === 'template' ? 'block' : 'none';
        document.getElementById('kpi-item-divisi').value = mode === 'template' ? (it ? it.divisi : this.currentDivisi) : '';
        document.getElementById('kpi-item-area').value = it ? it.area : '';
        document.getElementById('kpi-item-urutan-area').value = it ? it.urutan_area : 1;
        document.getElementById('kpi-item-indikator').value = it ? it.indikator : '';
        document.getElementById('kpi-item-sop').value = it ? it.sop : '';
        document.getElementById('kpi-item-target').value = it ? it.target : 1;
        document.getElementById('kpi-item-satuan').value = it ? it.satuan : '';
        document.getElementById('kpi-item-periode').value = it ? (it.periode_target || 'HARIAN') : 'HARIAN';
        document.getElementById('kpi-item-bobot').value = it ? it.bobot : 0;
        document.getElementById('kpi-item-urutan').value = it ? it.urutan : (arr.length + 1);
        document.getElementById('kpi-item-aktif').checked = it ? !!it.aktif : true;
        document.getElementById('modal-kpi-item-title').textContent = (editing ? 'Edit' : 'Tambah') + ' Indikator KPI';
        document.getElementById('modal-kpi-item').style.display = 'flex';
    },

    async saveItem() {
        const mode = document.getElementById('kpi-item-mode').value;
        const id = document.getElementById('kpi-item-id').value;
        const indikator = document.getElementById('kpi-item-indikator').value.trim();
        if (!indikator) { alert('Indikator wajib diisi.'); return; }
        const a = this._actor();
        const base = {
            actor_id: a.actor_id, actor_name: a.actor_name,
            area: document.getElementById('kpi-item-area').value.trim(),
            urutan_area: Number(document.getElementById('kpi-item-urutan-area').value) || 0,
            indikator: indikator,
            sop: document.getElementById('kpi-item-sop').value.trim(),
            target: document.getElementById('kpi-item-target').value,
            satuan: document.getElementById('kpi-item-satuan').value.trim(),
            periode_target: document.getElementById('kpi-item-periode').value,
            bobot: Number(document.getElementById('kpi-item-bobot').value) || 0,
            urutan: Number(document.getElementById('kpi-item-urutan').value) || 0,
            aktif: document.getElementById('kpi-item-aktif').checked
        };
        if (id) base.id = id;

        let payload;
        if (mode === 'template') {
            const divisi = document.getElementById('kpi-item-divisi').value.trim();
            if (!divisi) { alert('Divisi wajib diisi.'); return; }
            payload = Object.assign({ action: 'saveKpiTemplate', divisi: divisi }, base);
        } else {
            if (!this.currentUserId) { alert('Pilih karyawan dulu.'); return; }
            payload = Object.assign({ action: 'saveKpiItem', userId: this.currentUserId, source: 'CUSTOM' }, base);
        }

        try {
            const res = await api.post(payload);
            if (res && res.success) {
                this.closeModal('modal-kpi-item');
                if (mode === 'template') {
                    await this._loadDivisiList(payload.divisi);
                    this.loadTemplates();
                } else {
                    this.loadEmployeeKpi();
                }
            } else {
                alert('❌ ' + ((res && res.error) || 'gagal menyimpan'));
            }
        } catch (e) { alert('❌ Error: ' + e.message); }
    },

    async deleteItem(mode, id) {
        if (!confirm('Hapus indikator ini?')) return;
        const a = this._actor();
        const action = mode === 'template' ? 'deleteKpiTemplate' : 'deleteKpiItem';
        try {
            const res = await api.post({ action: action, id: id, actor_id: a.actor_id, actor_name: a.actor_name });
            if (res && res.success) {
                if (mode === 'template') { await this._loadDivisiList(this.currentDivisi); this.loadTemplates(); }
                else this.loadEmployeeKpi();
            } else {
                alert('❌ ' + ((res && res.error) || 'gagal menghapus'));
            }
        } catch (e) { alert('❌ Error: ' + e.message); }
    },

    // ---------- JOBDESK MODAL ----------
    openJobdeskModal(id) {
        if (!this.currentUserId) { alert('Pilih karyawan dulu.'); return; }
        const j = (id != null && id !== '') ? this.empJobdesk.find(x => String(x.id) === String(id)) : null;
        document.getElementById('kpi-jd-id').value = j ? j.id : '';
        document.getElementById('kpi-jd-text').value = j ? j.jobdesk : '';
        document.getElementById('kpi-jd-urutan').value = j ? j.urutan : (this.empJobdesk.length + 1);
        document.getElementById('kpi-jd-aktif').checked = j ? !!j.aktif : true;
        document.getElementById('modal-kpi-jobdesk-title').textContent = (j ? 'Edit' : 'Tambah') + ' Jobdesk';
        document.getElementById('modal-kpi-jobdesk').style.display = 'flex';
    },

    async saveJobdesk() {
        const text = document.getElementById('kpi-jd-text').value.trim();
        if (!text) { alert('Jobdesk wajib diisi.'); return; }
        const id = document.getElementById('kpi-jd-id').value;
        const a = this._actor();
        const payload = {
            action: 'saveKpiJobdesk', userId: this.currentUserId, jobdesk: text,
            urutan: Number(document.getElementById('kpi-jd-urutan').value) || 0,
            aktif: document.getElementById('kpi-jd-aktif').checked,
            actor_id: a.actor_id, actor_name: a.actor_name
        };
        if (id) payload.id = id;
        try {
            const res = await api.post(payload);
            if (res && res.success) { this.closeModal('modal-kpi-jobdesk'); this.loadEmployeeKpi(); }
            else alert('❌ ' + ((res && res.error) || 'gagal menyimpan'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    },

    async deleteJobdesk(id) {
        if (!confirm('Hapus jobdesk ini?')) return;
        const a = this._actor();
        try {
            const res = await api.post({ action: 'deleteKpiJobdesk', id: id, actor_id: a.actor_id, actor_name: a.actor_name });
            if (res && res.success) this.loadEmployeeKpi();
            else alert('❌ ' + ((res && res.error) || 'gagal menghapus'));
        } catch (e) { alert('❌ Error: ' + e.message); }
    },

    // ---------- ASSIGN ----------
    openAssignModal() {
        if (!this.currentUserId) { alert('Pilih karyawan dulu.'); return; }
        const sel = document.getElementById('kpi-assign-divisi');
        sel.innerHTML = this.divisiList.length
            ? this.divisiList.map(d => `<option value="${this._esc(d)}">${this._esc(d)}</option>`).join('')
            : '<option value="">(belum ada template divisi)</option>';
        const emp = this.employees.find(e => String(e.id) === String(this.currentUserId));
        if (emp && emp.department && this.divisiList.indexOf(emp.department) >= 0) sel.value = emp.department;
        document.getElementById('modal-kpi-assign').style.display = 'flex';
    },

    async doAssign() {
        const divisi = document.getElementById('kpi-assign-divisi').value;
        if (!divisi) { alert('Pilih divisi.'); return; }
        const a = this._actor();
        try {
            const res = await api.post({ action: 'assignKpiTemplate', userId: this.currentUserId, divisi: divisi, actor_id: a.actor_id, actor_name: a.actor_name });
            if (res && res.success) {
                this.closeModal('modal-kpi-assign');
                alert('✅ ' + res.added + ' indikator ditambahkan dari template ' + divisi + '.');
                this.loadEmployeeKpi();
            } else {
                alert('❌ ' + ((res && res.error) || 'gagal assign'));
            }
        } catch (e) { alert('❌ Error: ' + e.message); }
    }
};

window.adminKpi = adminKpi;
