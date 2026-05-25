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

    async loadEmployees() {
        const tbody = document.getElementById('employees-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;"><i class="fas fa-sync fa-spin"></i> Memuat data terbaru...</td></tr>';
        try {
            const res = await api.post({ action: 'getEmployees' });
            if (res.success) {
                this.employees = res.data || [];
                this.renderTable();
            }
        } catch (e) { 
            console.error("Error Load:", e); 
            if(tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Gagal memuat data. Periksa koneksi.</td></tr>';
        }
    },

    renderTable() {
        const tbody = document.getElementById('employees-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">Belum ada data karyawan terpajang.</td></tr>';
            return;
        }

        const html = this.employees.map((emp, index) => {
            const isPerJam = emp.jenis_gaji === 'per_jam';
            const gajiCell = isPerJam
                ? `<span style="color:#6366f1; font-weight:600;">Rp ${Number(emp.tarif_per_jam || 0).toLocaleString('id-ID')}</span><br><small style="color:#94a3b8;">/jam</small>`
                : `<span>Rp ${Number(emp.gaji_pokok || 0).toLocaleString('id-ID')}</span><br><small style="color:#94a3b8;">/bulan</small>`;

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="text-align:center; padding:12px;">${index + 1}</td>
                    <td style="padding:12px;"><strong>${emp.name}</strong><br><small style="color:#64748b;">ID: ${emp.id}</small></td>
                    <td style="padding:12px;">${emp.email || '-'}</td>
                    <td style="padding:12px;">${emp.department || '-'}</td>
                    <td style="padding:12px;">${emp.position || '-'}</td>
                    <td style="padding:12px; font-weight:500;">${gajiCell}</td>
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
                tarif_per_jam: tarifJamEl ? (tarifJamEl.value || "0") : "0"
            };

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

        document.getElementById('modal-employee').style.display = 'flex';
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
