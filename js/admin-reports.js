/**
 * Portal Karyawan - Admin Reports PT. BISATANI
 * Versi V2: Integrated Approval System (Kehadiran & Lembur)
 */
const adminReports = {
    allAttendance: [],
    employees: [],

    async init() {
        if (!document.getElementById('attendance-reports-body')) return;
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
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px;"><i class="fas fa-sync fa-spin"></i> Menghubungkan ke database...</td></tr>';

        try {
            const [resAtt, resEmp] = await Promise.all([
                api.post({ action: 'getAllAttendanceData' }),
                api.post({ action: 'getEmployees' })
            ]);

            if (resAtt && resAtt.success) this.allAttendance = resAtt.data || [];
            if (resEmp && resEmp.success) {
                this.employees = resEmp.data || [];
                this.populateEmployeeFilter();
            }
            this.renderTable();
        } catch (e) {
            console.error("Load Data Error:", e);
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red; padding:20px;">Gagal sinkronisasi data.</td></tr>';
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

    // --- FUNGSI PROSES APPROVAL ---
    async updateApproval(rowId, status) {
        const emoji = status === 'APPROVED' ? '✅' : '❌';
        if (!confirm(`${emoji} Ubah status data ini menjadi ${status}?`)) return;

        try {
            const res = await api.post({ 
                action: 'approveData', 
                rowId: rowId, 
                status: status 
            });

            if (res && res.success) {
                alert(`Berhasil di-${status}`);
                await this.loadData(); // Refresh data agar tabel update
            } else {
                alert("Gagal update status.");
            }
        } catch (e) {
            alert("Terjadi kesalahan koneksi.");
        }
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
            const logDate = log.timestamp; // Sudah yyyy-mm-dd dari code.gs
            const matchDate = (!start || !end) ? true : (logDate >= start && logDate <= end);
            const matchType = !type || log.type === type;
            const matchEmp = !empId || String(log.userId) === String(empId);
            const matchSearch = !search || 
                (log.userName && log.userName.toLowerCase().includes(search)) || 
                (String(log.userId).includes(search));
            
            return matchDate && matchType && matchEmp && matchSearch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px;">Tidak ada data absensi.</td></tr>';
            return;
        }

        filtered.sort((a, b) => b.rowId - a.rowId);

        tbody.innerHTML = filtered.map((log, index) => {
            // Pengusir Jam Purba
            const formatJamBersih = (val) => {
                if (!val || val === "-" || val === "0") return "-";
                let sVal = String(val);
                if (sVal.includes('T')) return sVal.split('T')[1].substring(0, 5);
                return sVal;
            };

            const jamMulai = formatJamBersih(log.mulai);
            const jamSelesai = formatJamBersih(log.selesai);
            const totalJamDisplay = (log.totalHours && log.totalHours !== "-" && log.totalHours !== "0") ? log.totalHours + " j" : "-";
            const telatInfo = (log.statusTelat && log.statusTelat !== "0" && log.statusTelat !== "-") ? log.statusTelat : "-";

            // Logika Warna Status Approval
            let colorStatus = "#94a3b8"; // Pending (Abu)
            if (log.approvalStatus === 'APPROVED') colorStatus = "#10b981"; // Hijau
            if (log.approvalStatus === 'REJECTED') colorStatus = "#ef4444"; // Merah

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
                    <td style="padding:10px; color:#ef4444;"><small>${telatInfo}</small></td>
                    <td style="text-align:center; padding:10px;">${jamMulai}</td>
                    <td style="text-align:center; padding:10px;">${jamSelesai}</td>
                    <td style="text-align:center; font-weight:bold; color:#2563eb; padding:10px;">${totalJamDisplay}</td>
                    
                    <td style="text-align:center; padding:10px; white-space:nowrap;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                            <span style="font-size:10px; font-weight:bold; color:${colorStatus}">${log.approvalStatus}</span>
                            <div style="display:flex; gap:3px;">
                                <button onclick="adminReports.updateApproval('${log.rowId}', 'APPROVED')" style="background:#10b981; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer;" title="Setujui">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button onclick="adminReports.updateApproval('${log.rowId}', 'REJECTED')" style="background:#ef4444; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer;" title="Tolak">
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
