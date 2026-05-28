/**
 * Portal Karyawan - Quote Saya
 * Menampilkan quote yang ditulis karyawan saat absen masuk
 * dalam periode payroll (26 bulan lalu → 25 bulan ini)
 */
const quoteSaya = {
    _initialized: false,

    init() {
        // Set default ke periode payroll yang sedang berjalan
        const today = new Date();
        const todayDate = today.getDate();
        let month = today.getMonth() + 1; // 1-12
        let year = today.getFullYear();

        // Periode payroll: kalau hari ini >= 26, periode mulai dari 26 bulan ini
        // (anchor = bulan depan, karena periode 26 bulan-1 -> 25 bulan)
        if (todayDate >= 26) {
            month += 1;
            if (month > 12) { month = 1; year++; }
        }

        const monthEl = document.getElementById('quote-saya-month');
        const yearEl = document.getElementById('quote-saya-year');
        if (monthEl) monthEl.value = String(month);
        if (yearEl) yearEl.value = String(year);

        // Auto-load
        this.load();
        this._initialized = true;
    },

    async load() {
        const list = document.getElementById('quote-saya-list');
        const periodLabel = document.getElementById('quote-saya-period');
        if (!list) return;

        list.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat quote...</div>';

        const month = document.getElementById('quote-saya-month').value;
        const year = document.getElementById('quote-saya-year').value;
        const userId = (auth.user && auth.user.id) ? auth.user.id : '';

        if (!userId) {
            list.innerHTML = '<div style="text-align:center; color:#ef4444; padding:30px;">User tidak terdeteksi, login ulang.</div>';
            return;
        }

        try {
            const res = await api.post({
                action: 'getMyQuotes',
                userId: userId,
                bulan: month,
                tahun: year
            });

            if (periodLabel) periodLabel.textContent = (res && res.period) || '—';

            if (!res || !res.success) {
                list.innerHTML = `<div style="text-align:center; color:#ef4444; padding:30px;">Gagal memuat: ${(res && res.error) || 'cek koneksi'}</div>`;
                return;
            }

            const quotes = res.data || [];
            if (quotes.length === 0) {
                list.innerHTML = `
                    <div style="text-align:center; color:#94a3b8; padding:40px 20px; background:#f8fafc; border-radius:10px;">
                        <i class="fas fa-quote-left" style="font-size:2rem; color:#cbd5e1; margin-bottom:10px;"></i>
                        <p style="margin:0; font-weight:600;">Belum ada quote di periode ini</p>
                        <p style="margin:8px 0 0; font-size:13px;">Tulis pesan saat absen masuk untuk muncul di sini ✨</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = quotes.map((q, i) => {
                // First quote = highlight (terbaru)
                const isLatest = i === 0;
                const isPagi = (q.type === 'MASUK');
                const sesi = isPagi
                    ? { label: 'PAGI', icon: 'fa-sun', color: '#f59e0b', bg: '#fef3c7' }
                    : { label: 'SORE', icon: 'fa-moon', color: '#6366f1', bg: '#e0e7ff' };
                const borderColor = isLatest ? '#10b981' : '#e2e8f0';
                const latestBadge = isLatest ? '<span style="background:#10b981; color:white; font-size:10px; padding:2px 8px; border-radius:10px; margin-left:6px;">TERBARU</span>' : '';
                const sesiBadge = `<span style="background:${sesi.bg}; color:${sesi.color}; font-size:10px; padding:2px 8px; border-radius:10px; font-weight:700;"><i class="fas ${sesi.icon}"></i> ${sesi.label}</span>`;
                return `
                    <div style="border:1px solid ${borderColor}; border-left:4px solid ${borderColor}; background:#fff; border-radius:10px; padding:14px 16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                            <small style="color:#64748b; font-weight:600;"><i class="far fa-calendar"></i> ${q.dateLabel} · ${q.timeLabel}</small>
                            <div>${sesiBadge}${latestBadge}</div>
                        </div>
                        <p style="margin:0; color:#1e293b; font-style:italic; line-height:1.5; font-size:14px;">
                            <i class="fas fa-quote-left" style="color:#cbd5e1; margin-right:6px;"></i>${q.quote}<i class="fas fa-quote-right" style="color:#cbd5e1; margin-left:6px;"></i>
                        </p>
                    </div>
                `;
            }).join('') + `
                <div style="text-align:center; margin-top:10px; color:#94a3b8; font-size:12px;">
                    <i class="fas fa-info-circle"></i> Total ${quotes.length} quote di periode ini
                </div>
            `;
        } catch (e) {
            console.error("Quote load error:", e);
            list.innerHTML = `<div style="text-align:center; color:#ef4444; padding:30px;">Error: ${e.message}</div>`;
        }
    }
};

window.quoteSaya = quoteSaya;
