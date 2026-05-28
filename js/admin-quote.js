/**
 * Portal Karyawan - Admin Kelola Quote (Voting)
 * Admin: tag quote karyawan -> nominee per kategori (max 3 per kategori)
 */
const adminQuote = {
    categories: [],
    nominees: {},      // { categoryId: [nomineeData] }
    allQuotes: [],
    leaderboard: null, // optional

    init() {
        // Default ke periode payroll current
        const today = new Date();
        const todayDate = today.getDate();
        let month = today.getMonth() + 1;
        let year = today.getFullYear();
        if (todayDate >= 26) {
            month += 1;
            if (month > 12) { month = 1; year++; }
        }
        const monthEl = document.getElementById('adminq-month');
        const yearEl = document.getElementById('adminq-year');
        if (monthEl) monthEl.value = String(month);
        if (yearEl) yearEl.value = String(year);
        this.load();
    },

    async load() {
        const catWrap = document.getElementById('adminq-categories');
        const allWrap = document.getElementById('adminq-all-quotes');
        const periodEl = document.getElementById('adminq-period');
        if (catWrap) catWrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        if (allWrap) allWrap.innerHTML = '';

        const month = document.getElementById('adminq-month').value;
        const year = document.getElementById('adminq-year').value;

        try {
            const [resCat, resNom, resAll, resLb] = await Promise.all([
                api.post({ action: 'getQuoteCategories' }),
                api.post({ action: 'getQuoteNominees', bulan: month, tahun: year }),
                api.post({ action: 'getAllQuotesForMonth', bulan: month, tahun: year }),
                api.post({ action: 'getVoteLeaderboard', bulan: month, tahun: year })
            ]);

            this.categories = (resCat && resCat.success) ? resCat.data : [];
            this.nominees = (resNom && resNom.success) ? resNom.data : {};
            this.allQuotes = (resAll && resAll.success) ? resAll.data : [];
            this.leaderboard = (resLb && resLb.success) ? resLb.data : null;

            if (periodEl) periodEl.textContent = (resAll && resAll.period) || '—';

            this.renderCategories();
            this.renderAllQuotes();
        } catch (e) {
            console.error("adminQuote load error:", e);
            if (catWrap) catWrap.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Gagal load: ${e.message}</div>`;
        }
    },

    renderCategories() {
        const wrap = document.getElementById('adminq-categories');
        if (!wrap) return;
        if (this.categories.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">Belum ada kategori. Cek sheet Quote_Categories.</div>';
            return;
        }
        wrap.innerHTML = this.categories.map(cat => {
            const noms = this.nominees[cat.id] || [];
            // Sort by leaderboard vote count if available
            let sortedNoms = noms.slice();
            const lbForCat = this.leaderboard ? this.leaderboard[cat.id] : null;
            if (lbForCat) {
                // Use leaderboard order (includes voteCount + userName)
                sortedNoms = lbForCat;
            }
            const slotCount = 3;
            const filled = sortedNoms.length;
            const empty = Math.max(0, slotCount - filled);

            let nomCards = sortedNoms.map(n => {
                const voteBadge = (n.voteCount !== undefined && n.voteCount > 0)
                    ? `<span style="background:${n.isWinner ? '#fde047' : '#e0e7ff'}; color:${n.isWinner ? '#854d0e' : '#3730a3'}; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700; margin-left:6px;"><i class="fas fa-vote-yea"></i> ${n.voteCount} ${n.isWinner ? '· 🏆 PEMENANG' : ''}</span>`
                    : '<span style="color:#94a3b8; font-size:10px; margin-left:6px;">0 vote</span>';
                const userInfo = n.userName ? `<small style="color:#6366f1; font-weight:600;">${n.userName}</small>` : '';
                return `
                    <div style="border:1px solid ${n.isWinner ? '#fde047' : '#e2e8f0'}; background:${n.isWinner ? '#fef9c3' : '#fff'}; border-radius:8px; padding:10px 12px;">
                        <div style="display:flex; justify-content:space-between; align-items:start; gap:8px;">
                            <div style="flex:1; min-width:0;">
                                ${userInfo}
                                <small style="color:#94a3b8; margin-left:6px;">${n.dateLabel} ${n.type || ''}</small>
                                ${voteBadge}
                                <p style="margin:6px 0 0; font-style:italic; font-size:13px; color:#1e293b; line-height:1.4;">"${n.quote}"</p>
                            </div>
                            <button onclick="adminQuote.removeNominee('${n.nomineeId}')" title="Hapus nominee" style="background:#fee2e2; color:#991b1b; border:none; width:28px; height:28px; border-radius:6px; cursor:pointer; flex-shrink:0;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            for (let i = 0; i < empty; i++) {
                nomCards += `
                    <div style="border:1px dashed #cbd5e1; background:#f8fafc; border-radius:8px; padding:14px; text-align:center; color:#94a3b8; font-size:12px; font-style:italic;">
                        Slot kosong (tag quote dari bawah)
                    </div>
                `;
            }

            return `
                <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px; background:#fafbfc;">
                    <h5 style="margin:0 0 10px; color:#1e293b; font-size:14px;">
                        <i class="fas ${cat.icon}" style="color:#f59e0b;"></i>
                        ${cat.nama}
                        <span style="font-size:11px; color:#94a3b8; font-weight:400;">(${filled}/3)</span>
                    </h5>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${nomCards}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderAllQuotes() {
        const wrap = document.getElementById('adminq-all-quotes');
        if (!wrap) return;
        if (this.allQuotes.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px;">Belum ada quote di periode ini.</div>';
            return;
        }
        // Build set of rowIds yang sudah jadi nominee (untuk disable button)
        const nominatedRowIds = new Set();
        Object.values(this.nominees).forEach(arr => {
            arr.forEach(n => nominatedRowIds.add(String(n.quoteRowId)));
        });

        const catOpts = this.categories.map(c =>
            `<option value="${c.id}">${c.nama}</option>`
        ).join('');

        wrap.innerHTML = this.allQuotes.map(q => {
            const isNominated = nominatedRowIds.has(String(q.rowId));
            const sesiBadge = q.type === 'MASUK'
                ? '<span style="background:#fef3c7; color:#854d0e; font-size:10px; padding:2px 6px; border-radius:6px;"><i class="fas fa-sun"></i> PAGI</span>'
                : '<span style="background:#e0e7ff; color:#3730a3; font-size:10px; padding:2px 6px; border-radius:6px;"><i class="fas fa-moon"></i> SORE</span>';

            return `
                <div style="border:1px solid ${isNominated ? '#10b981' : '#e2e8f0'}; background:${isNominated ? '#f0fdf4' : '#fff'}; border-radius:8px; padding:10px 12px; display:flex; justify-content:space-between; align-items:start; gap:10px; flex-wrap:wrap;">
                    <div style="flex:1; min-width:200px;">
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <strong style="color:#1e293b; font-size:13px;">${q.userName}</strong>
                            ${sesiBadge}
                            <small style="color:#94a3b8;">${q.dateLabel} ${q.timeLabel}</small>
                            ${isNominated ? '<span style="background:#10b981; color:white; font-size:10px; padding:2px 6px; border-radius:6px;"><i class="fas fa-check"></i> NOMINEE</span>' : ''}
                        </div>
                        <p style="margin:6px 0 0; font-style:italic; color:#475569; font-size:13px;">"${q.quote}"</p>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <select id="adminq-tag-${q.rowId}" ${isNominated ? 'disabled' : ''} style="padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; ${isNominated ? 'opacity:0.5;' : ''}">
                            <option value="">-- Pilih kategori --</option>
                            ${catOpts}
                        </select>
                        <button onclick="adminQuote.tagAsNominee(${q.rowId})" ${isNominated ? 'disabled' : ''} style="background:${isNominated ? '#cbd5e1' : '#10b981'}; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:${isNominated ? 'not-allowed' : 'pointer'}; font-size:12px; white-space:nowrap;">
                            ${isNominated ? 'Sudah' : '+ Nominee'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    async tagAsNominee(rowId) {
        const sel = document.getElementById('adminq-tag-' + rowId);
        if (!sel) return;
        const catId = sel.value;
        if (!catId) return alert("Pilih kategori dulu");

        const month = document.getElementById('adminq-month').value;
        const year = document.getElementById('adminq-year').value;
        const adminId = (auth.user && auth.user.id) ? auth.user.id : 'admin';

        try {
            const res = await api.post({
                action: 'addQuoteNominee',
                quoteRowId: rowId,
                categoryId: catId,
                bulan: month,
                tahun: year,
                addedBy: adminId
            });
            if (res && res.success) {
                alert("✅ " + (res.message || "Nominee ditambahkan"));
                await this.load();
            } else {
                alert("❌ Gagal: " + (res.error || "cek koneksi"));
            }
        } catch (e) {
            alert("❌ Error: " + e.message);
        }
    },

    async removeNominee(nomineeId) {
        if (!confirm("Hapus nominee ini? Vote yang sudah masuk juga akan dihapus.")) return;
        try {
            const res = await api.post({ action: 'removeQuoteNominee', id: nomineeId });
            if (res && res.success) {
                alert("✅ " + (res.message || "Nominee dihapus"));
                await this.load();
            } else {
                alert("❌ Gagal: " + (res.error || "cek koneksi"));
            }
        } catch (e) {
            alert("❌ Error: " + e.message);
        }
    }
};

window.adminQuote = adminQuote;
