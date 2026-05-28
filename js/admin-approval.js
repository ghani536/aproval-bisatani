/**
 * Portal Karyawan - Admin Approval Center
 * Pusat approve/reject MASUK + SELESAI_LEMBUR (no edit waktu di sini)
 */
const adminApproval = {
    allData: [],          // semua attendance
    currentTab: 'all',    // all | MASUK | SELESAI_LEMBUR
    selected: new Set(),  // rowId yg di-centang

    async init() {
        this.selected.clear();
        // Default date filter: empty (semua)
        await this.load();
    },

    async load() {
        const cards = document.getElementById('approval-cards');
        if (cards) cards.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px 20px;"><i class="fas fa-sync fa-spin"></i> Memuat data approval...</div>';

        try {
            const res = await api.post({ action: 'getAllAttendanceData' });
            if (res && res.success) {
                this.allData = (res.data || []).map((item, idx) => {
                    if (!item.rowId) item.rowId = idx + 2;
                    return item;
                });
                // Filter hanya tipe yang butuh approval
                this.allData = this.allData.filter(d => d.type === 'MASUK' || d.type === 'SELESAI_LEMBUR');
                this.updateBadge();
                this.render();
            } else {
                cards.innerHTML = '<div style="text-align:center; color:#ef4444; padding:30px;">Gagal load data</div>';
            }
        } catch (e) {
            cards.innerHTML = `<div style="text-align:center; color:#ef4444; padding:30px;">Error: ${e.message}</div>`;
        }
    },

    // Update angka counter di tab + badge sidebar
    updateBadge() {
        const pending = this.allData.filter(d => (d.approvalStatus || 'PENDING') === 'PENDING');
        const pendingMasuk = pending.filter(d => d.type === 'MASUK').length;
        const pendingLembur = pending.filter(d => d.type === 'SELESAI_LEMBUR').length;
        const total = pendingMasuk + pendingLembur;

        const el = id => document.getElementById(id);
        if (el('cnt-all')) el('cnt-all').textContent = total;
        if (el('cnt-masuk')) el('cnt-masuk').textContent = pendingMasuk;
        if (el('cnt-lembur')) el('cnt-lembur').textContent = pendingLembur;

        // Update sidebar badge
        const badge = el('approval-badge');
        if (badge) {
            if (total > 0) {
                badge.textContent = total;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    },

    setTab(tab) {
        this.currentTab = tab;
        this.selected.clear();
        // Update tab visual
        const tabs = { all: 'atab-all', MASUK: 'atab-masuk', SELESAI_LEMBUR: 'atab-lembur' };
        Object.keys(tabs).forEach(key => {
            const btn = document.getElementById(tabs[key]);
            if (!btn) return;
            const active = key === tab;
            btn.style.background = active ? '#fff' : 'transparent';
            btn.style.color = active ? '#1e293b' : '#64748b';
            btn.style.boxShadow = active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none';
        });
        this.render();
    },

    getFilteredData() {
        const status = document.getElementById('approval-status-filter')?.value || '';
        const dFrom = document.getElementById('approval-date-from')?.value || '';
        const dTo = document.getElementById('approval-date-to')?.value || '';
        let data = this.allData.slice();
        // Filter by tab type
        if (this.currentTab !== 'all') {
            data = data.filter(d => d.type === this.currentTab);
        }
        // Filter by status (default PENDING)
        if (status) {
            data = data.filter(d => (d.approvalStatus || 'PENDING') === status);
        }
        // Filter by date
        data = data.filter(d => {
            if (!d.timestamp) return false;
            const dt = String(d.timestamp).substring(0, 10);
            if (dFrom && dt < dFrom) return false;
            if (dTo && dt > dTo) return false;
            return true;
        });
        // Sort: PENDING dulu, lalu by timestamp DESC
        data.sort((a, b) => {
            const sa = (a.approvalStatus || 'PENDING') === 'PENDING' ? 0 : 1;
            const sb = (b.approvalStatus || 'PENDING') === 'PENDING' ? 0 : 1;
            if (sa !== sb) return sa - sb;
            return String(b.timestamp).localeCompare(String(a.timestamp));
        });
        return data;
    },

    render() {
        const cards = document.getElementById('approval-cards');
        const bulkBar = document.getElementById('approval-bulk-bar');
        const selectAllWrap = document.getElementById('approval-select-all-wrap');
        if (!cards) return;

        const data = this.getFilteredData();
        const statusFilter = document.getElementById('approval-status-filter')?.value || '';

        // Tampilkan select-all + bulk hanya kalau filter PENDING (yang relevan untuk bulk approve)
        if (selectAllWrap) selectAllWrap.style.display = (statusFilter === 'PENDING' && data.length > 0) ? 'block' : 'none';
        this._renderBulkBar();

        if (data.length === 0) {
            cards.innerHTML = `
                <div style="text-align:center; color:#94a3b8; padding:50px 20px; background:#f8fafc; border-radius:10px;">
                    <i class="fas fa-check-circle" style="font-size:3rem; color:#10b981; opacity:0.5; margin-bottom:12px;"></i>
                    <p style="margin:0; font-weight:600;">Tidak ada yang perlu di-approve</p>
                    <p style="margin:6px 0 0; font-size:13px;">${statusFilter === 'PENDING' ? 'Semua sudah dihandle 🎉' : 'Coba ubah filter di atas'}</p>
                </div>
            `;
            return;
        }

        cards.innerHTML = data.map(log => this._renderCard(log, statusFilter)).join('');
    },

    _renderCard(log, statusFilter) {
        const status = log.approvalStatus || 'PENDING';
        const isPending = status === 'PENDING';
        const isMasuk = log.type === 'MASUK';
        const isLembur = log.type === 'SELESAI_LEMBUR';

        const typeBadge = isMasuk
            ? '<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:700;"><i class="fas fa-sign-in-alt"></i> KEHADIRAN</span>'
            : '<span style="background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:700;"><i class="fas fa-moon"></i> LEMBUR</span>';

        let statusBadge = '';
        if (status === 'APPROVED') statusBadge = '<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:700;"><i class="fas fa-check-circle"></i> APPROVED</span>';
        else if (status === 'REJECTED') statusBadge = '<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:700;"><i class="fas fa-times-circle"></i> REJECTED</span>';
        else statusBadge = '<span style="background:#fef3c7; color:#854d0e; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:700;"><i class="fas fa-clock"></i> PENDING</span>';

        const isChecked = this.selected.has(String(log.rowId));
        const checkbox = isPending
            ? `<input type="checkbox" ${isChecked ? 'checked' : ''} onchange="adminApproval.toggleRow('${log.rowId}', this.checked)" style="margin-right:8px; cursor:pointer; width:18px; height:18px;">`
            : '';

        const fotoHtml = log.hasImage
            ? `<button onclick="adminReports.openPhotoLazy(${log.rowId}, '${(log.userName||'').replace(/'/g,"\\'")}', '${String(log.quote||'').replace(/'/g,"\\'").replace(/\n/g,' ')}')" style="width:48px; height:48px; border-radius:8px; cursor:zoom-in; border:1px solid #e2e8f0; background:#f0fdf4; color:#10b981; padding:0;" title="Klik untuk lihat foto"><i class="fas fa-image" style="font-size:18px;"></i></button>`
            : '<div style="width:48px; height:48px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#94a3b8;"><i class="fas fa-user"></i></div>';

        // Tampilkan info detail per type
        let detailInfo = '';
        if (isMasuk) {
            const telat = log.statusTelat && log.statusTelat !== '-' && log.statusTelat !== '0'
                ? `<span style="color:#ef4444;"><i class="fas fa-clock"></i> Telat ${log.statusTelat} mnt</span>`
                : '<span style="color:#10b981;"><i class="fas fa-check"></i> Tepat waktu</span>';
            detailInfo = `<div style="font-size:12px; color:#64748b; margin-top:4px;">${telat}</div>`;
        } else if (isLembur) {
            detailInfo = `<div style="font-size:12px; color:#64748b; margin-top:4px;"><i class="fas fa-moon"></i> ${log.mulai || '-'} → ${log.selesai || '-'} · <strong>${log.totalHours || '0'}j</strong></div>`;
        }

        const quoteHtml = log.quote
            ? `<div style="background:#f8fafc; padding:6px 10px; border-radius:6px; margin-top:6px; border-left:3px solid #cbd5e1;">
                <i class="fas fa-quote-left" style="color:#cbd5e1; font-size:10px;"></i>
                <small style="font-style:italic; color:#64748b;"> ${log.quote}</small>
              </div>`
            : '';

        const actionButtons = isPending
            ? `<div style="display:flex; gap:6px; margin-top:10px;">
                <button onclick="adminApproval.singleAction('${log.rowId}', 'APPROVED')" style="flex:1; background:#10b981; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px;">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button onclick="adminApproval.singleAction('${log.rowId}', 'REJECTED')" style="flex:1; background:#ef4444; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px;">
                    <i class="fas fa-times"></i> Reject
                </button>
            </div>`
            : '';

        const borderColor = isPending ? '#fcd34d' : (status === 'APPROVED' ? '#86efac' : '#fca5a5');
        const bgColor = isPending ? '#fffbeb' : (status === 'APPROVED' ? '#f0fdf4' : '#fef2f2');

        return `
            <div style="border:1px solid ${borderColor}; background:${bgColor}; border-radius:10px; padding:12px; display:flex; gap:12px; align-items:flex-start;">
                ${checkbox}
                ${fotoHtml}
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                        <strong style="color:#1e293b;">${log.userName || log.userId}</strong>
                        ${typeBadge}
                        ${statusBadge}
                    </div>
                    <div style="color:#64748b; font-size:12px;">
                        <i class="far fa-calendar"></i> ${log.timestamp || '-'}
                        ${log.location && log.location !== '-' ? `<br><i class="fas fa-map-marker-alt"></i> ${String(log.location).substring(0, 80)}${String(log.location).length > 80 ? '...' : ''}` : ''}
                    </div>
                    ${detailInfo}
                    ${quoteHtml}
                    ${actionButtons}
                </div>
            </div>
        `;
    },

    toggleRow(rowId, checked) {
        if (checked) this.selected.add(String(rowId));
        else this.selected.delete(String(rowId));
        this._renderBulkBar();
        // Update selectAll checkbox state
        const data = this.getFilteredData().filter(d => (d.approvalStatus || 'PENDING') === 'PENDING');
        const all = document.getElementById('approval-select-all');
        if (all) all.checked = data.length > 0 && data.every(d => this.selected.has(String(d.rowId)));
    },

    toggleSelectAll(checked) {
        const data = this.getFilteredData().filter(d => (d.approvalStatus || 'PENDING') === 'PENDING');
        if (checked) {
            data.forEach(d => this.selected.add(String(d.rowId)));
        } else {
            data.forEach(d => this.selected.delete(String(d.rowId)));
        }
        this.render();
    },

    clearSelection() {
        this.selected.clear();
        this.render();
    },

    _renderBulkBar() {
        const bar = document.getElementById('approval-bulk-bar');
        const cnt = document.getElementById('bulk-count');
        if (!bar) return;
        if (this.selected.size > 0) {
            bar.style.display = 'flex';
            if (cnt) cnt.textContent = this.selected.size;
        } else {
            bar.style.display = 'none';
        }
    },

    async singleAction(rowId, status) {
        if (!confirm(`${status === 'APPROVED' ? 'Approve' : 'Reject'} baris ini?`)) return;
        try {
            const res = await api.post({
                action: 'saveEmployee',
                subAction: 'updateApproval',
                rowId: rowId,
                status: status
            });
            if (res && res.success) {
                // Update lokal
                const item = this.allData.find(d => String(d.rowId) === String(rowId));
                if (item) item.approvalStatus = status;
                this.selected.delete(String(rowId));
                this.updateBadge();
                this.render();
            } else {
                alert("❌ Gagal: " + (res.error || "cek koneksi"));
            }
        } catch (e) {
            alert("❌ Error: " + e.message);
        }
    },

    async bulkAction(status) {
        const ids = Array.from(this.selected);
        if (ids.length === 0) return;
        if (!confirm(`${status === 'APPROVED' ? 'Approve' : 'Reject'} ${ids.length} baris yang dipilih?`)) return;

        const bar = document.getElementById('approval-bulk-bar');
        if (bar) bar.innerHTML = `<span style="color:#4338ca; font-weight:600;"><i class="fas fa-spinner fa-spin"></i> Memproses 0/${ids.length}...</span>`;

        let success = 0, failed = 0;
        for (let i = 0; i < ids.length; i++) {
            const rowId = ids[i];
            try {
                const res = await api.post({
                    action: 'saveEmployee',
                    subAction: 'updateApproval',
                    rowId: rowId,
                    status: status
                });
                if (res && res.success) {
                    success++;
                    const item = this.allData.find(d => String(d.rowId) === String(rowId));
                    if (item) item.approvalStatus = status;
                } else {
                    failed++;
                }
            } catch (e) {
                failed++;
            }
            if (bar) bar.innerHTML = `<span style="color:#4338ca; font-weight:600;"><i class="fas fa-spinner fa-spin"></i> Memproses ${i+1}/${ids.length}...</span>`;
        }

        this.selected.clear();
        this.updateBadge();
        this.render();
        alert(`Selesai!\n✅ Sukses: ${success}\n${failed > 0 ? '❌ Gagal: ' + failed : ''}`);
    },

    // Untuk dipanggil saat login admin / page lain — refresh badge
    async refreshBadgeOnly() {
        try {
            const res = await api.post({ action: 'getAllAttendanceData' });
            if (res && res.success) {
                const data = (res.data || []).filter(d =>
                    (d.type === 'MASUK' || d.type === 'SELESAI_LEMBUR') &&
                    (d.approvalStatus || 'PENDING') === 'PENDING'
                );
                const badge = document.getElementById('approval-badge');
                if (badge) {
                    if (data.length > 0) {
                        badge.textContent = data.length;
                        badge.style.display = 'inline-block';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            }
        } catch (e) {}
    }
};

window.adminApproval = adminApproval;
