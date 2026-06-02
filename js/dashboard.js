/**
 * Portal Karyawan - Dashboard Personal
 * Status hari ini, kuota cuti, stats periode, streak, chart kehadiran,
 * riwayat gaji, pengajuan terbaru, dan tips.
 */
const dashboard = {
    _chart: null,

    async init() {
        await this.renderAll();
        // Karyawan Live Streamer: sisipkan ringkasan performa live di atas.
        // Kartu khusus absen (status, kuota, stats, streak, chart, gaji) sudah disembunyikan via .streamer-hide.
        // Pengumuman, ulang tahun, quote, & pengajuan tetap tampil dari renderAll.
        if (window.isLiveStreamer && auth.user && window.isLiveStreamer(auth.user) && window.liveStreamer) {
            liveStreamer.renderHome();
        }
    },

    _esc(s) {
        return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _ymd(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    _fmtRp(n) {
        return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
    },

    _renderGreeting() {
        const user = auth.user || {};
        const namaShort = (user.name || user.nama || 'Karyawan').split(' ')[0];
        const hour = new Date().getHours();
        let greeting = 'Selamat Pagi', icon = 'fa-sun', sub = 'Mulai hari dengan semangat 💪';
        if (hour >= 11 && hour < 15) { greeting = 'Selamat Siang'; icon = 'fa-sun'; sub = 'Jangan lupa istirahat ya 🍱'; }
        else if (hour >= 15 && hour < 18) { greeting = 'Selamat Sore'; icon = 'fa-cloud-sun'; sub = 'Tetap fokus sampai pulang 🌅'; }
        else if (hour >= 18) { greeting = 'Selamat Malam'; icon = 'fa-moon'; sub = 'Istirahat yang cukup ya 🌙'; }

        const elG = document.getElementById('emp-greeting');
        const elS = document.getElementById('emp-greeting-sub');
        const elI = document.getElementById('emp-greeting-icon');
        if (elG) elG.innerHTML = `${greeting}, <b>${this._esc(namaShort)}</b>! 👋`;
        if (elS) elS.textContent = sub;
        if (elI) elI.className = `fas ${icon}`;
    },

    async renderAll() {
        this._renderGreeting();

        const user = auth.user || {};
        if (!user.id) {
            console.warn("Dashboard: user belum login");
            return;
        }

        const today = new Date();
        const tahun = today.getFullYear();
        // Bulan kalender berjalan (untuk getMyQuotes)
        const bulanSekarang = today.getMonth() + 1;
        const tahunSekarang = today.getFullYear();

        try {
            const [resAtt, resPengajuan, resQuota, resQuotes, resDetail, resCfg, resPengumuman, resPerf, resAllEmp] = await Promise.all([
                api.post({ action: 'getAllAttendanceData' }),
                api.post({ action: 'getMyPengajuan', userId: user.id }),
                api.post({ action: 'getLeaveQuota', userId: user.id, tahun: tahun }),
                api.post({ action: 'getMyQuotes', userId: user.id, bulan: bulanSekarang, tahun: tahunSekarang }),
                api.post({ action: 'getEmployeeDetail', userId: user.id, limitMonths: 3 }),
                api.post({ action: 'getSettings' }),
                api.post({ action: 'getPengumumanAktif' }),
                api.post({ action: 'getPerformanceReviews', userId: user.id }),
                api.post({ action: 'getEmployees' })
            ]);
            const cfg = (resCfg && resCfg.success) ? (resCfg.data || {}) : {};
            const startDay = parseInt(cfg.periode_start_day || cfg.periodestartday || 26);
            const endDay = startDay - 1;

            // Periode payroll berjalan
            const todayDate = today.getDate();
            let pMonth = today.getMonth() + 1, pYear = tahun;
            if (todayDate >= startDay) { pMonth += 1; if (pMonth > 12) { pMonth = 1; pYear++; } }
            const startPeriod = new Date(pYear, pMonth - 2, startDay, 0, 0, 0);
            const endPeriod = new Date(pYear, pMonth - 1, endDay, 23, 59, 59);

            const allAttendance = (resAtt && resAtt.success) ? (resAtt.data || []) : [];
            const myAttendance = allAttendance.filter(a => String(a.userId) === String(user.id));
            const myPengajuan = (resPengajuan && resPengajuan.success) ? (resPengajuan.data || []) : [];
            const quota = (resQuota && resQuota.success) ? resQuota : { kuota: 7, terpakai: 0, sisa: 7, tahun: tahun };
            const myQuotes = (resQuotes && resQuotes.success) ? (resQuotes.data || []) : [];
            const riwayatGaji = (resDetail && resDetail.success) ? (resDetail.riwayat_gaji || []) : [];
            const pengumuman = (resPengumuman && resPengumuman.success) ? (resPengumuman.data || []) : [];
            const perfReviews = (resPerf && resPerf.success) ? (resPerf.data || []) : [];
            const allEmployees = (resAllEmp && resAllEmp.success) ? (resAllEmp.data || []) : [];
            const myProfile = allEmployees.find(e => String(e.id) === String(user.id));

            this._renderBirthdayBanner(myProfile, today);
            this._renderRekanUltah(allEmployees, user.id, today);
            this._renderPengumumanBanner(pengumuman);
            this._renderStatusToday(myAttendance, today);
            this._renderKuota(quota);
            this._renderStatsPeriode(myAttendance, startPeriod, endPeriod);
            this._renderStreak(myAttendance, today);
            this._renderQuoteCount(myQuotes);
            this._renderPengajuanRecent(myPengajuan);
            this._renderChartTrend(myAttendance, today);
            this._renderRiwayatGaji(riwayatGaji);
            this._renderPerformance(perfReviews);
            this._renderTips(quota);

        } catch (e) {
            console.error('Dashboard error:', e);
        }
    },

    _renderStatusToday(myAttendance, today) {
        const wrap = document.getElementById('emp-status-today');
        const todayYMD = this._ymd(today);
        const todayLogs = myAttendance.filter(a => this._ymd(new Date(a.timestamp)) === todayYMD);

        const findLog = (type) => todayLogs.find(a => a.type === type);
        const masuk = findLog('MASUK');
        const pulang = findLog('PULANG');
        const mLembur = findLog('MULAI_LEMBUR');
        const sLembur = findLog('SELESAI_LEMBUR');

        if (!masuk) {
            wrap.innerHTML = `
                <div style="background:#fef3c7; padding:14px; border-radius:8px; text-align:center; border:1px dashed #fbbf24;">
                    <i class="fas fa-clock" style="font-size:24px; color:#f59e0b;"></i>
                    <div style="font-weight:600; color:#92400e; margin-top:6px; font-size:14px;">Belum absen hari ini</div>
                    <div style="font-size:11px; color:#854d0e; margin-top:2px;">Jangan lupa absen lewat menu <b>Absen</b> di bawah</div>
                </div>`;
            return;
        }

        const tFmt = (ts) => {
            const d = new Date(ts);
            return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        };

        const masukTime = tFmt(masuk.timestamp);
        const isTelat = masuk.statusTelat && masuk.statusTelat !== '0' && masuk.statusTelat !== '-' && parseInt(masuk.statusTelat) > 0;
        const telatMnt = isTelat ? parseInt(masuk.statusTelat) : 0;

        // Durasi kerja
        let durasi = '';
        if (pulang) {
            const ms = new Date(pulang.timestamp) - new Date(masuk.timestamp);
            const jam = Math.floor(ms / 3600000), mnt = Math.floor((ms % 3600000) / 60000);
            durasi = `${jam}j ${mnt}m`;
        } else {
            const ms = new Date() - new Date(masuk.timestamp);
            const jam = Math.floor(ms / 3600000), mnt = Math.floor((ms % 3600000) / 60000);
            durasi = `${jam}j ${mnt}m (berjalan)`;
        }

        let html = `
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">
                <div style="background:#dcfce7; padding:10px; border-radius:8px;">
                    <div style="font-size:10px; color:#166534; font-weight:700;"><i class="fas fa-sign-in-alt"></i> MASUK</div>
                    <div style="font-size:18px; font-weight:700; color:#166534;">${masukTime}</div>
                    ${isTelat ? `<div style="font-size:10px; color:#ef4444; font-weight:600;">⚠️ Telat ${telatMnt} menit</div>` : `<div style="font-size:10px; color:#166534;">✓ Tepat waktu</div>`}
                </div>
                <div style="background:${pulang ? '#dbeafe' : '#f1f5f9'}; padding:10px; border-radius:8px;">
                    <div style="font-size:10px; color:${pulang ? '#1e40af' : '#94a3b8'}; font-weight:700;"><i class="fas fa-sign-out-alt"></i> PULANG</div>
                    <div style="font-size:18px; font-weight:700; color:${pulang ? '#1e40af' : '#94a3b8'};">${pulang ? tFmt(pulang.timestamp) : '—'}</div>
                    <div style="font-size:10px; color:${pulang ? '#1e40af' : '#94a3b8'};">Durasi: ${durasi}</div>
                </div>
            </div>`;

        if (mLembur || sLembur) {
            html += `<div style="background:#ede9fe; padding:10px; border-radius:8px; margin-top:8px;">
                <div style="font-size:10px; color:#5b21b6; font-weight:700;"><i class="fas fa-moon"></i> LEMBUR</div>
                <div style="display:flex; justify-content:space-between; font-size:13px; color:#5b21b6; margin-top:2px;">
                    <span>Mulai: <b>${mLembur ? tFmt(mLembur.timestamp) : '—'}</b></span>
                    <span>Selesai: <b>${sLembur ? tFmt(sLembur.timestamp) : '—'}</b></span>
                </div>
                ${sLembur && sLembur.totalHours ? `<div style="font-size:11px; color:#5b21b6; margin-top:2px;">Total: ${Number(sLembur.totalHours).toFixed(2)} jam</div>` : ''}
            </div>`;
        }

        wrap.innerHTML = html;
    },

    _renderKuota(quota) {
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setText('emp-kuota-tahun', quota.tahun || new Date().getFullYear());
        setText('emp-kuota-sisa', quota.sisa);
        setText('emp-kuota-total', quota.kuota);
        setText('emp-kuota-terpakai', quota.terpakai);
    },

    _renderStatsPeriode(myAttendance, start, end) {
        let hadir = 0, telat = 0, lembur = 0;
        myAttendance.forEach(log => {
            const t = new Date(log.timestamp);
            if (t < start || t > end) return;
            const isRejected = String(log.approvalStatus || '').toUpperCase() === 'REJECTED';
            if (log.type === 'MASUK' && !isRejected) {
                hadir++;
                if (log.statusTelat && log.statusTelat !== '0' && log.statusTelat !== '-') {
                    telat += parseInt(log.statusTelat) || 0;
                }
            }
            if (log.type === 'SELESAI_LEMBUR' && !isRejected) {
                lembur += parseFloat(String(log.totalHours || '0').replace(',', '.'));
            }
        });
        const pct = Math.round((hadir / 25) * 100);
        document.getElementById('emp-stat-hadir').textContent = hadir;
        document.getElementById('emp-stat-hadir-sub').textContent = `${pct}% · target 25`;
        document.getElementById('emp-stat-telat').textContent = telat;
        document.getElementById('emp-stat-lembur').textContent = lembur.toFixed(1);
    },

    _renderStreak(myAttendance, today) {
        // Streak: hari berturut-turut MASUK tanpa telat (mulai dari hari ini ke belakang)
        // Skip hari libur / weekend / tidak ada absen → streak break.
        // Untuk simpel: scan 30 hari ke belakang, count berturut-turut dari hari ini/kemarin yang ada MASUK & tidak telat.
        const masukByDay = {};
        myAttendance.forEach(log => {
            if (log.type !== 'MASUK') return;
            if (String(log.approvalStatus || '').toUpperCase() === 'REJECTED') return;
            const ymd = this._ymd(new Date(log.timestamp));
            const isTelat = log.statusTelat && log.statusTelat !== '0' && log.statusTelat !== '-' && parseInt(log.statusTelat) > 0;
            masukByDay[ymd] = { tepat: !isTelat };
        });

        // Hari ini kalau ada MASUK tanpa telat = +1. Mulai scan kemarin ke belakang, skip weekend.
        const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
        let streak = 0;
        const cursor = new Date(today);
        // Mulai dari hari ini (kalau sudah absen tepat waktu) atau kemarin
        const todayYMD = this._ymd(cursor);
        if (masukByDay[todayYMD] && masukByDay[todayYMD].tepat) streak++;
        // Scan ke belakang max 60 hari (cover weekend skips)
        for (let i = 1; i <= 60 && streak < 60; i++) {
            cursor.setDate(cursor.getDate() - 1);
            if (isWeekend(cursor)) continue; // skip weekend, tidak break
            const ymd = this._ymd(cursor);
            if (masukByDay[ymd] && masukByDay[ymd].tepat) streak++;
            else break;
        }

        document.getElementById('emp-streak').innerHTML = `${streak} <small style="font-size:11px; font-weight:500;">hari</small>`;
        const sub = document.getElementById('emp-streak-sub');
        if (sub) {
            if (streak >= 10) sub.textContent = 'Luar biasa! Pertahankan 🎉';
            else if (streak >= 5) sub.textContent = 'Mantap, terus konsisten!';
            else if (streak >= 1) sub.textContent = 'Lanjutkan! Tepat waktu = hemat denda';
            else sub.textContent = 'Mulai hari ini, bisa! 💪';
        }
    },

    _renderQuoteCount(myQuotes) {
        const cnt = myQuotes.length;
        document.getElementById('emp-quote-count').innerHTML = `${cnt} <small style="font-size:11px; font-weight:500;">quote</small>`;
    },

    _renderPengajuanRecent(myPengajuan) {
        const wrap = document.getElementById('emp-pengajuan-recent');
        if (myPengajuan.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:14px; font-size:13px;">Belum ada pengajuan. Ajukan via menu Cuti/Izin</div>';
            return;
        }
        const top2 = myPengajuan.slice(0, 2);
        wrap.innerHTML = top2.map(p => {
            const st = String(p.status || 'PENDING').toUpperCase();
            const stColor = st === 'APPROVED' ? '#10b981' : st === 'REJECTED' ? '#ef4444' : '#f59e0b';
            const stBg = st === 'APPROVED' ? '#dcfce7' : st === 'REJECTED' ? '#fee2e2' : '#fef3c7';
            const stText = st === 'APPROVED' ? 'Disetujui' : st === 'REJECTED' ? 'Ditolak' : 'Menunggu';
            const icon = p.tipe === 'CUTI' ? 'fa-umbrella-beach' : 'fa-file-medical';
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                    <i class="fas ${icon}" style="color:${p.tipe === 'CUTI' ? '#10b981' : '#3b82f6'};"></i>
                    <div style="min-width:0;">
                        <div style="font-size:13px; font-weight:600; color:#1e293b;">${p.tipe} · ${p.jumlah_hari} hari</div>
                        <div style="font-size:11px; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.tanggal_mulai} → ${p.tanggal_selesai}</div>
                    </div>
                </div>
                <span style="background:${stBg}; color:${stColor}; padding:3px 10px; border-radius:10px; font-size:10px; font-weight:700; white-space:nowrap;">${stText}</span>
            </div>`;
        }).join('');
    },

    _renderChartTrend(myAttendance, today) {
        const canvas = document.getElementById('emp-chart-trend');
        if (!canvas || typeof Chart === 'undefined') return;

        const labels = [], data = [], colors = [];
        const namaHariShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const ymd = this._ymd(d);
            labels.push(`${namaHariShort[d.getDay()]} ${d.getDate()}`);
            const log = myAttendance.find(a => a.type === 'MASUK' && this._ymd(new Date(a.timestamp)) === ymd && String(a.approvalStatus || '').toUpperCase() !== 'REJECTED');
            if (log) {
                const isTelat = log.statusTelat && log.statusTelat !== '0' && log.statusTelat !== '-' && parseInt(log.statusTelat) > 0;
                data.push(isTelat ? parseInt(log.statusTelat) : 1);
                colors.push(isTelat ? '#ef4444' : '#10b981');
            } else {
                data.push(0);
                colors.push('#e2e8f0');
            }
        }

        if (this._chart) this._chart.destroy();
        this._chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Status',
                    data: data,
                    backgroundColor: colors,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const v = ctx.parsed.y;
                                if (v === 0) return 'Tidak absen';
                                if (v === 1) return 'Hadir tepat waktu ✓';
                                return `Hadir, telat ${v} menit`;
                            }
                        }
                    }
                },
                scales: { y: { display: false, beginAtZero: true } }
            }
        });
    },

    _renderRiwayatGaji(riwayatGaji) {
        const wrap = document.getElementById('emp-riwayat-gaji');
        if (!riwayatGaji || riwayatGaji.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:14px; font-size:13px;">Belum ada slip gaji yang dikirim ke kamu</div>';
            return;
        }
        const namaBulan = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        wrap.innerHTML = riwayatGaji.map((r, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; ${i < riwayatGaji.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}">
                <div>
                    <div style="font-size:13px; font-weight:600; color:#1e293b;">${namaBulan[r.bulan] || r.bulan} ${r.tahun}</div>
                    <div style="font-size:10px; color:#94a3b8;">Dikirim: ${r.timestamp_kirim || '—'}</div>
                </div>
                <div style="font-size:14px; font-weight:700; color:#166534;">${this._fmtRp(r.total_gaji)}</div>
            </div>
        `).join('');
    },

    _hitungUmur(tglLahir, refDate) {
        if (!tglLahir) return null;
        const d = new Date(tglLahir);
        if (isNaN(d)) return null;
        const ref = refDate || new Date();
        let umur = ref.getFullYear() - d.getFullYear();
        if (ref.getMonth() < d.getMonth() ||
            (ref.getMonth() === d.getMonth() && ref.getDate() < d.getDate())) {
            umur--;
        }
        return Math.max(0, umur);
    },

    _renderBirthdayBanner(profile, today) {
        const wrap = document.getElementById('emp-birthday-banner');
        if (!wrap) return;
        if (!profile || !profile.tanggal_lahir) { wrap.style.display = 'none'; return; }
        const d = new Date(profile.tanggal_lahir);
        if (isNaN(d) || d.getMonth() !== today.getMonth() || d.getDate() !== today.getDate()) {
            wrap.style.display = 'none';
            return;
        }
        const umur = this._hitungUmur(profile.tanggal_lahir, today);
        wrap.style.display = 'block';
        wrap.innerHTML = `<div style="background:linear-gradient(135deg,#fbbf24,#f59e0b,#d97706); color:white; padding:18px 22px; border-radius:14px; text-align:center; box-shadow:0 6px 16px rgba(245,158,11,0.3);">
            <div style="font-size:36px; margin-bottom:6px;">🎂🎉🎊</div>
            <div style="font-size:18px; font-weight:800; margin-bottom:4px;">Selamat Ulang Tahun, ${this._esc(profile.name)}!</div>
            ${umur !== null ? `<div style="font-size:14px; font-weight:600; opacity:0.95;">Selamat menempuh usia ke-${umur} 🥳</div>` : ''}
            <div style="font-size:12px; opacity:0.9; margin-top:8px; line-height:1.5;">Semoga panjang umur, sehat selalu, dan dilancarkan rezekinya. Tetap semangat berkarya untuk PT. Bisatani! 🌟</div>
        </div>`;
    },

    _renderRekanUltah(allEmployees, currentUserId, today) {
        const card = document.getElementById('emp-rekan-ultah-card');
        const content = document.getElementById('emp-rekan-ultah-content');
        if (!card || !content) return;

        const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();

        const rekan = (allEmployees || [])
            .filter(e => String(e.id) !== String(currentUserId)) // exclude diri sendiri
            .filter(e => !['admin', 'superadmin'].includes(String(e.role || '').toLowerCase())) // skip admin & superadmin
            .filter(e => e.tanggal_lahir)
            .map(e => {
                const d = new Date(e.tanggal_lahir);
                if (isNaN(d) || d.getMonth() !== todayMonth) return null;
                return { name: e.name, tgl: d.getDate(), isToday: d.getDate() === todayDate };
            })
            .filter(Boolean)
            .sort((a, b) => a.tgl - b.tgl);

        if (rekan.length === 0) {
            card.style.display = 'none';
            return;
        }
        card.style.display = 'block';

        const todayRekan = rekan.filter(r => r.isToday);
        let html = '';
        if (todayRekan.length > 0) {
            html += `<div style="background:linear-gradient(135deg,#fef3c7,#fde68a); padding:10px 12px; border-radius:8px; margin-bottom:8px; color:#92400e;">
                <div style="font-size:12px; font-weight:700;">🎂 Hari ini ulang tahun:</div>
                <div style="font-size:13px; margin-top:2px;">${todayRekan.map(r => this._esc(r.name)).join(', ')}</div>
                <div style="font-size:11px; opacity:0.8; margin-top:4px;">Yuk kirim ucapan! 💌</div>
            </div>`;
        }

        const lainnya = rekan.filter(r => !r.isToday);
        if (lainnya.length > 0) {
            html += lainnya.map(r => {
                const isPast = r.tgl < todayDate;
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:${isPast ? '#f8fafc' : '#fffbeb'}; border-radius:6px; margin-bottom:4px; ${isPast ? 'opacity:0.6;' : ''} font-size:12px;">
                    <span style="color:#1e293b; font-weight:500;">${this._esc(r.name)}</span>
                    <span style="background:${isPast ? '#cbd5e1' : '#f59e0b'}; color:white; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:700;">${r.tgl} ${namaBulan[todayMonth]}</span>
                </div>`;
            }).join('');
        }
        content.innerHTML = html;
    },

    _renderPengumumanBanner(items) {
        const wrap = document.getElementById('emp-pengumuman-banner');
        if (!wrap) return;
        if (!items || items.length === 0) {
            wrap.style.display = 'none';
            wrap.innerHTML = '';
            return;
        }
        const prioStyle = {
            'tinggi': { bg: 'linear-gradient(135deg,#fee2e2,#fecaca)', border: '#ef4444', color: '#991b1b', icon: 'fa-exclamation-circle' },
            'sedang': { bg: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '#f59e0b', color: '#92400e', icon: 'fa-exclamation-triangle' },
            'normal': { bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)', border: '#3b82f6', color: '#1e40af', icon: 'fa-bullhorn' },
            'rendah': { bg: '#f8fafc', border: '#94a3b8', color: '#475569', icon: 'fa-info-circle' }
        };
        wrap.style.display = 'block';
        wrap.innerHTML = items.slice(0, 3).map(p => {
            const ps = prioStyle[p.prioritas] || prioStyle.normal;
            return `<div style="background:${ps.bg}; border-left:4px solid ${ps.border}; padding:12px 14px; border-radius:10px; margin-bottom:8px; color:${ps.color};">
                <div style="display:flex; align-items:flex-start; gap:10px;">
                    <i class="fas ${ps.icon}" style="font-size:18px; margin-top:2px;"></i>
                    <div style="flex:1;">
                        <div style="font-weight:700; font-size:13px;">${this._esc(p.judul)}</div>
                        <div style="font-size:12px; margin-top:2px; white-space:pre-wrap;">${this._esc(p.isi)}</div>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    _renderPerformance(reviews) {
        const card = document.getElementById('emp-perf-card');
        const content = document.getElementById('emp-perf-content');
        if (!card || !content) return;
        if (!reviews || reviews.length === 0) {
            card.style.display = 'none';
            return;
        }
        card.style.display = 'block';
        const latest = reviews[0];
        const scoreColor = (s) => {
            const n = Number(s) || 0;
            if (n >= 4) return '#10b981';
            if (n >= 3) return '#3b82f6';
            if (n >= 2) return '#f59e0b';
            return '#ef4444';
        };
        const stars = (s) => {
            const n = Math.round(Number(s) || 0);
            return '★'.repeat(n) + '☆'.repeat(5 - n);
        };
        const categories = [
            { key: 'kehadiran', label: 'Kehadiran', icon: 'fa-clock' },
            { key: 'produktivitas', label: 'Produktivitas', icon: 'fa-tasks' },
            { key: 'attitude', label: 'Attitude', icon: 'fa-smile' },
            { key: 'kpi', label: 'KPI', icon: 'fa-bullseye' }
        ];
        content.innerHTML = `
            <div style="background:linear-gradient(135deg,#ede9fe,#ddd6fe); padding:12px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:11px; color:#5b21b6; font-weight:600;">Q${latest.quarter} ${latest.tahun} (terbaru)</div>
                    <div style="font-size:22px; font-weight:800; color:${scoreColor(latest.total)};">${Number(latest.total).toFixed(2)}<small style="font-size:13px; color:#5b21b6;">/5</small></div>
                    <div style="font-size:16px; color:#fbbf24; letter-spacing:3px;">${stars(latest.total)}</div>
                </div>
                <div style="text-align:right; font-size:10px; color:#5b21b6;">${reviews.length} review${reviews.length > 1 ? 's' : ''}</div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:10px;">
                ${categories.map(cat => `<div style="background:#f8fafc; padding:6px 4px; border-radius:6px; text-align:center;">
                    <i class="fas ${cat.icon}" style="color:#7c3aed; font-size:12px;"></i>
                    <div style="font-size:9px; color:#64748b; margin-top:2px;">${cat.label}</div>
                    <div style="font-size:13px; font-weight:700; color:${scoreColor(latest[cat.key])};">${latest[cat.key]}/5</div>
                </div>`).join('')}
            </div>
            ${latest.catatan ? `<div style="background:#fffbeb; padding:8px 10px; border-radius:6px; border-left:3px solid #f59e0b; font-size:12px; color:#475569;"><b>Catatan dari admin:</b> ${this._esc(latest.catatan)}</div>` : ''}
        `;
    },

    _renderTips(quota) {
        const tips = [];
        if (quota.sisa <= 2 && quota.sisa > 0) {
            tips.push(`Sisa cuti tahun ini tinggal <b>${quota.sisa} hari</b>. Atur dari sekarang ya!`);
        }
        const hour = new Date().getHours();
        if (hour < 9) {
            tips.push('Jam masuk standar: <b>08:00</b>. Absen sebelum itu untuk hindari denda telat.');
        }
        tips.push('Lembur dihitung dari jam yang ditentukan oleh admin (default 17:00). Jangan lupa absen <b>SELESAI_LEMBUR</b> agar terhitung.');
        tips.push('Tulis quote saat MASUK & PULANG — bisa ikut <b>voting bulanan</b>!');

        const el = document.getElementById('emp-tips');
        if (el) el.innerHTML = '• ' + tips.join('<br>• ');
    }
};

window.dashboard = dashboard;
