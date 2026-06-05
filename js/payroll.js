/**
 * js/payroll.js - PT. BISATANI
 * Versi Final: Fix Desimal Lembur (Anti Pembulatan ke 0.0)
 */
const payroll = {
    config: {},
    employees: [],
    attendance: [],
    calculatedData: [],
    sentMap: {}, // userId -> {timestampDisplay, totalGaji, email}

    init() {
        const yearInput = document.getElementById('payroll-year');
        const monthInput = document.getElementById('payroll-month');
        if (yearInput) yearInput.value = new Date().getFullYear();
        if (monthInput) monthInput.value = new Date().getMonth();
    },

    // Bonus custom per (tahun, bulan, userId) disimpan di SHEET (Payroll_Bonus),
    // permanen & konsisten antar device/admin (sebelumnya di localStorage).
    _periodeBulanTahun() {
        return {
            bulan: parseInt(document.getElementById('payroll-month').value),
            tahun: parseInt(document.getElementById('payroll-year').value)
        };
    },
    async loadBonusMap() {
        try {
            const { bulan, tahun } = this._periodeBulanTahun();
            const a = (typeof auth !== 'undefined' && auth.user) || {};
            const res = await api.post({ action: 'getPayrollBonus', bulan: bulan, tahun: tahun, actor_id: a.id });
            return (res && res.success) ? (res.data || {}) : {};
        } catch (e) { return {}; }
    },
    async setBonus(empId, amount) {
        const num = parseFloat(String(amount).replace(/[^\d.-]/g, '')) || 0;
        const { bulan, tahun } = this._periodeBulanTahun();
        const a = (typeof auth !== 'undefined' && auth.user) || {};
        // Update UI optimistik dulu (responsif)
        const row = this.calculatedData.find(d => String(d.id) === String(empId));
        if (row) {
            row.bonusCustom = num;
            row.totalGaji = this.computeFinalTotal(row);
            this.refreshTotalCell(empId, row.totalGaji);
        }
        // Simpan permanen ke sheet
        try {
            const res = await api.post({ action: 'savePayrollBonus', userId: empId, bulan: bulan, tahun: tahun, nominal: num, actor_id: a.id, actor_name: a.name || a.nama });
            if (!res || !res.success) alert('❌ Bonus gagal tersimpan: ' + ((res && res.error) || 'coba lagi'));
        } catch (e) { alert('❌ Error simpan bonus: ' + e.message); }
    },
    refreshTotalCell(empId, total) {
        const cell = document.querySelector(`[data-total-id="${empId}"]`);
        if (cell) cell.textContent = `Rp ${Number(total).toLocaleString('id-ID')}`;
    },
    computeFinalTotal(p) {
        const bonus = parseFloat(p.bonusCustom || 0);
        const komisiLive = parseFloat(p.komisiLive || 0);
        const honorSopir = parseFloat(p.honorSopir || 0);
        const bensin = parseFloat(p.tunjBensinTerbayar || 0);
        const kost = parseFloat(p.tunjKost || 0);
        const potIzin = parseFloat(p.potonganIzin || 0);
        const potPulCepat = parseFloat(p.potonganPulangCepat || 0);
        const potMangkir = parseFloat(p.potonganMangkir || 0);
        if (p.jenis_gaji === 'per_jam') {
            return p.basisGaji - p.bpjs + bonus + komisiLive + honorSopir + bensin + kost;
        }
        return (p.gapok + p.bonusLembur + bonus + komisiLive + honorSopir + bensin + kost) - (p.bpjs + p.dendaTelat + potIzin + potPulCepat + potMangkir);
    },

    async calculate() {
        const btn = document.querySelector('button[onclick="payroll.calculate()"]');
        const tbody = document.getElementById('payroll-table-body');
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px;"><i class="fas fa-sync fa-spin"></i> Sinkronisasi data...</td></tr>';

            const month = parseInt(document.getElementById('payroll-month').value);
            const year = parseInt(document.getElementById('payroll-year').value);
            const bulanNama = document.getElementById('payroll-month').options[document.getElementById('payroll-month').selectedIndex].text;

            const [resEmp, resCfg, resAtt, resSent, resPengajuan] = await Promise.all([
                api.post({ action: 'getEmployees' }),
                api.post({ action: 'getSettings' }),
                api.post({ action: 'getAllAttendanceData' }),
                api.post({ action: 'getPayrollSentLog', bulan: bulanNama, tahun: String(year) }),
                api.post({ action: 'getAllPengajuan' })
            ]);

            this.sentMap = {};
            if (resSent && resSent.success && Array.isArray(resSent.data)) {
                resSent.data.forEach(s => { this.sentMap[String(s.userId)] = s; });
            }

            // Skip akun admin & superadmin dari kalkulasi payroll
            this.employees = (resEmp.data || []).filter(e => !['admin', 'superadmin'].includes(String(e.role || '').toLowerCase()));
            this.attendance = resAtt.data || [];
            this.config = resCfg.data || {};
            this.pengajuan = (resPengajuan && resPengajuan.success) ? (resPengajuan.data || []) : [];

            // Periode payroll: [start_day bulan lalu] sampai [start_day-1 bulan ini]
            const startDay = parseInt(this.config.periode_start_day || 26);
            const endDay = startDay - 1;
            const startDate = new Date(year, month - 1, startDay, 0, 0, 0);
            const endDate = new Date(year, month, endDay, 23, 59, 59);

            this.calculatedData = this.employees.map(emp => this.calculateSingleEmployee(emp, startDate, endDate));

            // Rekap Komisi Live (streamer) untuk periode ini — hanya sesi yang sudah di-ACC
            const fmtYmd = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
            let komisiMap = {};
            let sopirMap = {};
            try {
                const actorId = (typeof auth !== 'undefined' && auth.user && auth.user.id) || '';
                const [resKom, resSopir] = await Promise.all([
                    api.post({ action: 'getLiveKomisiByPeriode', start: fmtYmd(startDate), end: fmtYmd(endDate), actor_id: actorId }),
                    api.post({ action: 'getSopirHonorByPeriode', start: fmtYmd(startDate), end: fmtYmd(endDate), actor_id: actorId })
                ]);
                if (resKom && resKom.success) komisiMap = resKom.data || {};
                if (resSopir && resSopir.success) sopirMap = resSopir.data || {};
            } catch (e) { /* abaikan — komisi/honor 0 */ }

            // Apply bonus custom dari sheet + komisi live + honor sopir ke calculatedData + recalc total
            const bonusMap = await this.loadBonusMap();
            this.calculatedData.forEach(row => {
                row.bonusCustom = parseFloat(bonusMap[row.id] || 0);
                const k = komisiMap[String(row.id)];
                row.komisiLive = k ? (Number(k.komisi) || 0) : 0;
                row.komisiLiveSesi = k ? (Number(k.sesi) || 0) : 0;
                const sp = sopirMap[String(row.id)];
                row.honorSopir = sp ? (Number(sp.honor) || 0) : 0;
                row.honorSopirTrips = sp ? (Number(sp.trips) || 0) : 0;
                row.totalGaji = this.computeFinalTotal(row);
            });
            this.renderTable(this.calculatedData);

        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-calculator"></i> Hitung';
        }
    },

    // Hitung jumlah hari pengajuan APPROVED milik userId dengan tipe tertentu
    // yang masuk dalam periode payroll [start, end]. Hari overlap dihitung,
    // jadi pengajuan yang lintas 2 periode terdistribusi proporsional.
    countHariPengajuan(userId, tipe, periodStart, periodEnd) {
        if (!this.pengajuan || this.pengajuan.length === 0) return 0;
        let total = 0;
        const pStart = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
        const pEnd = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
        this.pengajuan.forEach(p => {
            if (String(p.userId) !== String(userId)) return;
            if (String(p.status || '').toUpperCase() !== 'APPROVED') return;
            if (String(p.tipe || '').toUpperCase() !== String(tipe).toUpperCase()) return;
            // Parse tanggal_mulai/selesai sebagai date-only (no timezone shift)
            const parseYMD = (s) => {
                if (!s) return null;
                const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (!m) return null;
                return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            };
            const rangeStart = parseYMD(p.tanggal_mulai);
            const rangeEnd = parseYMD(p.tanggal_selesai);
            if (!rangeStart || !rangeEnd) return;
            // Hitung overlap inklusif
            const s = rangeStart > pStart ? rangeStart : pStart;
            const e = rangeEnd < pEnd ? rangeEnd : pEnd;
            if (e < s) return;
            const days = Math.floor((e - s) / 86400000) + 1;
            total += days;
        });
        return total;
    },

    // Helper: hitung durasi kerja per hari (jam) untuk satu karyawan
    hitungDurasiHarianMap(userLogs) {
        const byDay = {};
        userLogs.forEach(log => {
            const isRejected = String(log.approvalStatus || '').toUpperCase() === 'REJECTED';
            if (isRejected) return;
            const t = new Date(log.timestamp);
            const ymd = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
            if (!byDay[ymd]) byDay[ymd] = {};
            if (log.type === 'MASUK') byDay[ymd].masuk = t;
            if (log.type === 'PULANG') byDay[ymd].pulang = t;
        });
        const durasi = {};
        Object.keys(byDay).forEach(ymd => {
            const m = byDay[ymd].masuk, p = byDay[ymd].pulang;
            if (m && p) durasi[ymd] = (p - m) / 3600000;
            else if (m && !p) durasi[ymd] = null; // tidak ada PULANG → skip potongan
        });
        return durasi;
    },

    calculateSingleEmployee(emp, start, end) {
        const userLogs = this.attendance.filter(a => {
            const tgl = new Date(a.timestamp);
            return String(a.userId) === String(emp.id) && tgl >= start && tgl <= end;
        });

        const tarifLembur = parseInt(this.config.overtime_rate || 10000);
        const gajiPokok = parseFloat(emp.gaji_pokok || 0);
        const tarifPerJam = parseFloat(emp.tarif_per_jam || 0);
        const isPerJam = (emp.jenis_gaji === 'per_jam');
        // Gudang = jam kerja fleksibel (mulai bisa pagi/siang, yang penting 8 jam) → BEBAS denda telat.
        // Tetap dinilai 8 jam via potongan pulang cepat (durasi < 8 jam).
        const isFleksibel = String(emp.department || '').toLowerCase().indexOf('gudang') !== -1;
        const hariKerjaPerBulan = parseInt(this.config.hari_kerja_per_bulan || 25);
        const jamKerjaPerHari = parseFloat(this.config.jam_kerja_per_hari || 8);
        const aktifkanPotongan = String(this.config.aktifkan_potongan_pulang_cepat || 'true') === 'true';
        let dendaPerMenit = parseFloat(emp.dendatelat || 0);

        if (dendaPerMenit <= 0 && gajiPokok > 0) {
            dendaPerMenit = Math.round(gajiPokok / hariKerjaPerBulan / jamKerjaPerHari / 60);
        }

        let hadirCount = 0;
        let totalMenitTelat = 0;
        let jamLemburTotal = 0;

        userLogs.forEach(log => {
            // Skip row yang DITOLAK admin (hanya berlaku untuk MASUK & SELESAI_LEMBUR)
            const isRejected = String(log.approvalStatus || '').toUpperCase() === 'REJECTED';

            if (log.type === 'MASUK') {
                if (isRejected) return; // Tidak hitung sebagai hadir, telat juga skip
                hadirCount++;
                if (log.statusTelat && log.statusTelat !== "0" && log.statusTelat !== "-") {
                    totalMenitTelat += parseInt(log.statusTelat) || 0;
                }
            }
            // FORCE PARSE DECIMAL: Mengatasi 0.03j agar tidak hilang
            if (log.type === 'SELESAI_LEMBUR') {
                if (isRejected) return; // Tidak hitung jam lembur
                let jamRaw = String(log.totalHours || "0").replace(',', '.');
                jamLemburTotal += parseFloat(jamRaw);
            }
        });

        const bpjs = parseInt(emp.bpjs || 0);
        const bonusLembur = Math.round(jamLemburTotal * tarifLembur);
        // Denda telat: 0 untuk per-jam (dibayar per jam) & gudang (jam fleksibel).
        const nominalDenda = (isPerJam || isFleksibel) ? 0 : Math.round(totalMenitTelat * dendaPerMenit);

        // Tunjangan: bensin proporsional (hari_hadir / hari_kerja_per_bulan), kost flat
        const tunjBensinFull = parseFloat(emp.tunjangan_bensin || 0);
        const tunjKost = parseFloat(emp.tunjangan_kost || 0);
        const hadirCapped = Math.min(hadirCount, hariKerjaPerBulan);
        const tunjBensinTerbayar = Math.round(tunjBensinFull * hadirCapped / hariKerjaPerBulan);

        // Hitung hari Cuti & Izin APPROVED dalam periode payroll
        const hariCuti = this.countHariPengajuan(emp.id, 'CUTI', start, end);
        const hariIzin = this.countHariPengajuan(emp.id, 'IZIN', start, end);
        const gajiHarian = hariKerjaPerBulan > 0 ? (gajiPokok / hariKerjaPerBulan) : 0;
        // Potongan izin (hanya untuk jenis gaji bulanan): gaji_harian × hari_izin
        const potonganIzin = isPerJam ? 0 : Math.round(gajiHarian * hariIzin);

        // Potongan pulang cepat (proporsional, hanya bulanan)
        let hariPulangCepat = 0;
        let potonganPulangCepat = 0;
        if (!isPerJam && aktifkanPotongan) {
            const durasiByDay = this.hitungDurasiHarianMap(userLogs);
            Object.keys(durasiByDay).forEach(ymd => {
                const durasi = durasiByDay[ymd];
                if (durasi == null) return; // tidak ada PULANG → skip
                // Toleransi 5 menit (0.0833 jam) supaya tidak petty
                if (durasi < jamKerjaPerHari - 0.0833) {
                    const faktorKurang = Math.max(0, (jamKerjaPerHari - durasi) / jamKerjaPerHari);
                    potonganPulangCepat += Math.round(gajiHarian * faktorKurang);
                    hariPulangCepat++;
                }
            });
        }

        // Potongan mangkir (hari tidak masuk tanpa izin/cuti approved) — hanya bulanan
        // Per_jam sudah otomatis: tidak hadir = jamKerjaTotal lebih kecil = gaji lebih kecil
        // CATATAN: mangkir baru dihitung saat PERIODE SUDAH SELESAI. Selama periode berjalan
        // (hari ini masih <= akhir periode), hari yang belum tiba TIDAK dihitung mangkir.
        let hariMangkir = 0;
        let potonganMangkir = 0;
        const periodeSelesai = new Date() > end;
        if (!isPerJam && periodeSelesai) {
            hariMangkir = Math.max(0, hariKerjaPerBulan - hadirCount - hariCuti - hariIzin);
            potonganMangkir = Math.round(gajiHarian * hariMangkir);
        }

        let totalGaji;
        let basisGaji;
        let jamKerjaTotal = 0;

        if (isPerJam) {
            // Per jam: bayar JAM KERJA AKTUAL (durasi masuk→pulang) per hari, di-cap di
            // jam_kerja_per_hari (8j) — sisanya lewat jalur lembur. Hari yang ada MASUK tapi
            // belum PULANG dipakai standar 8j (fallback; admin bisa koreksi via edit waktu).
            const durasiMap = this.hitungDurasiHarianMap(userLogs);
            let jamNormalAktual = 0;
            Object.keys(durasiMap).forEach(ymd => {
                const dur = durasiMap[ymd];
                if (dur == null) jamNormalAktual += jamKerjaPerHari; // masuk tanpa pulang → fallback standar
                else jamNormalAktual += Math.max(0, Math.min(dur, jamKerjaPerHari)); // cap 8j, lembur terpisah
            });
            jamKerjaTotal = jamNormalAktual + jamLemburTotal;
            basisGaji = Math.round(jamKerjaTotal * tarifPerJam);
            totalGaji = basisGaji - bpjs + tunjBensinTerbayar + tunjKost;
        } else {
            // Bulanan: Cuti tetap full, Izin dipotong proporsional, Pulang cepat dipotong proporsional,
            // Mangkir dipotong full gaji harian per hari mangkir
            basisGaji = gajiPokok;
            totalGaji = (gajiPokok + bonusLembur + tunjBensinTerbayar + tunjKost) - (bpjs + nominalDenda + potonganIzin + potonganPulangCepat + potonganMangkir);
        }

        return {
            id: emp.id,
            name: emp.name,
            jenis_gaji: isPerJam ? 'per_jam' : 'bulanan',
            fleksibel: isFleksibel,
            tarifPerJam: tarifPerJam,
            jamKerjaTotal: jamKerjaTotal,
            gapok: gajiPokok,
            basisGaji: basisGaji,
            hadir: hadirCount,
            lemburJam: jamLemburTotal,
            bonusLembur: isPerJam ? 0 : bonusLembur,
            menitTelat: totalMenitTelat,
            dendaTelat: isPerJam ? 0 : nominalDenda,
            bpjs: bpjs,
            tunjBensinFull: tunjBensinFull,
            tunjBensinTerbayar: tunjBensinTerbayar,
            tunjKost: tunjKost,
            hariCuti: hariCuti,
            hariIzin: hariIzin,
            potonganIzin: potonganIzin,
            hariPulangCepat: hariPulangCepat,
            potonganPulangCepat: potonganPulangCepat,
            hariMangkir: hariMangkir,
            potonganMangkir: potonganMangkir,
            komisiLive: 0,
            komisiLiveSesi: 0,
            honorSopir: 0,
            honorSopirTrips: 0,
            totalGaji: totalGaji
        };
    },

    renderTable(data) {
        const tbody = document.getElementById('payroll-table-body');
        if (!tbody) return;
        // Hitung total agregat untuk footer
        const totals = data.reduce((acc, p) => {
            acc.bonusLembur += Number(p.bonusLembur || 0);
            acc.dendaTelat += Number(p.dendaTelat || 0);
            acc.bpjs += Number(p.bpjs || 0);
            acc.bonusCustom += Number(p.bonusCustom || 0);
            acc.totalGaji += Number(p.totalGaji || 0);
            return acc;
        }, { bonusLembur:0, dendaTelat:0, bpjs:0, bonusCustom:0, totalGaji:0 });

        const dataRows = data.map(p => {
            const isPerJam = p.jenis_gaji === 'per_jam';
            const basisCell = isPerJam
                ? `<small style="color:#6366f1;">${p.jamKerjaTotal.toFixed(2)}j × Rp ${p.tarifPerJam.toLocaleString('id-ID')}</small><br>Rp ${p.basisGaji.toLocaleString('id-ID')}`
                : `Rp ${p.gapok.toLocaleString('id-ID')}`;
            const bonusCustomVal = Number(p.bonusCustom || 0);
            const sent = this.sentMap[String(p.id)];
            const isSent = !!sent;

            const rowStyle = isSent
                ? 'border-bottom:1px solid #e2e8f0; background:#f8fafc; opacity:0.78;'
                : 'border-bottom:1px solid #f1f5f9;';
            const lockIcon = isSent ? '<i class="fas fa-lock" style="color:#10b981; font-size:10px; margin-right:4px;"></i>' : '';
            const bonusInput = isSent
                ? `<div style="padding:8px; text-align:right; font-weight:600; color:#854d0e;">Rp ${bonusCustomVal.toLocaleString('id-ID')}</div>`
                : `<input type="number" min="0" step="1000" value="${bonusCustomVal || ''}" placeholder="0"
                        onchange="payroll.setBonus('${String(p.id).replace(/'/g,"\\'")}', this.value)"
                        style="width:100px; padding:6px 8px; border:1px solid #fbbf24; border-radius:6px; background:#fff; font-weight:600; color:#854d0e; text-align:right;" />`;
            const aksiCell = isSent ? `
                <div style="display:flex; flex-direction:column; align-items:center; gap:3px;">
                    <span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:10px; font-size:10px; font-weight:700; white-space:nowrap;">
                        <i class="fas fa-check-circle"></i> TERKIRIM
                    </span>
                    <small style="color:#64748b; font-size:10px;">${sent.timestampDisplay || ''}</small>
                </div>` : `
                <span style="color:#94a3b8; font-size:11px; font-style:italic;">belum dikirim</span>`;

            return `
            <tr style="${rowStyle}">
                <td style="padding:12px;">${lockIcon}<strong onclick="payroll.showSlip('${String(p.id).replace(/'/g,"\\'")}')" style="cursor:pointer; color:#2563eb; border-bottom:1px dotted #2563eb;" title="Klik untuk lihat detail gaji">${p.name}</strong> <i class="fas fa-receipt" style="color:#94a3b8; font-size:11px;"></i><br><small style="color:${isPerJam ? '#6366f1' : '#64748b'};">${isPerJam ? 'PER JAM' : 'BULANAN'} · ID: ${p.id}</small></td>
                <td>${basisCell}</td>
                <td style="text-align:center;">
                    ${p.hadir} Hari
                    ${(p.hariCuti > 0 || p.hariIzin > 0 || p.hariMangkir > 0)
                        ? `<br><small style="color:#94a3b8; font-size:10px;">${p.hariCuti > 0 ? `<span style="color:#10b981;">${p.hariCuti}c</span>` : ''}${p.hariCuti > 0 && p.hariIzin > 0 ? ' · ' : ''}${p.hariIzin > 0 ? `<span style="color:#f59e0b;">${p.hariIzin}i</span>` : ''}${(p.hariCuti > 0 || p.hariIzin > 0) && p.hariMangkir > 0 ? ' · ' : ''}${p.hariMangkir > 0 ? `<span style="color:#ef4444; font-weight:700;">${p.hariMangkir}m</span>` : ''}</small>`
                        : ''}
                </td>
                <td style="text-align:center; font-weight:bold; color:#2563eb;">${p.lemburJam.toFixed(2)}j</td>
                <td style="color:#10b981; font-weight:600;">${isPerJam ? '<small>(incl. di basis)</small>' : '+' + p.bonusLembur.toLocaleString('id-ID')}</td>
                <td style="color:#ef4444;">${(isPerJam || p.fleksibel) ? '<small style="color:#94a3b8;">fleksibel</small>' : '-' + p.dendaTelat.toLocaleString('id-ID') + '<br><small>(' + p.menitTelat + ' m)</small>'}</td>
                <td style="color:#ef4444;">-${p.bpjs.toLocaleString('id-ID')}</td>
                <td style="background:${isSent ? '#f1f5f9' : '#fef9c3'}; padding:6px;">
                    ${Number(p.komisiLive || 0) > 0 ? `<div style="font-size:10px; color:#0f766e; font-weight:700; text-align:right; margin-bottom:4px;">🎥 Komisi Live: +${Number(p.komisiLive).toLocaleString('id-ID')}<br><span style="color:#94a3b8; font-weight:500;">(${p.komisiLiveSesi || 0} sesi · otomatis)</span></div>` : ''}
                    ${Number(p.honorSopir || 0) > 0 ? `<div style="font-size:10px; color:#0369a1; font-weight:700; text-align:right; margin-bottom:4px;">🚚 Honor Sopir: +${Number(p.honorSopir).toLocaleString('id-ID')}<br><span style="color:#94a3b8; font-weight:500;">(${p.honorSopirTrips || 0} berangkat · otomatis)</span></div>` : ''}
                    ${bonusInput}
                </td>
                <td data-total-id="${p.id}" style="background:#f0fdf4; font-weight:700; color:#166534;">
                    Rp ${p.totalGaji.toLocaleString('id-ID')}
                    ${(Number(p.tunjBensinTerbayar || 0) + Number(p.tunjKost || 0)) > 0
                        ? `<br><small style="color:#ea580c; font-weight:500; font-size:10px;">+ tunj. Rp ${(Number(p.tunjBensinTerbayar || 0) + Number(p.tunjKost || 0)).toLocaleString('id-ID')}</small>`
                        : ''}
                    ${Number(p.potonganIzin || 0) > 0
                        ? `<br><small style="color:#ef4444; font-weight:500; font-size:10px;">− izin Rp ${Number(p.potonganIzin).toLocaleString('id-ID')} (${p.hariIzin}h)</small>`
                        : ''}
                    ${Number(p.potonganPulangCepat || 0) > 0
                        ? `<br><small style="color:#ef4444; font-weight:500; font-size:10px;">− pulang cepat Rp ${Number(p.potonganPulangCepat).toLocaleString('id-ID')} (${p.hariPulangCepat}h)</small>`
                        : ''}
                    ${Number(p.potonganMangkir || 0) > 0
                        ? `<br><small style="color:#dc2626; font-weight:700; font-size:10px;">− MANGKIR Rp ${Number(p.potonganMangkir).toLocaleString('id-ID')} (${p.hariMangkir}h)</small>`
                        : ''}
                </td>
                <td style="text-align:center;">${aksiCell}</td>
            </tr>
        `; }).join('');

        // Footer total - all employees aggregate
        const footerRow = `
            <tr style="background:#0f172a; color:white;">
                <td colspan="4" style="padding:14px 12px; font-weight:700; font-size:13px; color:white;">
                    <i class="fas fa-coins" style="color:#fbbf24; margin-right:6px;"></i>
                    TOTAL (${data.length} karyawan)
                </td>
                <td style="padding:14px; color:#86efac; font-weight:700; text-align:left;">+${totals.bonusLembur.toLocaleString('id-ID')}</td>
                <td style="padding:14px; color:#fca5a5; font-weight:700; text-align:left;">-${totals.dendaTelat.toLocaleString('id-ID')}</td>
                <td style="padding:14px; color:#fca5a5; font-weight:700; text-align:left;">-${totals.bpjs.toLocaleString('id-ID')}</td>
                <td style="padding:14px; color:#fde047; font-weight:700; text-align:right;">+${totals.bonusCustom.toLocaleString('id-ID')}</td>
                <td style="padding:14px; background:#10b981; color:white; font-weight:800; font-size:15px; text-align:right;">Rp ${totals.totalGaji.toLocaleString('id-ID')}</td>
                <td style="background:#0f172a;"></td>
            </tr>
        `;

        tbody.innerHTML = dataRows + footerRow;
    },

    // ========== AKSI GLOBAL: DOWNLOAD CSV ==========
    downloadCSV() {
        if (!this.calculatedData || this.calculatedData.length === 0) {
            return alert("Belum ada data. Klik 'Hitung' dulu.");
        }
        const bulanNama = document.getElementById('payroll-month').options[document.getElementById('payroll-month').selectedIndex].text;
        const tahun = document.getElementById('payroll-year').value;

        const csvEscape = (v) => {
            const s = String(v == null ? '' : v);
            return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const headers = [
            'No', 'ID', 'Nama', 'Email', 'Nama Bank', 'No Rekening', 'Jenis Gaji',
            'Gaji Pokok / Bulan', 'Tarif Per Jam', 'Jam Kerja Total',
            'Hadir (hari)', 'Lembur (jam)', 'Bonus Lembur',
            'Menit Telat', 'Denda Telat', 'BPJS',
            'Bensin (full)', 'Bensin (terbayar)', 'Kost',
            'Hari Cuti', 'Hari Izin', 'Potongan Izin',
            'Hari Pulang Cepat', 'Potongan Pulang Cepat',
            'Hari Mangkir', 'Potongan Mangkir',
            'Bonus', 'TOTAL GAJI', 'Status Kirim Email'
        ];
        const rows = this.calculatedData.map((p, i) => {
            const emp = this.employees.find(e => String(e.id) === String(p.id));
            const email = emp ? (emp.email || '') : '';
            const namaBank = emp ? (emp.nama_bank || '') : '';
            // Prefix no rekening dengan ' supaya tidak di-convert ke scientific notation di Excel
            const noRekRaw = emp ? String(emp.no_rekening || '') : '';
            const noRek = noRekRaw ? `'${noRekRaw}` : '';
            const sent = this.sentMap[String(p.id)];
            const statusKirim = sent ? `TERKIRIM ${sent.timestampDisplay}` : 'BELUM';
            return [
                i + 1,
                p.id,
                p.name,
                email,
                namaBank,
                noRek,
                p.jenis_gaji === 'per_jam' ? 'PER JAM' : 'BULANAN',
                p.jenis_gaji === 'per_jam' ? 0 : p.gapok,
                p.jenis_gaji === 'per_jam' ? p.tarifPerJam : 0,
                p.jamKerjaTotal ? p.jamKerjaTotal.toFixed(2) : 0,
                p.hadir,
                p.lemburJam.toFixed(2),
                p.bonusLembur,
                p.menitTelat,
                p.dendaTelat,
                p.bpjs,
                Number(p.tunjBensinFull || 0),
                Number(p.tunjBensinTerbayar || 0),
                Number(p.tunjKost || 0),
                Number(p.hariCuti || 0),
                Number(p.hariIzin || 0),
                Number(p.potonganIzin || 0),
                Number(p.hariPulangCepat || 0),
                Number(p.potonganPulangCepat || 0),
                Number(p.hariMangkir || 0),
                Number(p.potonganMangkir || 0),
                Number(p.bonusCustom || 0),
                p.totalGaji,
                statusKirim
            ];
        });

        // Footer aggregate
        const totals = this.calculatedData.reduce((acc, p) => {
            acc.bonusLembur += Number(p.bonusLembur || 0);
            acc.dendaTelat += Number(p.dendaTelat || 0);
            acc.bpjs += Number(p.bpjs || 0);
            acc.tunjBensinTerbayar += Number(p.tunjBensinTerbayar || 0);
            acc.tunjKost += Number(p.tunjKost || 0);
            acc.hariCuti += Number(p.hariCuti || 0);
            acc.hariIzin += Number(p.hariIzin || 0);
            acc.potonganIzin += Number(p.potonganIzin || 0);
            acc.hariPulangCepat += Number(p.hariPulangCepat || 0);
            acc.potonganPulangCepat += Number(p.potonganPulangCepat || 0);
            acc.hariMangkir += Number(p.hariMangkir || 0);
            acc.potonganMangkir += Number(p.potonganMangkir || 0);
            acc.bonusCustom += Number(p.bonusCustom || 0);
            acc.totalGaji += Number(p.totalGaji || 0);
            return acc;
        }, { bonusLembur:0, dendaTelat:0, bpjs:0, tunjBensinTerbayar:0, tunjKost:0, hariCuti:0, hariIzin:0, potonganIzin:0, hariPulangCepat:0, potonganPulangCepat:0, hariMangkir:0, potonganMangkir:0, bonusCustom:0, totalGaji:0 });

        // Footer row: 29 kolom (sama dengan headers)
        const footer = [
            '', '', `TOTAL (${this.calculatedData.length} karyawan)`, '', '', '', '', // col 1-7
            '', '', '', '', '',                                                       // col 8-12
            totals.bonusLembur, '', totals.dendaTelat, totals.bpjs,                   // col 13-16
            '', totals.tunjBensinTerbayar, totals.tunjKost,                           // col 17-19
            totals.hariCuti, totals.hariIzin, totals.potonganIzin,                    // col 20-22
            totals.hariPulangCepat, totals.potonganPulangCepat,                       // col 23-24
            totals.hariMangkir, totals.potonganMangkir,                               // col 25-26
            totals.bonusCustom, totals.totalGaji, ''                                  // col 27-29
        ];

        // CSV content + UTF-8 BOM (supaya Excel buka tanpa garbled char)
        const csv = '﻿' + [headers, ...rows, footer]
            .map(r => r.map(csvEscape).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Payroll_PT_Bisatani_${bulanNama}_${tahun}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    },

    // ========== AKSI GLOBAL: KIRIM SLIP KE SEMUA KARYAWAN ==========
    async sendAllEmails() {
        if (!this.calculatedData || this.calculatedData.length === 0) {
            return alert("Belum ada data. Klik 'Hitung' dulu.");
        }
        // Build target list: karyawan dgn email valid yg BELUM dikirim
        const allWithEmail = this.calculatedData.map(d => {
            const emp = this.employees.find(e => String(e.id) === String(d.id));
            const email = emp ? String(emp.email || '').trim() : '';
            return { data: d, email: email, sent: !!this.sentMap[String(d.id)] };
        }).filter(x => x.email && x.email.indexOf('@') > 0);

        const belum = allWithEmail.filter(x => !x.sent);
        const sudah = allWithEmail.filter(x => x.sent);
        const tanpaEmail = this.calculatedData.length - allWithEmail.length;

        if (belum.length === 0) {
            const msg = `Semua ${sudah.length} karyawan sudah dikirim untuk periode ini.` +
                (tanpaEmail > 0 ? `\n\n${tanpaEmail} karyawan tidak punya email valid.` : '') +
                `\n\nKirim ULANG ke semua?`;
            if (!confirm(msg)) return;
            return this._batchSend(allWithEmail);
        }

        const confirmMsg =
            `Kirim slip ke ${belum.length} karyawan?` +
            (sudah.length > 0 ? `\n(${sudah.length} sudah dikirim sebelumnya — di-skip)` : '') +
            (tanpaEmail > 0 ? `\n(${tanpaEmail} karyawan tidak punya email valid — di-skip)` : '');
        if (!confirm(confirmMsg)) return;

        return this._batchSend(belum);
    },

    async _batchSend(targets) {
        if (!targets || targets.length === 0) return;

        const btn = document.getElementById('payroll-btn-send-all');
        const originalText = btn ? btn.innerHTML : '';
        if (btn) btn.disabled = true;

        const bulanNama = document.getElementById('payroll-month').options[document.getElementById('payroll-month').selectedIndex].text;
        const tahun = document.getElementById('payroll-year').value;

        let sukses = 0, gagal = 0;
        const errors = [];

        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            const d = t.data;
            if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Mengirim ${i+1}/${targets.length} (${d.name})...`;

            try {
                const payload = {
                    action: 'sendSlipEmail',
                    email: t.email,
                    name: d.name,
                    id: d.id,
                    bulan: bulanNama,
                    tahun: tahun,
                    jenis_gaji: d.jenis_gaji,
                    gapok: d.gapok,
                    hadir: d.hadir,
                    lemburJam: d.lemburJam,
                    bonusLembur: d.bonusLembur,
                    menitTelat: d.menitTelat,
                    dendaTelat: d.dendaTelat,
                    bpjs: d.bpjs,
                    tarifPerJam: d.tarifPerJam,
                    jamKerjaTotal: d.jamKerjaTotal,
                    basisGaji: d.basisGaji,
                    bonusCustom: d.bonusCustom || 0,
                    komisiLive: d.komisiLive || 0,
                    komisiLiveSesi: d.komisiLiveSesi || 0,
                    honorSopir: d.honorSopir || 0,
                    honorSopirTrips: d.honorSopirTrips || 0,
                    tunjBensinFull: d.tunjBensinFull || 0,
                    tunjBensinTerbayar: d.tunjBensinTerbayar || 0,
                    tunjKost: d.tunjKost || 0,
                    hariCuti: d.hariCuti || 0,
                    hariIzin: d.hariIzin || 0,
                    potonganIzin: d.potonganIzin || 0,
                    hariPulangCepat: d.hariPulangCepat || 0,
                    potonganPulangCepat: d.potonganPulangCepat || 0,
                    hariMangkir: d.hariMangkir || 0,
                    potonganMangkir: d.potonganMangkir || 0,
                    totalGaji: d.totalGaji
                };
                const res = await api.post(payload);
                if (res && res.success) {
                    sukses++;
                    this.sentMap[String(d.id)] = {
                        userId: String(d.id),
                        timestampDisplay: (res.sent && res.sent.timestampDisplay) || 'baru saja',
                        totalGaji: d.totalGaji,
                        email: t.email
                    };
                } else {
                    gagal++;
                    errors.push(`${d.name}: ${res.error || 'unknown'}`);
                }
            } catch (e) {
                gagal++;
                errors.push(`${d.name}: ${e.message}`);
            }
        }

        // Re-render seluruh tabel
        this.renderTable(this.calculatedData);

        if (btn) { btn.disabled = false; btn.innerHTML = originalText; }

        let summary = `Selesai!\n✅ Sukses: ${sukses}\n${gagal > 0 ? '❌ Gagal: ' + gagal + '\n\n' + errors.slice(0, 5).join('\n') : ''}`;
        alert(summary);
    },

    async sendEmail(id, isResend) {
        const data = this.calculatedData.find(d => String(d.id) === String(id));
        if (!data) return alert("Data tidak ditemukan");

        // Cari email karyawan dari employees list
        const emp = this.employees.find(e => String(e.id) === String(id));
        const email = emp ? String(emp.email || '').trim() : '';
        if (!email || email.indexOf('@') < 0) {
            return alert(`❌ Email karyawan ${data.name} tidak valid: "${email}". Tambahkan email di Data Karyawan dulu.`);
        }

        const confirmMsg = isResend
            ? `⚠️ Kirim ULANG slip gaji ke ${data.name} (${email})?\n\nKaryawan akan menerima slip kedua kali.`
            : `Kirim slip gaji ke ${data.name} (${email})?`;
        if (!confirm(confirmMsg)) return;

        const bulanNama = document.getElementById('payroll-month').options[document.getElementById('payroll-month').selectedIndex].text;
        const tahun = document.getElementById('payroll-year').value;

        const btn = event && event.currentTarget;
        const originalHTML = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

        try {
            const payload = {
                action: 'sendSlipEmail',
                email: email,
                name: data.name,
                id: data.id,
                bulan: bulanNama,
                tahun: tahun,
                jenis_gaji: data.jenis_gaji,
                gapok: data.gapok,
                hadir: data.hadir,
                lemburJam: data.lemburJam,
                bonusLembur: data.bonusLembur,
                menitTelat: data.menitTelat,
                dendaTelat: data.dendaTelat,
                bpjs: data.bpjs,
                tarifPerJam: data.tarifPerJam,
                jamKerjaTotal: data.jamKerjaTotal,
                basisGaji: data.basisGaji,
                bonusCustom: data.bonusCustom || 0,
                tunjBensinFull: data.tunjBensinFull || 0,
                tunjBensinTerbayar: data.tunjBensinTerbayar || 0,
                tunjKost: data.tunjKost || 0,
                hariCuti: data.hariCuti || 0,
                hariIzin: data.hariIzin || 0,
                potonganIzin: data.potonganIzin || 0,
                hariPulangCepat: data.hariPulangCepat || 0,
                potonganPulangCepat: data.potonganPulangCepat || 0,
                hariMangkir: data.hariMangkir || 0,
                potonganMangkir: data.potonganMangkir || 0,
                totalGaji: data.totalGaji
            };
            const res = await api.post(payload);
            if (res && res.success) {
                alert(`✅ ${res.message || 'Slip terkirim ke ' + email}`);
                // Update sentMap supaya row langsung jadi locked
                this.sentMap[String(id)] = {
                    userId: String(id),
                    timestampDisplay: (res.sent && res.sent.timestampDisplay) || 'baru saja',
                    totalGaji: data.totalGaji,
                    email: email
                };
                // Re-render seluruh tabel supaya UI sync
                this.renderTable(this.calculatedData);
            } else {
                alert("❌ Gagal kirim: " + (res.error || "Cek koneksi"));
                if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
        } catch (e) {
            alert("❌ Error: " + e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
        }
    },

    showSlip(id) {
        const data = this.calculatedData.find(d => String(d.id) === String(id));
        if (!data) return;

        const modal = document.getElementById('modal-slip');
        const content = document.getElementById('slip-content');
        const bulanNama = document.getElementById('payroll-month').options[document.getElementById('payroll-month').selectedIndex].text;
        const tahun = document.getElementById('payroll-year').value;

        content.innerHTML = `
            <div id="printable-area" style="padding: 15px; background: white;">
                <div style="text-align:center; border-bottom:2px dashed #334155; padding-bottom:15px; margin-bottom:20px;">
                    <h2 style="margin:0; color:#10b981; letter-spacing: 2px;">PT. BISATANI</h2>
                    <p style="margin:5px 0; color:#64748b; font-size:12px;">SLIP GAJI KARYAWAN PERIODE ${bulanNama.toUpperCase()} ${tahun}</p>
                </div>
                
                <table style="width:100%; border-collapse:collapse; font-size:14px; font-family:'Courier New', Courier, monospace;">
                    <tr><td style="width:140px; padding:5px 0;">NAMA</td><td>: <strong>${data.name.toUpperCase()}</strong></td></tr>
                    <tr><td style="padding:5px 0;">ID KARYAWAN</td><td>: ${data.id}</td></tr>
                    <tr><td style="padding:5px 0;">JENIS PENGGAJIAN</td><td>: <strong>${data.jenis_gaji === 'per_jam' ? 'PER JAM' : 'BULANAN'}</strong></td></tr>
                    <tr><td colspan="2"><hr style="border:0; border-top:1px solid #cbd5e1; margin:15px 0;"></td></tr>

                    ${data.jenis_gaji === 'per_jam' ? `
                    <tr><td style="padding:8px 0;">JAM KERJA</td><td style="text-align:right;">${(data.jamKerjaTotal - data.lemburJam).toFixed(2)}j (${data.hadir} hari hadir)</td></tr>
                    <tr><td style="padding:8px 0;">JAM LEMBUR</td><td style="text-align:right;">${data.lemburJam.toFixed(2)}j</td></tr>
                    <tr><td style="padding:8px 0;">TARIF / JAM</td><td style="text-align:right;">Rp ${data.tarifPerJam.toLocaleString('id-ID')}</td></tr>
                    <tr><td style="padding:8px 0; color:#10b981;"><strong>(=) BASIS GAJI (${data.jamKerjaTotal.toFixed(2)}j)</strong></td><td style="text-align:right; color:#10b981;"><strong>Rp ${data.basisGaji.toLocaleString('id-ID')}</strong></td></tr>
                    <tr><td style="padding:8px 0; color:#ef4444;">(-) POTONGAN BPJS</td><td style="text-align:right; color:#ef4444;">- Rp ${data.bpjs.toLocaleString('id-ID')}</td></tr>
                    ` : `
                    <tr><td style="padding:8px 0;">GAJI POKOK</td><td style="text-align:right;">Rp ${data.gapok.toLocaleString('id-ID')}</td></tr>
                    <tr><td style="padding:8px 0; color:#10b981;">(+) LEMBUR (${data.lemburJam.toFixed(2)}j)</td><td style="text-align:right; color:#10b981;">+ Rp ${data.bonusLembur.toLocaleString('id-ID')}</td></tr>
                    ${data.fleksibel
                        ? `<tr><td style="padding:8px 0; color:#94a3b8;">JAM KERJA</td><td style="text-align:right; color:#94a3b8;">fleksibel (8 jam)</td></tr>`
                        : `<tr><td style="padding:8px 0; color:#ef4444;">(-) DENDA TELAT (${data.menitTelat} Mnt)</td><td style="text-align:right; color:#ef4444;">- Rp ${data.dendaTelat.toLocaleString('id-ID')}</td></tr>`}
                    <tr><td style="padding:8px 0; color:#ef4444;">(-) POTONGAN BPJS</td><td style="text-align:right; color:#ef4444;">- Rp ${data.bpjs.toLocaleString('id-ID')}</td></tr>
                    `}
                    ${Number(data.komisiLive || 0) > 0 ? `
                    <tr><td style="padding:8px 0; color:#0f766e;">(+) KOMISI LIVE (${data.komisiLiveSesi || 0} sesi)</td><td style="text-align:right; color:#0f766e;">+ Rp ${Number(data.komisiLive).toLocaleString('id-ID')}</td></tr>
                    ` : ''}
                    ${Number(data.honorSopir || 0) > 0 ? `
                    <tr><td style="padding:8px 0; color:#0369a1;">(+) HONOR SOPIR (${data.honorSopirTrips || 0} berangkat)</td><td style="text-align:right; color:#0369a1;">+ Rp ${Number(data.honorSopir).toLocaleString('id-ID')}</td></tr>
                    ` : ''}
                    ${Number(data.bonusCustom || 0) > 0 ? `
                    <tr><td style="padding:8px 0; color:#854d0e;">(+) BONUS CUSTOM</td><td style="text-align:right; color:#854d0e;">+ Rp ${Number(data.bonusCustom).toLocaleString('id-ID')}</td></tr>
                    ` : ''}
                    ${Number(data.tunjBensinTerbayar || 0) > 0 ? `
                    <tr><td style="padding:8px 0; color:#ea580c;">(+) TUNJANGAN BENSIN</td><td style="text-align:right; color:#ea580c;">+ Rp ${Number(data.tunjBensinTerbayar).toLocaleString('id-ID')}</td></tr>
                    ` : ''}
                    ${Number(data.tunjKost || 0) > 0 ? `
                    <tr><td style="padding:8px 0; color:#ea580c;">(+) TUNJANGAN KOST</td><td style="text-align:right; color:#ea580c;">+ Rp ${Number(data.tunjKost).toLocaleString('id-ID')}</td></tr>
                    ` : ''}
                    ${Number(data.potonganIzin || 0) > 0 ? `
                    <tr><td style="padding:8px 0; color:#ef4444;">(-) POTONGAN IZIN (${data.hariIzin || 0} hr)</td><td style="text-align:right; color:#ef4444;">- Rp ${Number(data.potonganIzin).toLocaleString('id-ID')}</td></tr>
                    ` : ''}
                    ${Number(data.potonganPulangCepat || 0) > 0 ? `
                    <tr><td style="padding:8px 0; color:#ef4444;">(-) POTONGAN PULANG CEPAT (${data.hariPulangCepat || 0} hr)</td><td style="text-align:right; color:#ef4444;">- Rp ${Number(data.potonganPulangCepat).toLocaleString('id-ID')}</td></tr>
                    ` : ''}
                    ${Number(data.potonganMangkir || 0) > 0 ? `
                    <tr><td style="padding:8px 0; color:#ef4444;">(-) POTONGAN MANGKIR (${data.hariMangkir || 0} hr)</td><td style="text-align:right; color:#ef4444;">- Rp ${Number(data.potonganMangkir).toLocaleString('id-ID')}</td></tr>
                    ` : ''}

                    <tr><td colspan="2"><hr style="border:0; border-top:2px solid #1e293b; margin:15px 0;"></td></tr>
                    <tr style="font-weight:bold; font-size:18px;">
                        <td style="color:#1e293b; padding:10px 0;">TOTAL BERSIH</td>
                        <td style="text-align:right; color:#166534; padding:10px 0;">Rp ${data.totalGaji.toLocaleString('id-ID')}</td>
                    </tr>
                </table>

                <div style="margin-top:30px; text-align:center; font-size:11px; color:#94a3b8;">
                    Terima kasih atas dedikasi Anda.<br>
                    Dicetak pada: ${new Date().toLocaleString('id-ID')}
                </div>
            </div>

            <div style="margin-top:25px; display:flex; gap:12px;" class="no-print">
                <button onclick="window.print()" style="flex:1; background:#10b981; color:white; border:none; padding:12px; border-radius:10px; cursor:pointer; font-weight:700;">
                    <i class="fas fa-print"></i> CETAK PDF
                </button>
                <button onclick="document.getElementById('modal-slip').style.display='none'" style="flex:1; background:#f1f5f9; color:#475569; border:none; padding:12px; border-radius:10px; cursor:pointer;">
                    <i class="fas fa-times"></i> TUTUP
                </button>
            </div>
        `;
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

window.payroll = payroll;
