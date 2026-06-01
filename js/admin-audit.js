/**
 * Portal Super Admin - Audit Log
 * Track aktivitas admin yang mengubah data sensitif (jam absen, approval, dst)
 */
const adminAudit = {
    items: [],

    init() {
        this.load();
    },

    _esc(s) {
        return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    clearFilters() {
        ['audit-filter-actor', 'audit-filter-action', 'audit-filter-target', 'audit-filter-from', 'audit-filter-to'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.load();
    },

    toggleFilters() {
        const el = document.getElementById('audit-filters');
        if (!el) return;
        el.style.display = (el.style.display === 'none' || !el.style.display) ? 'flex' : 'none';
    },

    _tipeLabel(t) {
        const m = {
            'MASUK': 'masuk', 'PULANG': 'pulang',
            'MULAI_LEMBUR': 'mulai lembur', 'SELESAI_LEMBUR': 'selesai lembur',
            'CUTI': 'cuti', 'IZIN': 'izin'
        };
        const key = String(t || '').toUpperCase();
        return m[key] || String(t || '').toLowerCase();
    },

    _meta(log) {
        try { return JSON.parse(log.metadata || '{}'); } catch (e) { return {}; }
    },

    // Kalimat ringkas bahasa Indonesia: "menyetujui absen masuk <b>Budi</b>"
    _summary(log) {
        const meta = this._meta(log);
        const nama = this._esc(meta.nama || log.target_id || '-');
        const tipe = this._tipeLabel(meta.tipe || '');
        const action = String(log.action || '').toUpperCase();
        const isPengajuan = String(log.target_type || '').toLowerCase() === 'pengajuan';

        if (action === 'EDIT_TIME') {
            return `mengedit jam absen <b>${nama}</b>${tipe ? ` (${tipe})` : ''}`;
        }
        const verb = { 'APPROVE': 'menyetujui', 'REJECT': 'menolak', 'RESET': 'reset' }[action] || action.toLowerCase();
        if (isPengajuan) {
            return `${verb} pengajuan ${tipe} <b>${nama}</b>`;
        }
        return `${verb} absen ${tipe} <b>${nama}</b>`;
    },

    // "Hari ini 14:30" / "Kemarin 09:12" / "1 Jun 14:30"
    _dayLabel(ts) {
        const m = String(ts).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
        if (!m) return this._esc(ts);
        const d = new Date(+m[1], +m[2] - 1, +m[3]);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diff = Math.round((today - d) / 86400000);
        const jam = `${m[4]}:${m[5]}`;
        if (diff === 0) return `Hari ini ${jam}`;
        if (diff === 1) return `Kemarin ${jam}`;
        const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${+m[3]} ${namaBulan[+m[2] - 1]} ${jam}`;
    },

    async load() {
        const wrap = document.getElementById('audit-log-list');
        if (!wrap) return;
        wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px;"><i class="fas fa-sync fa-spin"></i> Memuat audit log...</div>';

        const payload = {
            action: 'getAuditLog',
            actor_id: (auth.user && auth.user.id) || '',
            filter_actor: document.getElementById('audit-filter-actor')?.value || '',
            filter_action: document.getElementById('audit-filter-action')?.value || '',
            filter_target: document.getElementById('audit-filter-target')?.value || '',
            date_from: document.getElementById('audit-filter-from')?.value || '',
            date_to: document.getElementById('audit-filter-to')?.value || '',
            limit: 200
        };

        try {
            const res = await api.post(payload);
            if (!res || !res.success) {
                wrap.innerHTML = `<div style="text-align:center; color:#ef4444; padding:30px;"><i class="fas fa-exclamation-triangle"></i> ${(res && res.error) || 'Gagal load audit log'}</div>`;
                return;
            }
            this.items = res.data || [];
            this.render();
        } catch (e) {
            wrap.innerHTML = `<div style="text-align:center; color:#ef4444; padding:30px;">Error: ${e.message}</div>`;
        }
    },

    render() {
        const wrap = document.getElementById('audit-log-list');
        if (this.items.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px;"><i class="fas fa-inbox" style="font-size:2rem; opacity:0.5;"></i><p style="margin:8px 0 0;">Tidak ada log dengan filter ini</p></div>';
            return;
        }

        const actionStyle = {
            'APPROVE': { color: '#10b981', bg: '#dcfce7', icon: 'fa-check-circle' },
            'REJECT': { color: '#ef4444', bg: '#fee2e2', icon: 'fa-times-circle' },
            'RESET': { color: '#f59e0b', bg: '#fef3c7', icon: 'fa-undo' },
            'EDIT_TIME': { color: '#3b82f6', bg: '#dbeafe', icon: 'fa-clock' },
            'CREATE': { color: '#10b981', bg: '#dcfce7', icon: 'fa-plus-circle' },
            'UPDATE': { color: '#3b82f6', bg: '#dbeafe', icon: 'fa-edit' },
            'DELETE': { color: '#ef4444', bg: '#fee2e2', icon: 'fa-trash' }
        };

        wrap.innerHTML = `<div style="background:#f1f5f9; padding:8px 12px; border-radius:6px; margin-bottom:10px; font-size:12px; color:#475569;">
            Menampilkan <b>${this.items.length}</b> log terbaru. Klik baris untuk lihat detail perubahan.
        </div>` + this.items.map(log => {
            const a = actionStyle[log.action] || { color: '#64748b', bg: '#f1f5f9', icon: 'fa-circle' };
            const hasDetails = log.old_value || log.new_value || log.metadata;
            const detailId = 'audit-detail-' + log.id;
            return `<div style="border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; overflow:hidden;">
                <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:${hasDetails ? 'pointer' : 'default'};" ${hasDetails ? `onclick="adminAudit.toggleDetail('${detailId}')"` : ''}>
                    <div style="background:${a.bg}; color:${a.color}; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fas ${a.icon}"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; color:#1e293b;">
                            <b>${this._esc(log.actor_name)}</b> ${this._summary(log)}
                        </div>
                        <div style="font-size:11px; color:#94a3b8; margin-top:2px;"><i class="far fa-clock"></i> ${this._dayLabel(log.timestamp)}</div>
                    </div>
                    ${hasDetails ? `<i class="fas fa-chevron-down" id="${detailId}-icon" style="color:#94a3b8; transition:transform 0.2s; flex-shrink:0;"></i>` : ''}
                </div>
                ${hasDetails ? `<div id="${detailId}" style="display:none; padding:0 14px 12px; border-top:1px solid #f1f5f9; background:#fafbfc;">
                    ${log.old_value ? `<div style="margin-top:10px;">
                        <div style="font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:4px;">OLD VALUE</div>
                        <pre style="background:#fee2e2; padding:8px 10px; border-radius:6px; font-size:11px; color:#7f1d1d; white-space:pre-wrap; word-break:break-all; margin:0; font-family:monospace;">${this._esc(this._prettyJSON(log.old_value))}</pre>
                    </div>` : ''}
                    ${log.new_value ? `<div style="margin-top:10px;">
                        <div style="font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:4px;">NEW VALUE</div>
                        <pre style="background:#dcfce7; padding:8px 10px; border-radius:6px; font-size:11px; color:#14532d; white-space:pre-wrap; word-break:break-all; margin:0; font-family:monospace;">${this._esc(this._prettyJSON(log.new_value))}</pre>
                    </div>` : ''}
                    ${log.metadata ? `<div style="margin-top:10px;">
                        <div style="font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:4px;">METADATA</div>
                        <pre style="background:#f1f5f9; padding:8px 10px; border-radius:6px; font-size:11px; color:#475569; white-space:pre-wrap; word-break:break-all; margin:0; font-family:monospace;">${this._esc(this._prettyJSON(log.metadata))}</pre>
                    </div>` : ''}
                </div>` : ''}
            </div>`;
        }).join('');
    },

    _prettyJSON(str) {
        try {
            const obj = JSON.parse(str);
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return String(str);
        }
    },

    toggleDetail(detailId) {
        const el = document.getElementById(detailId);
        const icon = document.getElementById(detailId + '-icon');
        if (!el) return;
        const isOpen = el.style.display !== 'none';
        el.style.display = isOpen ? 'none' : 'block';
        if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    }
};

window.adminAudit = adminAudit;
