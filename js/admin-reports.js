/**
 * Portal Karyawan - Admin Reports PT. BISATANI
 * Versi V2.9: ULTIMATE RECOVERY (Anti-Undefined RowID)
 */
const adminReports = {
    allAttendance: [],
    employees: [],

    async init() {
        const tbody = document.getElementById('attendance-reports-body');
        if (!tbody) return;
        
        this.setupFilters();
        await this.loadData();
        this.bindEvents();
    },

    setupFilters() {
        const today = new Date().toISOString().split('T')[0];
        const start = document.getElementById('report-start-date');
        const end = document.getElementById('report-end-date');
        if (start) start.value = today;
        if (end) end.value = today;
    },

    async loadData() {
        const tbody = document.getElementById('attendance-reports-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px;"><i class="fas fa-sync fa-spin"></i> Sinkronisasi Database...</td></tr>';

        try {
            const [resAtt, resEmp] = await Promise.all([
                api.post({ action: 'getAllAttendanceData' }),
                api.post({ action: 'getEmployees' })
            ]);

            // Ambil data dan pastikan rowId tersimpan
            if (resAtt && resAtt.success) {
                this.allAttendance = resAtt.data.map((item, index) => {
                    // Jika rowId dari backend tidak ada, buat cadangan berdasarkan index (Baris 1=Header, jadi +2)
                    if (!item.rowId) item.rowId = index + 2; 
                    return item;
                });
            }
            
            if (resEmp && resEmp.success) {
                this.employees = resEmp.data || [];
                this.populateEmployeeFilter();
            }
            this.renderTable();
        } catch (e) {
            console.error("Load Data Error:", e);
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red; padding:20px;">Gagal terhubung ke database.</td></tr>';
        }
    },

    populateEmployeeFilter() {
        const select = document.getElementById('report-employee-filter');
        if (!select) return;
        let html = '<option value="">Semua Karyawan</option>';
        this.employees.forEach(emp => {
            html += `<option value="${emp.id}">${emp.name}</option>`;
        });
        select.innerHTML = html;
    },

    bindEvents() {
        const filters = ['report-start-date', 'report-end-date', 'report-type-filter', 'report-employee-filter', 'report-search'];
        filters.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.renderTable());
                if (el.tagName === 'INPUT') el.addEventListener('keyup', () => this.renderTable());
            }
        });
    },

async updateApproval(rowId, status) {
        if (!rowId) return alert("RowId Kosong");
        if (!confirm(`Ubah ke ${status}?`)) return;

        try {
            console.log("🚀 Menggunakan Jalur saveEmployee...");
            
            const res = await api.post({ 
                action: 'saveEmployee',      // Kembali ke asal
                subAction: 'updateApproval', // Numpang di sini
                rowId: rowId, 
                status: status 
            });

            if (res && res.success) {
                alert("✅ Berhasil Update Sheet!");
                const index = this.allAttendance.findIndex(a => String(a.rowId) === String(rowId));
                if (index !== -1) this.allAttendance[index].approvalStatus = status;
                this.renderTable();
            } else {
                alert("❌ Gagal: " + (res.error || "Cek Backend"));
            }
        } catch (e) { alert("Error Koneksi!"); }
    },

    renderTable() {
        const tbody = document.getElementById('attendance-reports-body');
        if (!tbody) return;

        const start = document.getElementById('report-start-date')?.value;
        const end = document.getElementById('report-end-date')?.value;
        const type = document.getElementById('report-type-filter')?.value;
        const empId = document.getElementById('report-employee-filter')?.value;
        const search = document.getElementById('report-search')?.value.toLowerCase();

        const filtered = this.allAttendance.filter(log => {
            if (!log.timestamp) return false;
            const logDate = String(log.timestamp).substring(0, 10);
            const matchDate = (!start || !end) ? true : (logDate >= start && logDate <= end);
            const matchType = !type || log.type === type;
            const matchEmp = !empId || String(log.userId) === String(empId);
            const matchSearch = !search || 
                (log.userName && String(log.userName).toLowerCase().includes(search)) || 
                (String(log.userId).includes(search));
            return matchDate && matchType && matchEmp && matchSearch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:20px;">Data tidak ditemukan.</td></tr>`;
            return;
        }

        // Sorting: Baris paling bawah di Sheet (rowId terbesar) tampil di paling atas Web
        filtered.sort((a, b) => Number(b.rowId) - Number(a.rowId));

        tbody.innerHTML = filtered.map((log, index) => {
            // Pastikan rowId ditarik dari objek log yang benar
            const finalRowId = log.rowId;
            
            let colorStatus = "#94a3b8"; 
            if (log.approvalStatus === 'APPROVED') colorStatus = "#10b981";
            if (log.approvalStatus === 'REJECTED') colorStatus = "#ef4444";

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="text-align:center; padding:10px;">${index + 1}</td>
                    <td style="padding:10px;"><small>${log.timestamp}</small></td>
                    <td style="padding:10px;"><strong>${log.userName || log.userId}</strong></td>
                    <td style="padding:10px;"><span class="badge-${String(log.type).toLowerCase().replace(/_/g, '-')}">${log.type}</span></td>
                    <td style="padding:10px;"><small>${log.location || '-'}</small></td>
                    <td style="text-align:center; padding:10px;">
                        ${log.image ? `<img src="${log.image}" style="width:30px; height:30px; border-radius:4px; object-fit:cover; cursor:pointer;" onclick="window.open(this.src)">` : '-'}
                    </td>
                    <td style="padding:10px; color:#ef4444;"><small>${log.statusTelat || '-'}</small></td>
                    <td style="text-align:center; padding:10px;">${log.mulai || '-'}</td>
                    <td style="text-align:center; padding:10px;">${log.selesai || '-'}</td>
                    <td style="text-align:center; font-weight:bold; color:#2563eb; padding:10px;">${log.totalHours || '0'} j</td>
                    <td style="text-align:center; padding:10px;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                            <span style="font-size:10px; font-weight:bold; color:${colorStatus}">${log.approvalStatus || 'PENDING'}</span>
                            <div style="display:flex; gap:6px;">
                                <button onclick="adminReports.updateApproval(${finalRowId}, 'APPROVED')" 
                                    style="background:#10b981; color:white; border:none; border-radius:4px; padding:6px 9px; cursor:pointer; font-size:12px;">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button onclick="adminReports.updateApproval(${finalRowId}, 'REJECTED')" 
                                    style="background:#ef4444; color:white; border:none; border-radius:4px; padding:6px 9px; cursor:pointer; font-size:12px;">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
};

window.adminReports = adminReports;
