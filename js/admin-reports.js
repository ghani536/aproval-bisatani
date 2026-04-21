/**
 * Portal Karyawan - Admin Reports PT. BISATANI
 * Versi Full: Fix Tampilan Mulai, Selesai (Anti-1899), dan Total Lembur
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
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px;"><i class="fas fa-sync fa-spin"></i> Menghubungkan ke database...</td></tr>';

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
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:red; padding:20px;">Gagal sinkronisasi data.</td></tr>';
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
            const logDate = new Date(log.timestamp).toISOString().split('T')[0];
            const matchDate = (!start || !end) ? true : (logDate >= start && logDate <= end);
            const matchType = !type || log.type === type;
            const matchEmp = !empId || String(log.userId) === String(empId);
            const matchSearch = !search || 
                (log.userName && log.userName.toLowerCase().includes(search)) || 
                (String(log.userId).includes(search));
            
            return matchDate && matchType && matchEmp && matchSearch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px;">Tidak ada data absensi untuk filter ini.</td></tr>';
            return;
        }

        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        tbody.innerHTML = filtered.map((log, index) => {
            const d = new Date(log.timestamp);
            const waktuRec = d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
            
            // --- FUNGSI SAKTI PENGUSIR JAM PURBA 1899 ---
            const formatJamBersih = (val) => {
                if (!val || val === "-" || val === "0") return "-";
                let sVal = String(val);
                // Jika mengandung format ISO 'T' (misal 1899-12-29T16:54:00)
                if (sVal.includes('T')) {
                    try {
                        return sVal.split('T')[1].substring(0, 5); // Ambil HH:mm
                    } catch(e) { return sVal; }
                }
                return sVal;
            };

            const jamMulai = formatJamBersih(log.mulai);
            const jamSelesai = formatJamBersih(log.selesai);
            
            // Tampilkan total jam dengan unit "j" jika ada angkanya
            const totalJamDisplay = (log.totalHours && log.totalHours !== "-" && log.totalHours !== "0") ? log.totalHours + " j" : "-";
            const telatInfo = (log.statusTelat && log.statusTelat !== "0" && log.statusTelat !== "-") ? log.statusTelat : "-";

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="text-align:center; padding:10px;">${index + 1}</td>
                    <td style="padding:10px;"><small>${waktuRec}</small></td>
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
                </tr>
            `;
        }).join('');
    }
};

window.adminReports = adminReports;
