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
            const finalRowId = log.rowId;
            // Tombol edit waktu (hanya untuk type yang relevan)
            const editableTypes = ['MASUK', 'PULANG', 'MULAI_LEMBUR', 'SELESAI_LEMBUR'];
            const canEdit = editableTypes.includes(String(log.type));

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="text-align:center; padding:10px;">${index + 1}</td>
                    <td style="padding:10px;"><small>${log.timestamp}</small></td>
                    <td style="padding:10px;"><strong>${log.userName || log.userId}</strong></td>
                    <td style="padding:10px;"><span class="badge-${String(log.type).toLowerCase().replace(/_/g, '-')}">${log.type}</span></td>
                    <td style="padding:10px;"><small>${log.location || '-'}</small></td>
                    <td style="text-align:center; padding:10px;">
                        ${log.thumbnail
                            ? `<img src="${log.thumbnail}" onclick="adminReports.openPhotoLazy(${finalRowId}, '${(log.userName || log.userId || '').replace(/'/g,"\\'")}', '${String(log.quote || '').replace(/'/g,"\\'").replace(/\n/g,' ')}')" style="width:42px; height:32px; object-fit:cover; border-radius:6px; cursor:zoom-in; border:1px solid #e2e8f0;" title="Klik untuk perbesar">`
                            : log.hasImage
                                ? `<button onclick="adminReports.openPhotoLazy(${finalRowId}, '${(log.userName || log.userId || '').replace(/'/g,"\\'")}', '${String(log.quote || '').replace(/'/g,"\\'").replace(/\n/g,' ')}')" style="width:42px; height:32px; border-radius:6px; cursor:zoom-in; border:1px solid #e2e8f0; background:#f0fdf4; color:#10b981;" title="Foto lama (klik lihat full)"><i class="fas fa-image"></i></button>`
                                : '<span style="color:#cbd5e1;">—</span>'}
                    </td>
                    <td style="padding:10px; color:#ef4444;"><small>${log.statusTelat || '-'}</small></td>
                    <td style="text-align:center; padding:10px;">${log.mulai || '-'}</td>
                    <td style="text-align:center; padding:10px;">${log.selesai || '-'}</td>
                    <td style="text-align:center; font-weight:bold; color:#2563eb; padding:10px;">${log.totalHours || '0'} j</td>
                    <td style="text-align:center; padding:10px;">
                        ${canEdit ? `<button onclick="adminReports.openEditTime(${finalRowId})"
                            style="background:#f59e0b; color:white; border:none; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:12px; font-weight:600;" title="Edit waktu absen">
                            <i class="fas fa-pen"></i> Edit
                        </button>` : '<span style="color:#cbd5e1;">—</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    }
,

    // Lazy load foto by rowId, lalu tampil di lightbox
    async openPhotoLazy(rowId, caption, quote) {
        // Open lightbox immediately dengan loading state
        this.showLightbox('LOADING', caption, quote);
        try {
            const res = await api.post({ action: 'getAttendanceImage', rowId: rowId });
            if (res && res.success && res.image) {
                const imgEl = document.getElementById('admin-photo-lightbox-img');
                if (imgEl) imgEl.src = res.image;
            } else {
                const imgEl = document.getElementById('admin-photo-lightbox-img');
                if (imgEl) imgEl.alt = 'Foto tidak tersedia';
                alert('Gagal load foto: ' + (res.error || 'cek koneksi'));
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    },

    // Lightbox foto selfie absen — modal full-screen, klik backdrop / Esc untuk tutup
    showLightbox(src, caption, quote) {
        if (!src) return;
        let modal = document.getElementById('admin-photo-lightbox');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'admin-photo-lightbox';
            modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.88); display:none; align-items:center; justify-content:center; z-index:99999; padding:20px; cursor:zoom-out;';
            modal.innerHTML = `
                <div style="position:relative; max-width:95vw; max-height:95vh; cursor:default;" onclick="event.stopPropagation()">
                    <img id="admin-photo-lightbox-img" style="max-width:100%; max-height:75vh; object-fit:contain; border-radius:10px; box-shadow:0 25px 60px rgba(0,0,0,0.5); background:#000;">
                    <div id="admin-photo-lightbox-caption" style="margin-top:14px; padding:14px 20px; background:rgba(255,255,255,0.96); border-radius:10px; text-align:center; font-family:'Poppins',sans-serif;">
                        <div id="admin-photo-lightbox-name" style="font-weight:700; color:#1e293b; font-size:16px;"></div>
                        <div id="admin-photo-lightbox-quote" style="font-size:13px; color:#475569; margin-top:8px; font-style:italic; line-height:1.5;"></div>
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
        const imgEl = document.getElementById('admin-photo-lightbox-img');
        if (src === 'LOADING') {
            // Tampilkan placeholder spinner
            imgEl.removeAttribute('src');
            imgEl.alt = 'Memuat foto...';
            imgEl.style.background = '#1e293b';
        } else {
            imgEl.src = src;
            imgEl.style.background = '#000';
        }
        document.getElementById('admin-photo-lightbox-name').textContent = caption || '-';
        const quoteEl = document.getElementById('admin-photo-lightbox-quote');
        const cleanQuote = String(quote || '').trim();
        if (cleanQuote) {
            quoteEl.innerHTML = '<i class="fas fa-quote-left" style="color:#cbd5e1; margin-right:4px;"></i> ' + cleanQuote + ' <i class="fas fa-quote-right" style="color:#cbd5e1; margin-left:4px;"></i>';
            quoteEl.style.display = 'block';
        } else {
            quoteEl.innerHTML = '<span style="color:#cbd5e1;">— tidak ada pesan —</span>';
            quoteEl.style.display = 'block';
        }
        modal.style.display = 'flex';
    },

    // ==================== EDIT WAKTU ABSEN ====================
    openEditTime(rowId) {
        const log = this.allAttendance.find(a => String(a.rowId) === String(rowId));
        if (!log) return alert("Data tidak ditemukan");

        const type = String(log.type || '').toUpperCase();
        const ts = String(log.timestamp || '');
        // Extract HH:MM dari "yyyy-MM-dd HH:mm:ss"
        const tsTimeMatch = ts.match(/(\d{1,2}):(\d{2})/);
        const tsTime = tsTimeMatch ? (tsTimeMatch[1].padStart(2,'0') + ':' + tsTimeMatch[2]) : '';

        let modal = document.getElementById('admin-edit-time-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'admin-edit-time-modal';
            modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); display:none; align-items:center; justify-content:center; z-index:99999; padding:20px;';
            document.body.appendChild(modal);
            // Click backdrop = close
            modal.addEventListener('click', (e) => {
                if (e.target === modal) adminReports.closeEditTime();
            });
        }

        // Render isi modal sesuai type
        let typeLabel = type.replace(/_/g, ' ');
        let fields = '';
        if (type === 'SELESAI_LEMBUR') {
            fields = `
                <div style="margin-bottom:14px;">
                    <label style="display:block; font-size:11px; font-weight:700; color:#6366f1; margin-bottom:6px;">MULAI LEMBUR</label>
                    <input type="time" id="edit-mulai-lembur" value="${log.mulai || ''}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px;">
                </div>
                <div style="margin-bottom:14px;">
                    <label style="display:block; font-size:11px; font-weight:700; color:#0ea5e9; margin-bottom:6px;">SELESAI LEMBUR</label>
                    <input type="time" id="edit-selesai-lembur" value="${log.selesai || ''}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px;">
                </div>
            `;
        } else {
            // MASUK / PULANG / MULAI_LEMBUR: edit jam aksi
            const labelColor = type === 'MASUK' ? '#10b981' : (type === 'PULANG' ? '#f43f5e' : '#6366f1');
            const recalcNote = type === 'MASUK'
                ? '<div style="background:#f0fdf4; border-left:3px solid #10b981; padding:8px 12px; font-size:11px; color:#166534; margin-top:8px; border-radius:4px;"><i class="fas fa-info-circle"></i> Status telat akan dihitung ulang otomatis dari jam masuk standar.</div>'
                : '';
            fields = `
                <div style="margin-bottom:14px;">
                    <label style="display:block; font-size:11px; font-weight:700; color:${labelColor}; margin-bottom:6px;">JAM ${typeLabel}</label>
                    <input type="time" id="edit-waktu-aksi" value="${tsTime}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px;">
                    ${recalcNote}
                </div>
            `;
        }

        modal.innerHTML = `
            <div style="background:white; padding:24px; border-radius:14px; width:90%; max-width:420px; box-shadow:0 10px 30px rgba(0,0,0,0.3);">
                <div style="margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #e2e8f0;">
                    <h3 style="margin:0; font-size:18px; color:#1e293b;"><i class="fas fa-pen" style="color:#f59e0b;"></i> Edit Waktu Absen</h3>
                    <div style="margin-top:6px; font-size:13px; color:#64748b;">
                        <strong>${log.userName || log.userId}</strong> · <span class="badge-${type.toLowerCase().replace(/_/g,'-')}" style="font-size:11px;">${type}</span><br>
                        <small>Tanggal: ${ts.substring(0, 10)}</small>
                    </div>
                </div>
                ${fields}
                <div style="display:flex; gap:10px; margin-top:8px;">
                    <button onclick="adminReports.submitEditTime(${rowId}, '${type}')" id="edit-time-save"
                        style="flex:1; background:#10b981; color:white; border:none; padding:11px; border-radius:8px; cursor:pointer; font-weight:700;">SIMPAN</button>
                    <button onclick="adminReports.closeEditTime()"
                        style="flex:1; background:#f1f5f9; color:#475569; border:none; padding:11px; border-radius:8px; cursor:pointer;">BATAL</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    },

    closeEditTime() {
        const m = document.getElementById('admin-edit-time-modal');
        if (m) m.style.display = 'none';
    },

    async submitEditTime(rowId, type) {
        const btn = document.getElementById('edit-time-save');
        const orig = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'; }

        const payload = { action: 'updateAttendanceTime', rowId: rowId };

        if (type === 'SELESAI_LEMBUR') {
            const m = (document.getElementById('edit-mulai-lembur') || {}).value;
            const s = (document.getElementById('edit-selesai-lembur') || {}).value;
            if (m) payload.mulaiLembur = m;
            if (s) payload.selesaiLembur = s;
        } else {
            const w = (document.getElementById('edit-waktu-aksi') || {}).value;
            if (w) payload.waktuAksi = w;
        }

        try {
            const res = await api.post(payload);
            if (res && res.success) {
                alert("✅ " + (res.message || "Waktu absen berhasil diupdate"));
                this.closeEditTime();
                await this.loadData(); // refresh tabel
            } else {
                alert("❌ Gagal: " + (res.error || "Cek backend"));
                if (btn) { btn.disabled = false; btn.innerHTML = orig; }
            }
        } catch (e) {
            alert("❌ Error koneksi: " + e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
        }
    },

    closeLightbox() {
        const modal = document.getElementById('admin-photo-lightbox');
        if (modal) modal.style.display = 'none';
    }
};

window.adminReports = adminReports;
