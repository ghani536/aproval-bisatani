/**
 * Portal Admin - Dashboard PT. BISATANI
 * All-in dashboard: stats, status hari ini, charts, leaderboard, smart alerts.
 * Reuse logic kalkulasi payroll untuk estimasi akurat (tunjangan + potongan izin).
 */
const adminDashboard = {
    _charts: {}, // {trend: ChartInstance, lembur: ChartInstance}

    init() {
        console.log("AdminDashboard: Mengambil data statistik...");
        this.renderAll();
    },

    _fmtRp(n) {
        return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
    },

    _esc(s) {
        return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _ymd(d) {
        // YYYY-MM-DD di local timezone
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    _parseYMD(s) {
        if (!s) return null;
        const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return null;
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    },

    async renderAll() {
        try {
            // Date label
            const today = new Date();
            const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const dateLabel = document.getElementById('dash-date-label');
            if (dateLabel) dateLabel.textContent = `${namaHari[today.getDay()]}, ${today.getDate()} ${namaBulan[today.getMonth()]} ${today.getFullYear()}`;

            // Ambil settings dulu untuk dapat periode_start_day
            const anomStart = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
            const anomEnd = today.toISOString().slice(0, 10);
            const [resEmp, resAtt, resCfg, resPengajuan, resHolidays, resAnomali] = await Promise.all([
                api.post({ action: 'getEmployees' }),
                api.post({ action: 'getAllAttendanceData' }),
                api.post({ action: 'getSettings' }),
                api.post({ action: 'getAllPengajuan' }),
                api.post({ action: 'getHolidays', tahun: String(today.getFullYear()) }),
                api.post({ action: 'getAnomaliReport', start: anomStart, end: anomEnd })
            ]);
            const cfgEarly = (resCfg && resCfg.success) ? (resCfg.data || {}) : {};
            const startDay = parseInt(cfgEarly.periode_start_day || cfgEarly.periodestartday || 26);
            const endDay = startDay - 1;

            // Periode payroll berjalan
            const todayDate = today.getDate();
            let pMonth = today.getMonth() + 1, pYear = today.getFullYear();
            if (todayDate >= startDay) { pMonth += 1; if (pMonth > 12) { pMonth = 1; pYear++; } }
            const startPeriod = new Date(pYear, pMonth - 2, startDay, 0, 0, 0);
            const endPeriod = new Date(pYear, pMonth - 1, endDay, 23, 59, 59);
            const bulanNamaPeriode = namaBulan[pMonth - 1];

            // Untuk alert "slip belum dikirim", fetch periode yang label = bulan ini
            // (= periode yang baru berakhir kalau today >= startDay, atau current period
            // kalau today < startDay). Beda dengan bulanNamaPeriode yang shift ke bulan depan.
            const alertPeriodMonth = today.getMonth() + 1;
            const alertPeriodLabel = namaBulan[alertPeriodMonth - 1];
            const alertPeriodYear = today.getFullYear();
            const resPayrollSent = await api.post({ action: 'getPayrollSentLog', bulan: alertPeriodLabel, tahun: String(alertPeriodYear) });

            // Skip akun admin & superadmin dari semua counter & report
            const employees = ((resEmp && resEmp.success) ? (resEmp.data || []) : []).filter(e => !['admin', 'superadmin'].includes(String(e.role || '').toLowerCase()) && !(window.isLiveStreamer && window.isLiveStreamer(e)));
            const attendance = (resAtt && resAtt.success) ? (resAtt.data || []) : [];
            const config = cfgEarly;
            const pengajuan = (resPengajuan && resPengajuan.success) ? (resPengajuan.data || []) : [];
            const holidays = (resHolidays && resHolidays.success) ? (resHolidays.data || []) : [];
            const sentMap = {};
            if (resPayrollSent && resPayrollSent.success && Array.isArray(resPayrollSent.data)) {
                resPayrollSent.data.forEach(s => { sentMap[String(s.userId)] = s; });
            }

            // Cek hari libur / weekend hari ini (today antara tanggal_mulai-selesai)
            const todayYMD = this._ymd(today);
            const todayHoliday = holidays.find(h => {
                const start = h.tanggal_mulai || h.tanggal;
                const end = h.tanggal_selesai || start;
                return start && todayYMD >= start && todayYMD <= end;
            });
            const isWeekend = (today.getDay() === 0 || today.getDay() === 6);
            const isOffDay = !!todayHoliday || isWeekend;

            this._renderHolidayBanner(todayHoliday, isWeekend);
            this._render6Stats(employees, attendance, pengajuan, config, startPeriod, endPeriod, isOffDay);
            this._renderStatusHariIni(employees, attendance, pengajuan, today, isOffDay);
            this._renderAktivitasTerbaru(attendance);
            this._renderChartTrend(attendance, today);
            this._renderChartLembur(employees, attendance, startPeriod, endPeriod);
            this._renderLeaderboards(employees, attendance, config, startPeriod, endPeriod);
            this._renderUlangTahun(employees, today);
            this._renderAnomali(resAnomali);
            this._renderAlerts(employees, pengajuan, sentMap, today, { startDay, bulanNamaPeriode, pYear, namaBulan });

        } catch (e) {
            console.error("Dashboard Error:", e);
        }
    },

    // Hitung total gaji 1 karyawan untuk periode (mirror payroll.calculateSingleEmployee)
    _calcGaji(emp, attendance, config, pengajuan, start, end) {
        const tarifLembur = parseInt(config.overtime_rate || 10000);
        const gajiPokok = parseFloat(emp.gaji_pokok || 0);
        const tarifPerJam = parseFloat(emp.tarif_per_jam || 0);
        const isPerJam = (emp.jenis_gaji === 'per_jam');
        const hariKerjaPerBulan = parseInt(config.hari_kerja_per_bulan || 25);
        const jamKerjaPerHari = parseFloat(config.jam_kerja_per_hari || 8);
        const aktifkanPotongan = String(config.aktifkan_potongan_pulang_cepat || 'true') === 'true';
        let dendaPerMenit = parseFloat(emp.dendatelat || 0);
        if (dendaPerMenit <= 0 && gajiPokok > 0) dendaPerMenit = Math.round(gajiPokok / hariKerjaPerBulan / jamKerjaPerHari / 60);

        // Group log by hari untuk hitung durasi (untuk potongan pulang cepat)
        const userLogs = attendance.filter(log => {
            if (String(log.userId) !== String(emp.id)) return false;
            const t = new Date(log.timestamp);
            return t >= start && t <= end;
        });

        let hadirCount = 0, totalMenitTelat = 0, jamLemburTotal = 0;
        const byDay = {};
        userLogs.forEach(log => {
            const isRejected = String(log.approvalStatus || '').toUpperCase() === 'REJECTED';
            const t = new Date(log.timestamp);
            const ymd = this._ymd(t);
            if (log.type === 'MASUK') {
                if (isRejected) return;
                hadirCount++;
                if (log.statusTelat && log.statusTelat !== "0" && log.statusTelat !== "-") {
                    totalMenitTelat += parseInt(log.statusTelat) || 0;
                }
                if (!byDay[ymd]) byDay[ymd] = {};
                byDay[ymd].masuk = t;
            }
            if (log.type === 'PULANG') {
                if (isRejected) return;
                if (!byDay[ymd]) byDay[ymd] = {};
                byDay[ymd].pulang = t;
            }
            if (log.type === 'SELESAI_LEMBUR') {
                if (isRejected) return;
                jamLemburTotal += parseFloat(String(log.totalHours || "0").replace(',', '.'));
            }
        });

        const bpjs = parseInt(emp.bpjs || 0);
        const bonusLembur = Math.round(jamLemburTotal * tarifLembur);
        const nominalDenda = Math.round(totalMenitTelat * dendaPerMenit);
        const tunjBensinFull = parseFloat(emp.tunjangan_bensin || 0);
        const tunjKost = parseFloat(emp.tunjangan_kost || 0);
        const hadirCapped = Math.min(hadirCount, hariKerjaPerBulan);
        const tunjBensinTerbayar = Math.round(tunjBensinFull * hadirCapped / hariKerjaPerBulan);

        const gajiHarian = hariKerjaPerBulan > 0 ? (gajiPokok / hariKerjaPerBulan) : 0;

        // Hari Izin APPROVED dalam periode
        let hariIzin = 0;
        pengajuan.forEach(p => {
            if (String(p.userId) !== String(emp.id)) return;
            if (String(p.status || '').toUpperCase() !== 'APPROVED') return;
            if (String(p.tipe || '').toUpperCase() !== 'IZIN') return;
            const rs = this._parseYMD(p.tanggal_mulai);
            const re = this._parseYMD(p.tanggal_selesai);
            if (!rs || !re) return;
            const pStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const pEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
            const s2 = rs > pStart ? rs : pStart;
            const e2 = re < pEnd ? re : pEnd;
            if (e2 < s2) return;
            hariIzin += Math.floor((e2 - s2) / 86400000) + 1;
        });
        const potonganIzin = isPerJam ? 0 : Math.round(gajiHarian * hariIzin);

        // Potongan pulang cepat proporsional
        let potonganPulangCepat = 0;
        if (!isPerJam && aktifkanPotongan) {
            Object.keys(byDay).forEach(ymd => {
                const m = byDay[ymd].masuk, p2 = byDay[ymd].pulang;
                if (!m || !p2) return;
                const durasi = (p2 - m) / 3600000;
                if (durasi < jamKerjaPerHari - 0.0833) {
                    const faktorKurang = Math.max(0, (jamKerjaPerHari - durasi) / jamKerjaPerHari);
                    potonganPulangCepat += Math.round(gajiHarian * faktorKurang);
                }
            });
        }

        // Potongan mangkir (hanya bulanan)
        let potonganMangkir = 0;
        if (!isPerJam) {
            const hariMangkir = Math.max(0, hariKerjaPerBulan - hadirCount - hariIzin); // dashboard skip hariCuti detail
            potonganMangkir = Math.round(gajiHarian * hariMangkir);
        }

        let totalGaji;
        if (isPerJam) {
            const jamKerjaTotal = (hadirCount * jamKerjaPerHari) + jamLemburTotal;
            const basisGaji = Math.round(jamKerjaTotal * tarifPerJam);
            totalGaji = basisGaji - bpjs + tunjBensinTerbayar + tunjKost;
        } else {
            totalGaji = (gajiPokok + bonusLembur + tunjBensinTerbayar + tunjKost) - (bpjs + nominalDenda + potonganIzin + potonganPulangCepat + potonganMangkir);
        }
        return { totalGaji, hadirCount, jamLemburTotal, totalMenitTelat };
    },

    _renderHolidayBanner(todayHoliday, isWeekend) {
        // Inject banner di atas stat cards kalau ada
        const dateLabel = document.getElementById('dash-date-label');
        if (!dateLabel) return;
        const parent = dateLabel.closest('div[style*="gradient"]');
        if (!parent) return;
        // Remove existing banner
        const existing = document.getElementById('dash-holiday-banner');
        if (existing) existing.remove();
        if (!todayHoliday && !isWeekend) return;
        const banner = document.createElement('div');
        banner.id = 'dash-holiday-banner';
        banner.style.cssText = 'background:linear-gradient(135deg,#fef3c7,#fde68a); color:#92400e; padding:12px 16px; border-radius:10px; margin-bottom:16px; display:flex; align-items:center; gap:10px; border-left:4px solid #f59e0b;';
        let holidayLabel = '';
        if (todayHoliday) {
            const mulai = todayHoliday.tanggal_mulai || todayHoliday.tanggal;
            const selesai = todayHoliday.tanggal_selesai || mulai;
            const hari = todayHoliday.jumlah_hari || 1;
            holidayLabel = hari > 1
                ? `<small style="opacity:0.8;">Periode: ${mulai} → ${selesai} (${hari} hari) · Karyawan tidak wajib absen</small>`
                : `<small style="opacity:0.8;">Karyawan tidak wajib absen hari ini</small>`;
        }
        banner.innerHTML = todayHoliday
            ? `<i class="fas fa-calendar-day" style="font-size:20px;"></i><div><b>Hari ini libur:</b> ${this._esc(todayHoliday.nama_libur)}<br>${holidayLabel}</div>`
            : `<i class="fas fa-couch" style="font-size:20px;"></i><div><b>Weekend</b><br><small style="opacity:0.8;">Karyawan tidak wajib absen hari ini</small></div>`;
        parent.parentNode.insertBefore(banner, parent.nextSibling);
    },

    _render6Stats(employees, attendance, pengajuan, config, startPeriod, endPeriod, isOffDay) {
        document.getElementById('dash-total-emp').textContent = employees.length;

        // Hadir hari ini (MASUK dengan status not rejected, tanggal = today)
        const todayYMD = this._ymd(new Date());
        const hadirIds = new Set();
        attendance.forEach(a => {
            if (a.type !== 'MASUK') return;
            if (String(a.approvalStatus || '').toUpperCase() === 'REJECTED') return;
            const ymd = this._ymd(new Date(a.timestamp));
            if (ymd === todayYMD) hadirIds.add(String(a.userId));
        });
        const hadirCount = hadirIds.size;
        document.getElementById('dash-total-presence').textContent = hadirCount;
        const pct = employees.length > 0 ? Math.round((hadirCount / employees.length) * 100) : 0;
        document.getElementById('dash-presence-pct').textContent = `${hadirCount}/${employees.length} · ${pct}%`;

        // Karyawan cuti/izin hari ini
        const cutiIzinTodayIds = new Set();
        pengajuan.forEach(p => {
            if (String(p.status || '').toUpperCase() !== 'APPROVED') return;
            const rs = this._parseYMD(p.tanggal_mulai);
            const re = this._parseYMD(p.tanggal_selesai);
            if (!rs || !re) return;
            const todayDate = new Date();
            const tToday = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
            if (tToday >= rs && tToday <= re) cutiIzinTodayIds.add(String(p.userId));
        });

        // Belum absen: total - hadir - cuti/izin. Kalau off-day, set 0
        const belumAbsen = isOffDay ? 0 : Math.max(0, employees.length - hadirCount - cutiIzinTodayIds.size);
        document.getElementById('dash-belum-absen').textContent = belumAbsen;

        // Pengajuan pending
        const pendingCount = pengajuan.filter(p => String(p.status || '').toUpperCase() === 'PENDING').length;
        document.getElementById('dash-pengajuan-pending').textContent = pendingCount;

        // Total lembur periode + Estimasi payroll
        let totalLembur = 0, totalPayroll = 0;
        employees.forEach(emp => {
            const r = this._calcGaji(emp, attendance, config, pengajuan, startPeriod, endPeriod);
            totalLembur += r.jamLemburTotal;
            totalPayroll += r.totalGaji;
        });
        document.getElementById('dash-total-overtime').innerHTML = totalLembur.toFixed(1) + ' <small style="font-size:13px; color:#64748b;">jam</small>';
        document.getElementById('dash-total-payroll').textContent = this._fmtRp(totalPayroll);
    },

    _renderStatusHariIni(employees, attendance, pengajuan, today, isOffDay) {
        const wrap = document.getElementById('dash-status-today');
        const todayYMD = this._ymd(today);
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (isOffDay && employees.length > 0) {
            // Tampilkan info hari libur dengan opsi expand
            const grouped = { hadir: [] };
            attendance.forEach(a => {
                if (a.type !== 'MASUK') return;
                if (String(a.approvalStatus || '').toUpperCase() === 'REJECTED') return;
                if (this._ymd(new Date(a.timestamp)) === todayYMD) {
                    const emp = employees.find(e => String(e.id) === String(a.userId));
                    if (emp && !grouped.hadir.find(x => String(x.id) === String(emp.id))) grouped.hadir.push(emp);
                }
            });
            const namesHadir = grouped.hadir.slice(0, 6).map(e => `<a href="#" onclick="event.preventDefault(); adminEmployees && adminEmployees.showDetail && adminEmployees.showDetail('${String(e.id).replace(/'/g, "\\'")}')" style="color:inherit; text-decoration:none; background:#dcfce7; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">${this._esc(e.name)}</a>`).join(' ');
            wrap.innerHTML = `
                <div style="background:#fef3c7; padding:14px; border-radius:8px; text-align:center; border:1px dashed #fbbf24; margin-bottom:8px;">
                    <i class="fas fa-bed" style="font-size:28px; color:#f59e0b;"></i>
                    <div style="font-weight:600; color:#92400e; margin-top:6px; font-size:14px;">Hari libur — tidak ada wajib absen</div>
                    <div style="font-size:11px; color:#854d0e; margin-top:2px;">${grouped.hadir.length > 0 ? `${grouped.hadir.length} karyawan tetap absen (lembur?)` : 'Tidak ada karyawan yang absen'}</div>
                </div>
                ${grouped.hadir.length > 0 ? `<div style="padding:8px 0;"><div style="font-size:11px; color:#10b981; font-weight:700; margin-bottom:4px;"><i class="fas fa-check-circle"></i> Yang Absen Hari Ini (${grouped.hadir.length})</div><div>${namesHadir}${grouped.hadir.length > 6 ? `<span style="color:#94a3b8; font-size:11px;"> +${grouped.hadir.length - 6}</span>` : ''}</div></div>` : ''}
            `;
            return;
        }

        // Map userId → status hari ini
        const hadirIds = new Set();
        attendance.forEach(a => {
            if (a.type !== 'MASUK') return;
            if (String(a.approvalStatus || '').toUpperCase() === 'REJECTED') return;
            if (this._ymd(new Date(a.timestamp)) === todayYMD) hadirIds.add(String(a.userId));
        });
        const cutiIzinMap = {};
        pengajuan.forEach(p => {
            if (String(p.status || '').toUpperCase() !== 'APPROVED') return;
            const rs = this._parseYMD(p.tanggal_mulai);
            const re = this._parseYMD(p.tanggal_selesai);
            if (!rs || !re) return;
            if (todayDateOnly >= rs && todayDateOnly <= re) {
                cutiIzinMap[String(p.userId)] = p.tipe;
            }
        });

        const grouped = { hadir: [], cuti: [], izin: [], belum: [] };
        employees.forEach(emp => {
            const id = String(emp.id);
            if (hadirIds.has(id)) grouped.hadir.push(emp);
            else if (cutiIzinMap[id] === 'CUTI') grouped.cuti.push(emp);
            else if (cutiIzinMap[id] === 'IZIN') grouped.izin.push(emp);
            else grouped.belum.push(emp);
        });

        const renderRow = (list, color, bg, icon, label) => {
            if (list.length === 0) return '';
            const names = list.slice(0, 6).map(e => `<a href="#" onclick="event.preventDefault(); adminEmployees && adminEmployees.showDetail && adminEmployees.showDetail('${String(e.id).replace(/'/g, "\\'")}')" style="color:inherit; text-decoration:none; background:${bg}; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">${this._esc(e.name)}</a>`).join(' ');
            const more = list.length > 6 ? `<span style="color:#94a3b8; font-size:11px;"> +${list.length - 6} lainnya</span>` : '';
            return `<div style="padding:8px 0; border-bottom:1px solid #f1f5f9;">
                <div style="font-size:11px; color:${color}; font-weight:700; margin-bottom:4px;"><i class="fas ${icon}"></i> ${label} (${list.length})</div>
                <div>${names}${more}</div>
            </div>`;
        };

        wrap.innerHTML =
            renderRow(grouped.hadir, '#10b981', '#dcfce7', 'fa-check-circle', 'Sudah Absen') +
            renderRow(grouped.cuti, '#0891b2', '#cffafe', 'fa-umbrella-beach', 'Cuti') +
            renderRow(grouped.izin, '#3b82f6', '#dbeafe', 'fa-file-medical', 'Izin') +
            renderRow(grouped.belum, '#ef4444', '#fee2e2', 'fa-user-slash', 'Belum Absen');

        if (employees.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">Belum ada data karyawan</div>';
        }
    },

    _renderAktivitasTerbaru(attendance) {
        const wrap = document.getElementById('dash-recent-list');
        if (!attendance || attendance.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:13px;">Belum ada aktivitas absensi</div>';
            return;
        }
        const sorted = [...attendance].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);
        const tipeBadge = {
            'MASUK': { color: '#10b981', bg: '#dcfce7', label: 'MASUK', icon: 'fa-sign-in-alt' },
            'PULANG': { color: '#3b82f6', bg: '#dbeafe', label: 'PULANG', icon: 'fa-sign-out-alt' },
            'MULAI_LEMBUR': { color: '#6366f1', bg: '#e0e7ff', label: 'M.LEMBUR', icon: 'fa-moon' },
            'SELESAI_LEMBUR': { color: '#7c3aed', bg: '#ede9fe', label: 'S.LEMBUR', icon: 'fa-moon' }
        };
        wrap.innerHTML = sorted.map(r => {
            const tb = tipeBadge[r.type] || { color: '#64748b', bg: '#f1f5f9', label: r.type, icon: 'fa-circle' };
            const ts = new Date(r.timestamp);
            const time = ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const date = this._ymd(ts) === this._ymd(new Date()) ? 'Hari ini' : ts.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            return `<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9; gap:8px;">
                <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                    <span style="background:${tb.bg}; color:${tb.color}; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700; white-space:nowrap;"><i class="fas ${tb.icon}"></i> ${tb.label}</span>
                    <span style="font-size:13px; color:#1e293b; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this._esc(r.userName || r.userId)}</span>
                </div>
                <div style="font-size:11px; color:#94a3b8; white-space:nowrap;">${date} · ${time}</div>
            </div>`;
        }).join('');
    },

    _renderChartTrend(attendance, today) {
        const canvas = document.getElementById('dash-chart-trend');
        if (!canvas || typeof Chart === 'undefined') return;

        const labels = [], data = [];
        const namaHariShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const ymd = this._ymd(d);
            labels.push(`${namaHariShort[d.getDay()]} ${d.getDate()}`);
            const count = new Set(attendance.filter(a =>
                a.type === 'MASUK' &&
                String(a.approvalStatus || '').toUpperCase() !== 'REJECTED' &&
                this._ymd(new Date(a.timestamp)) === ymd
            ).map(a => String(a.userId))).size;
            data.push(count);
        }

        if (this._charts.trend) this._charts.trend.destroy();
        this._charts.trend = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Karyawan Hadir',
                    data: data,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
                }
            }
        });
    },

    _renderChartLembur(employees, attendance, startPeriod, endPeriod) {
        const canvas = document.getElementById('dash-chart-lembur');
        if (!canvas || typeof Chart === 'undefined') return;

        const lemburMap = employees.map(emp => {
            let total = 0;
            attendance.forEach(log => {
                if (String(log.userId) !== String(emp.id)) return;
                if (log.type !== 'SELESAI_LEMBUR') return;
                if (String(log.approvalStatus || '').toUpperCase() === 'REJECTED') return;
                const t = new Date(log.timestamp);
                if (t < startPeriod || t > endPeriod) return;
                total += parseFloat(String(log.totalHours || "0").replace(',', '.'));
            });
            return { name: emp.name, jam: total };
        }).filter(x => x.jam > 0).sort((a, b) => b.jam - a.jam).slice(0, 8);

        if (this._charts.lembur) this._charts.lembur.destroy();

        if (lemburMap.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '13px sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.fillText('Belum ada lembur di periode berjalan', canvas.width / 2, canvas.height / 2);
            return;
        }

        this._charts.lembur = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: lemburMap.map(x => x.name.length > 12 ? x.name.slice(0, 12) + '…' : x.name),
                datasets: [{
                    label: 'Jam Lembur',
                    data: lemburMap.map(x => x.jam),
                    backgroundColor: 'rgba(37, 99, 235, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    },

    _renderLeaderboards(employees, attendance, config, startPeriod, endPeriod) {
        // Hitung per karyawan: hadirCount & menitTelat dalam periode
        const stats = employees.map(emp => {
            let hadir = 0, totalMenitTelat = 0;
            attendance.forEach(log => {
                if (String(log.userId) !== String(emp.id)) return;
                const t = new Date(log.timestamp);
                if (t < startPeriod || t > endPeriod) return;
                if (log.type !== 'MASUK') return;
                if (String(log.approvalStatus || '').toUpperCase() === 'REJECTED') return;
                hadir++;
                if (log.statusTelat && log.statusTelat !== "0" && log.statusTelat !== "-") {
                    totalMenitTelat += parseInt(log.statusTelat) || 0;
                }
            });
            return { id: emp.id, name: emp.name, hadir, totalMenitTelat };
        });

        // Disiplin: yang punya hadir > 0 dan menit telat paling sedikit (ascending), tie → hadir desc
        const disiplin = stats.filter(s => s.hadir > 0)
            .sort((a, b) => a.totalMenitTelat - b.totalMenitTelat || b.hadir - a.hadir)
            .slice(0, 3);
        const telat = stats.filter(s => s.totalMenitTelat > 0)
            .sort((a, b) => b.totalMenitTelat - a.totalMenitTelat)
            .slice(0, 3);

        const renderList = (list, color, bg, emptyMsg, isTelat) => {
            if (list.length === 0) return `<div style="text-align:center; color:#94a3b8; padding:20px; font-size:13px;">${emptyMsg}</div>`;
            return list.map((s, i) => {
                const medal = ['🥇', '🥈', '🥉'][i] || '';
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:${bg}; border-radius:8px; margin-bottom:6px;">
                    <div>
                        <div style="font-weight:600; color:#1e293b; font-size:13px;">${medal} ${this._esc(s.name)}</div>
                        <div style="font-size:11px; color:#64748b;">${s.hadir} hari hadir</div>
                    </div>
                    <div style="text-align:right;">
                        ${isTelat
                            ? `<div style="font-weight:700; color:${color}; font-size:14px;">${s.totalMenitTelat} mnt</div><div style="font-size:10px; color:#94a3b8;">terlambat</div>`
                            : `<div style="font-weight:700; color:${color}; font-size:14px;"><i class="fas fa-check"></i> Tepat</div><div style="font-size:10px; color:#94a3b8;">${s.totalMenitTelat === 0 ? 'tanpa telat' : s.totalMenitTelat + ' mnt total'}</div>`}
                    </div>
                </div>`;
            }).join('');
        };

        document.getElementById('dash-top-disiplin').innerHTML = renderList(disiplin, '#10b981', '#f0fdf4', 'Belum ada data hadir di periode ini', false);
        document.getElementById('dash-top-telat').innerHTML = renderList(telat, '#ef4444', '#fef2f2', 'Belum ada keterlambatan 🎉', true);
    },

    _renderUlangTahun(employees, today) {
        const card = document.getElementById('dash-ultah-card');
        const list = document.getElementById('dash-ultah-list');
        if (!card || !list) return;

        const namaBulan = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();

        const hitungUmur = (tglLahir) => {
            const d = new Date(tglLahir);
            if (isNaN(d)) return null;
            let umur = today.getFullYear() - d.getFullYear();
            if (today.getMonth() < d.getMonth() ||
                (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) {
                umur--;
            }
            return Math.max(0, umur);
        };

        const ultahBulanIni = employees
            .filter(e => e.tanggal_lahir)
            .map(e => {
                const d = new Date(e.tanggal_lahir);
                if (isNaN(d) || d.getMonth() !== todayMonth) return null;
                return {
                    id: e.id, name: e.name, position: e.position,
                    no_hp: e.no_hp_utama || '',
                    tgl: d.getDate(),
                    umur: hitungUmur(e.tanggal_lahir),
                    isToday: d.getDate() === todayDate
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.tgl - b.tgl);

        if (ultahBulanIni.length === 0) {
            card.style.display = 'none';
            return;
        }
        card.style.display = 'block';

        const todayUltah = ultahBulanIni.filter(u => u.isToday);
        let html = '';

        if (todayUltah.length > 0) {
            html += `<div style="background:linear-gradient(135deg,#fef3c7,#fbbf24); padding:14px; border-radius:10px; margin-bottom:10px; color:#78350f;">
                <div style="font-size:14px; font-weight:700; margin-bottom:6px;">🎉 Hari ini ulang tahun!</div>
                ${todayUltah.map(u => `<div style="background:rgba(255,255,255,0.5); padding:8px 12px; border-radius:6px; margin-top:6px; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                    <div>
                        <b>${this._esc(u.name)}</b> ${u.umur !== null ? `<span style="color:#92400e;">· ${u.umur} thn</span>` : ''}
                        <div style="font-size:11px; color:#92400e;">${this._esc(u.position || '-')}</div>
                    </div>
                    ${u.no_hp ? `<a href="https://wa.me/${this._normalizeWA(u.no_hp)}?text=${encodeURIComponent('Halo ' + u.name + ', selamat ulang tahun! 🎂 Semoga panjang umur, sehat, dan dilancarkan rezekinya 🙏')}" target="_blank" style="background:#10b981; color:white; text-decoration:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600;"><i class="fab fa-whatsapp"></i> Kirim Ucapan</a>` : ''}
                </div>`).join('')}
            </div>`;
        }

        const lainnya = ultahBulanIni.filter(u => !u.isToday);
        if (lainnya.length > 0) {
            html += `<div style="font-size:11px; color:#64748b; font-weight:600; margin:6px 0;">JADWAL ULTAH ${namaBulan[todayMonth + 1].toUpperCase()} (${lainnya.length})</div>`;
            html += lainnya.map(u => {
                const isPast = u.tgl < todayDate;
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:${isPast ? '#f8fafc' : '#fffbeb'}; border-radius:6px; margin-bottom:4px; ${isPast ? 'opacity:0.6;' : ''}">
                    <div>
                        <span style="font-weight:600; color:#1e293b;">${this._esc(u.name)}</span>
                        ${u.umur !== null ? `<span style="color:#94a3b8; font-size:11px;"> · ke-${u.umur + (isPast ? 0 : 1)}</span>` : ''}
                    </div>
                    <span style="background:${isPast ? '#cbd5e1' : '#f59e0b'}; color:white; padding:2px 10px; border-radius:10px; font-size:11px; font-weight:700;">${u.tgl} ${namaBulan[todayMonth + 1]}</span>
                </div>`;
            }).join('');
        }
        list.innerHTML = html;
    },

    _normalizeWA(num) {
        let s = String(num || '').replace(/[^0-9]/g, '');
        if (s.startsWith('0')) s = '62' + s.substring(1);
        else if (s.startsWith('8')) s = '62' + s;
        return s;
    },

    _renderAnomali(resAnomali) {
        const wrap = document.getElementById('dash-anomali');
        const countEl = document.getElementById('dash-anomali-count');
        if (!wrap) return;
        if (!resAnomali || !resAnomali.success) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:13px;">Tidak ada data anomali</div>';
            if (countEl) { countEl.textContent = '0'; countEl.style.background = '#dcfce7'; countEl.style.color = '#166534'; }
            return;
        }
        const list = resAnomali.data || [];
        if (countEl) {
            countEl.textContent = list.length;
            if (list.length === 0) { countEl.style.background = '#dcfce7'; countEl.style.color = '#166534'; }
            else { countEl.style.background = '#fee2e2'; countEl.style.color = '#dc2626'; }
        }
        if (list.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#10b981; padding:20px; font-size:13px;"><i class="fas fa-check-circle" style="font-size:20px; display:block; margin-bottom:4px;"></i>Tidak ada anomali terdeteksi 30 hari terakhir 👍</div>';
            return;
        }
        const levelStyle = {
            'critical': { bg: '#fee2e2', color: '#dc2626', icon: 'fa-exclamation-circle' },
            'warning': { bg: '#fef3c7', color: '#92400e', icon: 'fa-exclamation-triangle' },
            'info': { bg: '#dbeafe', color: '#1e40af', icon: 'fa-info-circle' }
        };
        wrap.innerHTML = list.slice(0, 10).map(a => {
            const ls = levelStyle[a.level] || levelStyle.info;
            return `<div style="display:flex; gap:10px; padding:10px 12px; background:${ls.bg}; border-left:3px solid ${ls.color}; border-radius:6px; margin-bottom:6px;">
                <i class="fas ${ls.icon}" style="color:${ls.color}; font-size:18px; margin-top:2px;"></i>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:12px; font-weight:700; color:${ls.color};">${this._esc(a.tipe)} · <span style="font-weight:400; color:#64748b;">${a.tanggal}</span></div>
                    <div style="font-size:12px; color:#475569; margin-top:2px;">${this._esc(a.pesan)}</div>
                </div>
            </div>`;
        }).join('') + (list.length > 10 ? `<div style="text-align:center; color:#94a3b8; font-size:11px; margin-top:6px;">+${list.length - 10} anomali lainnya</div>` : '');
    },

    _renderAlerts(employees, pengajuan, sentMap, today, periodeInfo) {
        const alerts = [];

        // Alert 1: Pengajuan pending >3 hari
        const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);
        const oldPending = pengajuan.filter(p => {
            if (String(p.status || '').toUpperCase() !== 'PENDING') return false;
            const submitted = new Date(p.submitted_at);
            return !isNaN(submitted) && submitted < threeDaysAgo;
        });
        if (oldPending.length > 0) {
            alerts.push({
                color: '#ef4444', bg: '#fef2f2', icon: 'fa-clock',
                title: `${oldPending.length} pengajuan pending > 3 hari`,
                detail: oldPending.slice(0, 3).map(p => `${this._esc(p.nama)} (${p.tipe}, ${p.jumlah_hari}h)`).join(', ') + (oldPending.length > 3 ? ` +${oldPending.length - 3}` : ''),
                action: { label: 'Approve sekarang', target: 'admin-pengajuan' }
            });
        }

        // Alert 2: Kuota cuti hampir habis (sisa ≤ 2)
        const tahun = today.getFullYear();
        const KUOTA = 7;
        const cutiTerpakai = {};
        pengajuan.forEach(p => {
            if (String(p.tipe || '').toUpperCase() !== 'CUTI') return;
            if (String(p.status || '').toUpperCase() !== 'APPROVED') return;
            const th = new Date(p.tanggal_mulai).getFullYear();
            if (th !== tahun) return;
            const uid = String(p.userId);
            cutiTerpakai[uid] = (cutiTerpakai[uid] || 0) + (Number(p.jumlah_hari) || 0);
        });
        const lowQuota = employees
            .map(e => ({ name: e.name, terpakai: cutiTerpakai[String(e.id)] || 0 }))
            .filter(x => x.terpakai > 0 && (KUOTA - x.terpakai) <= 2);
        if (lowQuota.length > 0) {
            alerts.push({
                color: '#f59e0b', bg: '#fffbeb', icon: 'fa-exclamation-triangle',
                title: `${lowQuota.length} karyawan kuota cuti hampir habis (${tahun})`,
                detail: lowQuota.slice(0, 3).map(x => `${this._esc(x.name)} (sisa ${KUOTA - x.terpakai}/${KUOTA})`).join(', ') + (lowQuota.length > 3 ? ` +${lowQuota.length - 3}` : ''),
                action: null
            });
        }

        // Alert 3: Slip belum dikirim — window-based (hanya muncul saat relevant)
        // Window: 5 hari menjelang endDay sampai 7 hari setelah endDay
        // Plus label periode jelas (mis. "Slip Juni 2026 belum dikirim")
        if (periodeInfo && periodeInfo.startDay) {
            const startDay = periodeInfo.startDay;
            const endDay = startDay - 1;
            const todayDate = today.getDate();
            const periodeEndThisMonth = new Date(today.getFullYear(), today.getMonth(), endDay, 23, 59, 59);
            // Hitung jarak hari ini vs endDay periode bulan ini
            const msFromEnd = today - periodeEndThisMonth;
            const daysFromEnd = Math.floor(msFromEnd / 86400000);
            let labelBulan, labelTahun;
            let showAlert = false;
            if (daysFromEnd >= 0 && daysFromEnd <= 7) {
                // Sudah lewat endDay 0-7 hari → reminder slip periode yang baru berakhir
                // Label periode = bulan dari endDay (= bulan ini)
                labelBulan = periodeInfo.namaBulan[today.getMonth()];
                labelTahun = today.getFullYear();
                showAlert = true;
            } else if (daysFromEnd < 0 && daysFromEnd >= -5) {
                // 5 hari menjelang endDay → soft reminder periode current akan segera berakhir
                labelBulan = periodeInfo.namaBulan[today.getMonth()];
                labelTahun = today.getFullYear();
                showAlert = true;
            }
            if (showAlert) {
                const belumDikirim = employees.filter(e => !sentMap[String(e.id)]);
                if (belumDikirim.length > 0) {
                    const overdueLabel = daysFromEnd > 0 ? ` (overdue ${daysFromEnd} hari)` : '';
                    alerts.push({
                        color: daysFromEnd > 3 ? '#ef4444' : '#3b82f6',
                        bg: daysFromEnd > 3 ? '#fef2f2' : '#eff6ff',
                        icon: 'fa-paper-plane',
                        title: `${belumDikirim.length} slip ${labelBulan} ${labelTahun} belum dikirim${overdueLabel}`,
                        detail: belumDikirim.slice(0, 3).map(x => this._esc(x.name)).join(', ') + (belumDikirim.length > 3 ? ` +${belumDikirim.length - 3}` : ''),
                        action: { label: 'Buka Payroll', target: 'payroll-reports' }
                    });
                }
            }
        }

        // Alert 4: Karyawan tanpa email
        const noEmail = employees.filter(e => !e.email || e.email.indexOf('@') < 0);
        if (noEmail.length > 0) {
            alerts.push({
                color: '#94a3b8', bg: '#f8fafc', icon: 'fa-envelope',
                title: `${noEmail.length} karyawan tidak punya email valid`,
                detail: noEmail.slice(0, 3).map(x => this._esc(x.name)).join(', ') + (noEmail.length > 3 ? ` +${noEmail.length - 3}` : ''),
                action: { label: 'Buka Data Karyawan', target: 'employees' }
            });
        }

        const wrap = document.getElementById('dash-alerts');
        if (alerts.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#10b981; padding:20px; font-size:13px;"><i class="fas fa-check-circle" style="font-size:24px; display:block; margin-bottom:6px;"></i>Semua aman, tidak ada yang perlu ditindaklanjuti 🎉</div>';
            return;
        }
        wrap.innerHTML = alerts.map(a => `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px; background:${a.bg}; border-left:3px solid ${a.color}; border-radius:6px; margin-bottom:8px; flex-wrap:wrap;">
                <div style="flex:1; min-width:200px;">
                    <div style="font-weight:600; color:${a.color}; font-size:13px;"><i class="fas ${a.icon}"></i> ${a.title}</div>
                    <div style="font-size:12px; color:#64748b; margin-top:2px;">${a.detail}</div>
                </div>
                ${a.action ? `<button onclick="router.navigate('${a.action.target}')" style="background:${a.color}; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; white-space:nowrap;">${a.action.label} →</button>` : ''}
            </div>
        `).join('');
    }
};

window.adminDashboard = adminDashboard;
