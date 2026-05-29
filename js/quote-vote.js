/**
 * Portal Karyawan - Vote Quote Bulanan
 * Karyawan pilih 1 quote favorit per kategori (anonymous)
 */
const quoteVote = {
    categories: [],
    nominees: {},   // categoryId -> [nominee]
    myVotes: {},    // categoryId -> nomineeId
    period: '',

    async getCurrentPeriod() {
        const today = new Date();
        const todayDate = today.getDate();
        let month = today.getMonth() + 1;
        let year = today.getFullYear();
        const startDay = await api.getPeriodStartDay();
        if (todayDate >= startDay) {
            month += 1;
            if (month > 12) { month = 1; year++; }
        }
        return { month, year };
    },

    async load() {
        const wrap = document.getElementById('quote-vote-content');
        const periodEl = document.getElementById('quote-vote-period');
        if (!wrap) return;
        wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat nominee...</div>';

        const { month, year } = await this.getCurrentPeriod();
        const userId = (auth.user && auth.user.id) ? auth.user.id : '';

        try {
            const [resCat, resNom, resMyVotes] = await Promise.all([
                api.post({ action: 'getQuoteCategories' }),
                api.post({ action: 'getQuoteNominees', bulan: month, tahun: year }),
                api.post({ action: 'getMyVotes', userId: userId, bulan: month, tahun: year })
            ]);

            this.categories = (resCat && resCat.success) ? resCat.data : [];
            this.nominees = (resNom && resNom.success) ? resNom.data : {};

            this.myVotes = {};
            if (resMyVotes && resMyVotes.success) {
                (resMyVotes.data || []).forEach(v => {
                    this.myVotes[String(v.categoryId)] = String(v.nomineeId);
                });
            }

            if (periodEl) periodEl.innerHTML = `<strong>Periode:</strong> ${(resNom && resNom.period) || 'bulan ' + month + '/' + year}`;
            this.render();
        } catch (e) {
            console.error("quote vote load error:", e);
            wrap.innerHTML = `<div style="text-align:center; color:#ef4444; padding:30px;">Gagal load: ${e.message}</div>`;
        }
    },

    render() {
        const wrap = document.getElementById('quote-vote-content');
        if (!wrap) return;

        if (this.categories.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px;">Belum ada kategori voting.</div>';
            return;
        }

        const totalCat = this.categories.length;
        const totalVoted = Object.keys(this.myVotes).length;
        const currentUserId = (auth.user && auth.user.id) ? String(auth.user.id) : '';

        let html = `
            <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:10px 14px; margin-bottom:14px; text-align:center;">
                <strong style="color:#166534;">Progress voting: ${totalVoted} / ${totalCat} kategori</strong>
                ${totalVoted === totalCat ? ' 🎉 Lengkap!' : ''}
            </div>
        `;

        html += this.categories.map(cat => {
            const noms = this.nominees[cat.id] || [];
            const myVote = this.myVotes[String(cat.id)] || null;
            const isVoted = !!myVote;

            const headerBg = isVoted ? '#dcfce7' : '#fff';
            const headerColor = isVoted ? '#166534' : '#1e293b';

            let nomineeCards = '';
            if (noms.length === 0) {
                nomineeCards = `<div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:20px; text-align:center; color:#94a3b8; font-size:13px;">
                    Belum ada nominee di kategori ini. Tunggu admin shortlist quote.
                </div>`;
            } else {
                nomineeCards = noms.map((n, idx) => {
                    const isMine = String(n.userId) === currentUserId;
                    const isPicked = String(n.nomineeId) === String(myVote);
                    const labelLetter = String.fromCharCode(65 + idx); // A, B, C
                    const sesi = n.type === 'MASUK'
                        ? { label: 'PAGI', color: '#f59e0b' }
                        : { label: 'SORE', color: '#6366f1' };

                    if (isMine) {
                        return `
                            <div style="border:1px dashed #cbd5e1; background:#f8fafc; border-radius:10px; padding:12px; opacity:0.7;">
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                                    <span style="background:#cbd5e1; color:white; width:24px; height:24px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">${labelLetter}</span>
                                    <span style="background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:600;">QUOTE ANDA</span>
                                </div>
                                <p style="margin:0; font-style:italic; color:#64748b; font-size:13px; line-height:1.4;">"${n.quote}"</p>
                                <small style="color:#94a3b8; display:block; margin-top:6px;">Anda tidak bisa vote quote sendiri</small>
                            </div>
                        `;
                    }

                    const cardBorder = isPicked ? '#10b981' : '#e2e8f0';
                    const cardBg = isPicked ? '#f0fdf4' : '#fff';
                    const btnLabel = isPicked ? '<i class="fas fa-check-circle"></i> Pilihan Anda' : 'Pilih ini';
                    const btnBg = isPicked ? '#10b981' : '#6366f1';

                    return `
                        <div style="border:2px solid ${cardBorder}; background:${cardBg}; border-radius:10px; padding:12px;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
                                <span style="background:${isPicked ? '#10b981' : '#6366f1'}; color:white; width:24px; height:24px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">${labelLetter}</span>
                                <span style="background:#f1f5f9; color:${sesi.color}; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:600;">${sesi.label}</span>
                                <small style="color:#94a3b8;">${n.dateLabel}</small>
                                ${isPicked ? '<span style="background:#10b981; color:white; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:700; margin-left:auto;">✓ DIPILIH</span>' : ''}
                            </div>
                            <p style="margin:0 0 10px; font-style:italic; color:#1e293b; font-size:13px; line-height:1.5;">"${n.quote}"</p>
                            <button onclick="quoteVote.vote('${n.nomineeId}', '${cat.id}')" style="width:100%; background:${btnBg}; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px;">
                                ${btnLabel}
                            </button>
                        </div>
                    `;
                }).join('');
            }

            return `
                <div style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                    <div style="background:${headerBg}; padding:12px 14px; border-bottom:1px solid #e2e8f0;">
                        <h5 style="margin:0; color:${headerColor}; font-size:14px;">
                            <i class="fas ${cat.icon}" style="color:#f59e0b;"></i>
                            ${cat.nama}
                            ${isVoted ? '<i class="fas fa-check-circle" style="color:#10b981; margin-left:6px;"></i>' : ''}
                        </h5>
                    </div>
                    <div style="padding:12px; display:flex; flex-direction:column; gap:10px;">
                        ${nomineeCards}
                    </div>
                </div>
            `;
        }).join('');

        wrap.innerHTML = html;
    },

    async vote(nomineeId, categoryId) {
        const userId = (auth.user && auth.user.id) ? auth.user.id : '';
        if (!userId) return alert("Login dulu");

        const { month, year } = await this.getCurrentPeriod();

        // Optimistic UI: update local state dulu
        const prev = this.myVotes[String(categoryId)];
        this.myVotes[String(categoryId)] = String(nomineeId);
        this.render();

        try {
            const res = await api.post({
                action: 'submitQuoteVote',
                voterUserId: userId,
                nomineeId: nomineeId,
                categoryId: categoryId,
                bulan: month,
                tahun: year
            });
            if (!res || !res.success) {
                // Revert
                if (prev) this.myVotes[String(categoryId)] = prev;
                else delete this.myVotes[String(categoryId)];
                this.render();
                alert("❌ Gagal vote: " + (res.error || "cek koneksi"));
            }
        } catch (e) {
            if (prev) this.myVotes[String(categoryId)] = prev;
            else delete this.myVotes[String(categoryId)];
            this.render();
            alert("❌ Error: " + e.message);
        }
    }
};

window.quoteVote = quoteVote;
