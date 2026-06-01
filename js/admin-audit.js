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
            Menampilkan <b>${this.items.length}</b> log terbaru. Sorted by tanggal terbaru.
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
                            <b>${this._esc(log.actor_name)}</b>
                            <span style="background:${a.bg}; color:${a.color}; padding:1px 8px; border-radius:8px; font-size:10px; font-weight:700; margin-left:4px;">${log.action}</span>
                            <span style="background:#f1f5f9; color:#475569; padding:1px 8px; border-radius:8px; font-size:10px; margin-left:2px;">${this._esc(log.target_type)}</span>
                        </div>
                        <div style="font-size:11px; color:#64748b; margin-top:2px;">${this._esc(log.target_id)}</div>
                    </div>
                    <div style="text-align:right; font-size:11px; color:#94a3b8; white-space:nowrap;">${this._esc(log.timestamp)}</div>
                    ${hasDetails ? `<i class="fas fa-chevron-down" id="${detailId}-icon" style="color:#94a3b8; transition:transform 0.2s;"></i>` : ''}
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
