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
                        ${log.image ? `<img src="${log.image}" style="width:34px; height:34px; border-radius:6px; object-fit:cover; cursor:zoom-in; border:1px solid #e2e8f0;" onclick="adminReports.showLightbox(this.src, '${(log.userName || log.userId || '').replace(/'/g,"\\'")}', '${log.timestamp || ''}')" title="Klik untuk perbesar">` : '-'}
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
,

    // Lightbox foto selfie absen — modal full-screen, klik backdrop / Esc untuk tutup
    showLightbox(src, caption, timestamp) {
        if (!src) return;
        let modal = document.getElementById('admin-photo-lightbox');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'admin-photo-lightbox';
            modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.88); display:none; align-items:center; justify-content:center; z-index:99999; padding:20px; cursor:zoom-out;';
            modal.innerHTML = `
                <div style="position:relative; max-width:95vw; max-height:95vh; cursor:default;" onclick="event.stopPropagation()">
                    <img id="admin-photo-lightbox-img" style="max-width:100%; max-height:80vh; object-fit:contain; border-radius:10px; box-shadow:0 25px 60px rgba(0,0,0,0.5); background:#000;">
                    <div id="admin-photo-lightbox-caption" style="margin-top:14px; padding:12px 18px; background:rgba(255,255,255,0.96); border-radius:10px; text-align:center; font-family:'Poppins',sans-serif;">
                        <div id="admin-photo-lightbox-name" style="font-weight:700; color:#1e293b; font-size:15px;"></div>
                        <div id="admin-photo-lightbox-time" style="font-size:12px; color:#64748b; margin-top:3px;"></div>
                    </div>
                </div>
                <button type="button" id="admin-photo-lightbox-close" style="position:absolute; top:18px; right:24px; background:rgba(255,255,255,0.18); color:white; border:none; width:46px; height:46px; border-radius:50%; font-size:26px; line-height:1; cursor:pointer; backdrop-filter:blur(8px);" title="Tutup (Esc)">×</button>
            `;
            modal.addEventListener('click', () => adminReports.closeLightbox());
            modal.querySelector('#admin-photo-lightbox-close').addEventListener('click', (e) => { e.stopPropagation(); adminReports.closeLightbox(); });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.style.display === 'flex') adminReports.closeLightbox();
            });
            document.body.appendChild(modal);
        }
        document.getElementById('admin-photo-lightbox-img').src = src;
        document.getElementById('admin-photo-lightbox-name').textContent = caption || '-';
        document.getElementById('admin-photo-lightbox-time').textContent = timestamp || '';
        modal.style.display = 'flex';
    },

    closeLightbox() {
        const modal = document.getElementById('admin-photo-lightbox');
        if (modal) modal.style.display = 'none';
    }
};

window.adminReports = adminReports;
