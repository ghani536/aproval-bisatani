/**
 * Portal Karyawan - Admin Employees PT. BISATANI
 * Versi Final Sync: Mendukung Database 13 Kolom & Auto-Denda
 */
const adminEmployees = {
    employees: [],

    init() {
        console.log("AdminEmployees: Sistem Inisialisasi...");
        this.loadEmployees();
        this.bindEvents();
        this.setupDendaOtomatis();
        this.setupJenisGajiToggle();
        this.setupPasswordToggle();
    },

    setupPasswordToggle() {
        const toggle = document.getElementById('emp-password-toggle');
        const input = document.getElementById('emp-password');
        if (!toggle || !input || toggle.dataset.bound === '1') return;
        // Default sembunyi (type=password)
        input.type = 'password';
        toggle.onclick = (e) => {
            e.preventDefault();
            const hidden = input.type === 'password';
            input.type = hidden ? 'text' : 'password';
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.classList.remove(hidden ? 'fa-eye-slash' : 'fa-eye');
                icon.classList.add(hidden ? 'fa-eye' : 'fa-eye-slash');
            }
        };
        toggle.dataset.bound = '1';
    },

    setupJenisGajiToggle() {
        const sel = document.getElementById('emp-jenis-gaji');
        if (!sel) return;
        const apply = () => {
            const isPerJam = sel.value === 'per_jam';
            const grpGaji = document.getElementById('grp-gaji-pokok');
            const grpTarif = document.getElementById('grp-tarif-jam');
            if (grpGaji) grpGaji.style.display = isPerJam ? 'none' : 'block';
            if (grpTarif) grpTarif.style.display = isPerJam ? 'block' : 'none';
        };
        sel.addEventListener('change', apply);
        apply();
    },

    setupDendaOtomatis() {
        const inputGaji = document.getElementById('emp-gaji');
        const inputDenda = document.getElementById('emp-denda');
        if (inputGaji && inputDenda) {
            inputGaji.addEventListener('input', () => {
                const gaji = parseFloat(inputGaji.value) || 0;
                // Rumus PT. BISATANI: Gaji / 25 / 8 / 60
                const hasil = Math.round(gaji / 25 / 8 / 60);
                inputDenda.value = hasil;
            });
        }
    },

    passwordVisibility: {}, // id -> bool

    async loadEmployees() {
        const tbody = document.getElementById('employees-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;"><i class="fas fa-sync fa-spin"></i> Memuat data terbaru...</td></tr>';
        try {
            const res = await api.post({ action: 'getEmployees' });
            if (res.success) {
                this.employees = res.data || [];
                this.renderTable();
            }
        } catch (e) {
            console.error("Error Load:", e);
            if(tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red;">Gagal memuat data. Periksa koneksi.</td></tr>';
        }
    },

    togglePasswordVisible(id) {
        this.passwordVisibility[id] = !this.passwordVisibility[id];
        this.renderTable();
    },

    renderTable() {
        const tbody = document.getElementById('employees-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">Belum ada data karyawan terpajang.</td></tr>';
            return;
        }

        const html = this.employees.map((emp, index) => {
            const isPerJam = emp.jenis_gaji === 'per_jam';
            const gajiCell = isPerJam
                ? `<span style="color:#6366f1; font-weight:600;">Rp ${Number(emp.tarif_per_jam || 0).toLocaleString('id-ID')}</span><br><small style="color:#94a3b8;">/jam</small>`
                : `<span>Rp ${Number(emp.gaji_pokok || 0).toLocaleString('id-ID')}</span><br><small style="color:#94a3b8;">/bulan</small>`;

            const pwdVisible = !!this.passwordVisibility[emp.id];
            const rawPwd = emp.password || '';
            const pwdDisplay = pwdVisible
                ? `<code style="background:#f1f5f9; padding:3px 6px; border-radius:4px; font-size:12px;">${rawPwd || '(kosong)'}</code>`
                : `<span style="letter-spacing:2px; color:#94a3b8;">${'•'.repeat(Math.min(rawPwd.length, 8) || 4)}</span>`;
            const pwdCell = `
                <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
                    ${pwdDisplay}
                    <button onclick="adminEmployees.togglePasswordVisible('${String(emp.id).replace(/'/g, "\\'")}')" style="background:transparent; border:none; color:#64748b; cursor:pointer; padding:2px;" title="${pwdVisible ? 'Sembunyikan' : 'Tampilkan'}">
                        <i class="fas ${pwdVisible ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                </div>
            `;

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="text-align:center; padding:12px;">${index + 1}</td>
                    <td style="padding:12px;">
                        <a href="#" onclick="event.preventDefault(); adminEmployees.showDetail('${String(emp.id).replace(/'/g, "\\'")}')" style="color:#10b981; text-decoration:none; font-weight:600;" title="Klik untuk lihat detail">
                            ${emp.name} <i class="fas fa-info-circle" style="font-size:11px; opacity:0.6;"></i>
                        </a>
                        <br><small style="color:#64748b;">ID: ${emp.id}</small>
                    </td>
                    <td style="padding:12px;">${emp.email || '-'}</td>
                    <td style="padding:12px;">${emp.department || '-'}</td>
                    <td style="padding:12px;">${emp.position || '-'}</td>
                    <td style="padding:12px; font-weight:500;">${gajiCell}</td>
                    <td style="padding:12px; text-align:center;">${pwdCell}</td>
                    <td style="padding:12px; text-align:center;">
                        <div style="display:flex; gap:8px; justify-content:center;">
                            <button onclick="adminEmployees.prepareEdit('${emp.id}')" style="background:#f59e0b; color:white; border:none; width:32px; height:32px; border-radius:6px; cursor:pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                            <button onclick="adminEmployees.deleteEmployee('${emp.id}')" style="background:#ef4444; color:white; border:none; width:32px; height:32px; border-radius:6px; cursor:pointer;" title="Hapus"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        tbody.innerHTML = html;
    },

    bindEvents() {
        const btnAdd = document.getElementById('btn-add-employee');
        if (btnAdd) {
            btnAdd.onclick = () => {
                document.getElementById('modal-title').textContent = "Tambah Karyawan";
                document.getElementById('form-employee').reset();
                document.getElementById('emp-id').value = "";
                document.getElementById('emp-denda').value = ""; // Pastikan denda kosong saat tambah baru
                const jl = document.getElementById('emp-jam-lembur');
                if (jl) jl.value = "";
                const jenisGajiEl = document.getElementById('emp-jenis-gaji');
                if (jenisGajiEl) {
                    jenisGajiEl.value = 'bulanan';
                    jenisGajiEl.dispatchEvent(new Event('change'));
                }
                const pwd = document.getElementById('emp-password');
                if (pwd) {
                    pwd.value = "";
                    pwd.placeholder = "Min. 4 karakter (wajib diisi)";
                }
                const bankEl = document.getElementById('emp-bank');
                const rekEl = document.getElementById('emp-rekening');
                if (bankEl) bankEl.value = "";
                if (rekEl) rekEl.value = "";
                const bensinEl = document.getElementById('emp-tunjangan-bensin');
                const kostEl = document.getElementById('emp-tunjangan-kost');
                if (bensinEl) bensinEl.value = 0;
                if (kostEl) kostEl.value = 0;
                document.getElementById('modal-employee').style.display = 'flex';
            };
        }
        const form = document.getElementById('form-employee');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                await this.handleSubmit();
            };
        }
    },

    async handleSubmit() {
        const btn = document.querySelector('#form-employee button[type="submit"]');
        const originalText = btn.innerHTML;
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
            
            const jenisGajiEl = document.getElementById('emp-jenis-gaji');
            const tarifJamEl = document.getElementById('emp-tarif-jam');
            const pwdEl = document.getElementById('emp-password');
            const payload = {
                action: 'saveEmployee',
                id: document.getElementById('emp-id').value,
                name: document.getElementById('emp-name').value,
                email: document.getElementById('emp-email').value,
                department: document.getElementById('emp-dept').value,
                position: document.getElementById('emp-position').value,
                role: document.getElementById('emp-role').value,
                gaji_pokok: document.getElementById('emp-gaji').value,
                bpjs: document.getElementById('emp-bpjs').value,
                dendatelat: document.getElementById('emp-denda').value,
                jam_mulai_lembur: (document.getElementById('emp-jam-lembur') || {}).value || "",
                jenis_gaji: jenisGajiEl ? jenisGajiEl.value : "bulanan",
                tarif_per_jam: tarifJamEl ? (tarifJamEl.value || "0") : "0",
                nama_bank: (document.getElementById('emp-bank') || {}).value || "",
                no_rekening: (document.getElementById('emp-rekening') || {}).value || "",
                tunjangan_bensin: (document.getElementById('emp-tunjangan-bensin') || {}).value || "0",
                tunjangan_kost: (document.getElementById('emp-tunjangan-kost') || {}).value || "0"
            };
            // Password: hanya kirim kalau diisi (kosong = backend pakai password lama)
            if (pwdEl && pwdEl.value.trim() !== "") {
                payload.password = pwdEl.value.trim();
            }

            const res = await api.post(payload);
            if (res.success) {
                alert("Data Karyawan Berhasil Disimpan!");
                document.getElementById('modal-employee').style.display = 'none';
                this.loadEmployees();
            } else {
                alert("Gagal menyimpan: " + res.error);
            }
        } catch (e) { 
            console.error("Submit Error:", e);
            alert("Proses selesai. Silakan refresh tabel jika data belum update."); 
            this.loadEmployees(); 
        } finally { 
            btn.disabled = false; 
            btn.innerHTML = originalText; 
        }
    },

    prepareEdit(id) {
        const emp = this.employees.find(e => String(e.id) === String(id));
        if (!emp) return;

        document.getElementById('modal-title').textContent = "Edit Karyawan";
        document.getElementById('emp-id').value = emp.id;
        document.getElementById('emp-name').value = emp.name;
        document.getElementById('emp-email').value = emp.email;
        document.getElementById('emp-dept').value = emp.department || '';
        document.getElementById('emp-position').value = emp.position;
        document.getElementById('emp-gaji').value = emp.gaji_pokok;
        document.getElementById('emp-bpjs').value = emp.bpjs;
        document.getElementById('emp-role').value = emp.role || 'employee';
        
        // Load data denda dari database ke input modal
        document.getElementById('emp-denda').value = emp.dendatelat || 0;

        const jl = document.getElementById('emp-jam-lembur');
        if (jl) jl.value = emp.jam_mulai_lembur || "";

        const jenisGajiEl = document.getElementById('emp-jenis-gaji');
        const tarifJamEl = document.getElementById('emp-tarif-jam');
        if (jenisGajiEl) {
            jenisGajiEl.value = (emp.jenis_gaji === 'per_jam') ? 'per_jam' : 'bulanan';
            jenisGajiEl.dispatchEvent(new Event('change'));
        }
        if (tarifJamEl) tarifJamEl.value = emp.tarif_per_jam || 0;

        // Password: clear field, placeholder show current
        const pwdEl = document.getElementById('emp-password');
        if (pwdEl) {
            pwdEl.value = "";
            pwdEl.placeholder = emp.password ? `Saat ini: ${emp.password} (kosongkan = tetap)` : "Belum ada password";
        }

        // Bank + No Rekening
        const bankEl = document.getElementById('emp-bank');
        const rekEl = document.getElementById('emp-rekening');
        if (bankEl) bankEl.value = emp.nama_bank || "";
        if (rekEl) rekEl.value = emp.no_rekening || "";

        // Tunjangan
        const bensinEl = document.getElementById('emp-tunjangan-bensin');
        const kostEl = document.getElementById('emp-tunjangan-kost');
        if (bensinEl) bensinEl.value = emp.tunjangan_bensin || 0;
        if (kostEl) kostEl.value = emp.tunjangan_kost || 0;

        document.getElementById('modal-employee').style.display = 'flex';
    },

    async showDetail(id) {
        const modal = document.getElementById('modal-emp-detail');
        const body = document.getElementById('emp-detail-body');
        if (!modal || !body) return;
        body.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px;"><i class="fas fa-sync fa-spin"></i> Memuat detail...</div>';
        modal.style.display = 'flex';
        try {
            const res = await api.post({ action: 'getEmployeeDetail', userId: id, limitMonths: 6 });
            if (!res || !res.success) {
                body.innerHTML = `<div style="text-align:center; color:#ef4444; padding:30px;">Gagal: ${(res && res.error) || 'cek koneksi'}</div>`;
                return;
            }
            body.innerHTML = this._renderDetail(res.employee, res.riwayat_gaji || []);
        } catch (err) {
            body.innerHTML = `<div style="text-align:center; color:#ef4444; padding:30px;">Error: ${err.message}</div>`;
        }
    },

    _fmtRp(n) {
        return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
    },

    _renderDetail(emp, riwayat) {
        const namaBulan = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const isPerJam = emp.jenis_gaji === 'per_jam';

        // Mini bar chart: cari max gaji untuk normalisasi
        let chart = '';
        if (riwayat.length > 0) {
            // Reverse untuk urutan oldest → newest di chart
            const sorted = [...riwayat].reverse();
            const max = Math.max(...sorted.map(r => r.total_gaji), 1);
            const bars = sorted.map(r => {
                const pct = Math.round((r.total_gaji / max) * 100);
                const label = `${namaBulan[r.bulan] || r.bulan}/${String(r.tahun).slice(2)}`;
                return `
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; min-width:0;">
                        <div style="font-size:10px; color:#64748b; white-space:nowrap;">${this._fmtRp(r.total_gaji).replace('Rp ', '')}</div>
                        <div style="width:100%; height:80px; background:#f1f5f9; border-radius:4px 4px 0 0; display:flex; align-items:flex-end; overflow:hidden;">
                            <div style="width:100%; height:${pct}%; background:linear-gradient(180deg,#10b981,#059669); border-radius:4px 4px 0 0; transition:height 0.3s;"></div>
                        </div>
                        <div style="font-size:10px; color:#475569; font-weight:600;">${label}</div>
                    </div>`;
            }).join('');
            chart = `
                <div style="background:#f8fafc; padding:12px; border-radius:8px; margin-bottom:12px;">
                    <div style="font-size:11px; color:#64748b; margin-bottom:8px; font-weight:600;"><i class="fas fa-chart-bar"></i> Perbandingan Total Gaji ${riwayat.length} Bulan Terakhir</div>
                    <div style="display:flex; gap:6px; align-items:flex-end;">${bars}</div>
                </div>`;
        }

        // Tabel riwayat
        let tableHtml = '';
        if (riwayat.length === 0) {
            tableHtml = '<div style="text-align:center; color:#94a3b8; padding:20px; background:#f8fafc; border-radius:8px;">Belum ada riwayat slip gaji yang dikirim</div>';
        } else {
            tableHtml = `
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#f1f5f9; text-align:left;">
                            <th style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">Periode</th>
                            <th style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:right;">Total Gaji</th>
                            <th style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:right;">Dikirim</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${riwayat.map(r => `
                            <tr style="border-bottom:1px solid #f1f5f9;">
                                <td style="padding:8px 10px;">${namaBulan[r.bulan] || r.bulan} ${r.tahun}</td>
                                <td style="padding:8px 10px; text-align:right; font-weight:600; color:#10b981;">${this._fmtRp(r.total_gaji)}</td>
                                <td style="padding:8px 10px; text-align:right; color:#94a3b8; font-size:11px;">${r.timestamp_kirim || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
        }

        return `
            <div style="background:linear-gradient(135deg,#10b981,#059669); color:white; padding:18px; border-radius:10px; margin-bottom:14px;">
                <div style="font-size:20px; font-weight:700; margin-bottom:4px;">${this._esc(emp.name)}</div>
                <div style="font-size:13px; opacity:0.9;">${this._esc(emp.position || '-')} · ${this._esc(emp.department || '-')}</div>
                <div style="font-size:12px; opacity:0.85; margin-top:4px;">ID: ${this._esc(emp.id)} · Email: ${this._esc(emp.email || '-')}</div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
                <div style="background:#f8fafc; padding:12px; border-radius:8px;">
                    <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:4px;">JENIS GAJI</div>
                    <div style="font-size:14px; font-weight:600; color:#1e293b;">${isPerJam ? 'Per Jam' : 'Bulanan'}</div>
                    <div style="font-size:13px; color:#10b981; font-weight:700; margin-top:2px;">${this._fmtRp(isPerJam ? emp.tarif_per_jam : emp.gaji_pokok)}${isPerJam ? '/jam' : '/bulan'}</div>
                </div>
                <div style="background:#f8fafc; padding:12px; border-radius:8px;">
                    <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:4px;">BPJS / DENDA TELAT</div>
                    <div style="font-size:13px; color:#1e293b;">BPJS: ${this._fmtRp(emp.bpjs)}</div>
                    <div style="font-size:13px; color:#1e293b;">Denda: ${this._fmtRp(emp.dendatelat)}/menit</div>
                </div>
                <div style="background:#fff7ed; padding:12px; border-radius:8px; border:1px solid #fed7aa;">
                    <div style="font-size:11px; color:#ea580c; font-weight:600; margin-bottom:4px;"><i class="fas fa-gas-pump"></i> TUNJANGAN BENSIN</div>
                    <div style="font-size:14px; font-weight:700; color:#ea580c;">${this._fmtRp(emp.tunjangan_bensin)}</div>
                    <div style="font-size:10px; color:#9a3412;">Dipotong proporsional</div>
                </div>
                <div style="background:#fff7ed; padding:12px; border-radius:8px; border:1px solid #fed7aa;">
                    <div style="font-size:11px; color:#ea580c; font-weight:600; margin-bottom:4px;"><i class="fas fa-home"></i> TUNJANGAN KOST</div>
                    <div style="font-size:14px; font-weight:700; color:#ea580c;">${this._fmtRp(emp.tunjangan_kost)}</div>
                    <div style="font-size:10px; color:#9a3412;">Flat per bulan</div>
                </div>
                <div style="background:#f8fafc; padding:12px; border-radius:8px;">
                    <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:4px;">BANK</div>
                    <div style="font-size:13px; color:#1e293b;">${this._esc(emp.nama_bank || '-')}</div>
                    <div style="font-size:12px; color:#64748b; font-family:monospace;">${this._esc(emp.no_rekening || '-')}</div>
                </div>
                <div style="background:#f8fafc; padding:12px; border-radius:8px;">
                    <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:4px;">ROLE / JAM LEMBUR</div>
                    <div style="font-size:13px; color:#1e293b; text-transform:capitalize;">${this._esc(emp.role)}</div>
                    <div style="font-size:12px; color:#64748b;">Lembur dari: ${this._esc(emp.jam_mulai_lembur || 'default global')}</div>
                </div>
            </div>

            <h4 style="margin:16px 0 8px; font-size:14px; color:#1e293b;"><i class="fas fa-history" style="color:#10b981;"></i> Riwayat Slip Gaji</h4>
            ${chart}
            ${tableHtml}
        `;
    },

    _esc(s) {
        return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    async deleteEmployee(id) {
        if (!confirm(`Hapus karyawan ID: ${id}? Data di spreadsheet juga akan terhapus.`)) return;
        try {
            const res = await api.post({ action: 'deleteEmployee', id: id });
            if (res.success) { 
                alert("Karyawan Telah Dihapus!"); 
                this.loadEmployees(); 
            }
        } catch (e) { 
            console.error("Delete Error:", e);
            this.loadEmployees(); 
        }
    }
};

window.adminEmployees = adminEmployees;
