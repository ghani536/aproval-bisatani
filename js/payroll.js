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

    // Bonus custom per (tahun, bulan, empId) disimpan di localStorage
    bonusKey(year, month) {
        return `bisatani_bonus_${year}_${month}`;
    },
    loadBonusMap() {
        try {
            const month = parseInt(document.getElementById('payroll-month').value);
            const year = parseInt(document.getElementById('payroll-year').value);
            const raw = localStorage.getItem(this.bonusKey(year, month));
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    },
    saveBonusMap(map) {
        try {
            const month = parseInt(document.getElementById('payroll-month').value);
            const year = parseInt(document.getElementById('payroll-year').value);
            localStorage.setItem(this.bonusKey(year, month), JSON.stringify(map));
        } catch (e) {}
    },
    setBonus(empId, amount) {
        const map = this.loadBonusMap();
        const num = parseFloat(String(amount).replace(/[^\d.-]/g, '')) || 0;
        if (num > 0) map[empId] = num;
        else delete map[empId];
        this.saveBonusMap(map);
        // Update calculated data + total
        const row = this.calculatedData.find(d => String(d.id) === String(empId));
        if (row) {
            row.bonusCustom = num;
            row.totalGaji = this.computeFinalTotal(row);
            // Re-render only this row's total cell (in-place update)
            this.refreshTotalCell(empId, row.totalGaji);
        }
    },
    refreshTotalCell(empId, total) {
        const cell = document.querySelector(`[data-total-id="${empId}"]`);
        if (cell) cell.textContent = `Rp ${Number(total).toLocaleString('id-ID')}`;
    },
    computeFinalTotal(p) {
        const bonus = parseFloat(p.bonusCustom || 0);
        if (p.jenis_gaji === 'per_jam') {
            return p.basisGaji - p.bpjs + bonus;
        }
        return (p.gapok + p.bonusLembur + bonus) - (p.bpjs + p.dendaTelat);
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

            const [resEmp, resCfg, resAtt, resSent] = await Promise.all([
                api.post({ action: 'getEmployees' }),
                api.post({ action: 'getSettings' }),
                api.post({ action: 'getAllAttendanceData' }),
                api.post({ action: 'getPayrollSentLog', bulan: bulanNama, tahun: String(year) })
            ]);

            this.sentMap = {};
            if (resSent && resSent.success && Array.isArray(resSent.data)) {
                resSent.data.forEach(s => { this.sentMap[String(s.userId)] = s; });
            }

            this.employees = resEmp.data || [];
            this.attendance = resAtt.data || [];
            this.config = resCfg.data || {};

            const startDate = new Date(year, month - 1, 26, 0, 0, 0);
            const endDate = new Date(year, month, 25, 23, 59, 59);

            this.calculatedData = this.employees.map(emp => this.calculateSingleEmployee(emp, startDate, endDate));
            // Apply bonus custom dari localStorage ke calculatedData + recalc total
            const bonusMap = this.loadBonusMap();
            this.calculatedData.forEach(row => {
                row.bonusCustom = parseFloat(bonusMap[row.id] || 0);
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

    calculateSingleEmployee(emp, start, end) {
        const userLogs = this.attendance.filter(a => {
            const tgl = new Date(a.timestamp);
            return String(a.userId) === String(emp.id) && tgl >= start && tgl <= end;
        });

        const tarifLembur = parseInt(this.config.overtime_rate || 10000);
        const gajiPokok = parseFloat(emp.gaji_pokok || 0);
        const tarifPerJam = parseFloat(emp.tarif_per_jam || 0);
        const isPerJam = (emp.jenis_gaji === 'per_jam');
        let dendaPerMenit = parseFloat(emp.dendatelat || 0);

        if (dendaPerMenit <= 0 && gajiPokok > 0) {
            dendaPerMenit = Math.round(gajiPokok / 25 / 8 / 60);
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
        const nominalDenda = Math.round(totalMenitTelat * dendaPerMenit);

        let totalGaji;
        let basisGaji;
        let jamKerjaTotal = 0;

        if (isPerJam) {
            // Per jam: total_jam = (hari_hadir × 8) + jam_lembur; gaji = total_jam × tarif_per_jam
            jamKerjaTotal = (hadirCount * 8) + jamLemburTotal;
            basisGaji = Math.round(jamKerjaTotal * tarifPerJam);
            totalGaji = basisGaji - bpjs;
        } else {
            basisGaji = gajiPokok;
            totalGaji = (gajiPokok + bonusLembur) - (bpjs + nominalDenda);
        }

        return {
            id: emp.id,
            name: emp.name,
            jenis_gaji: isPerJam ? 'per_jam' : 'bulanan',
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
            totalGaji: totalGaji
        };
    },

    renderTable(data) {
        const tbody = document.getElementById('payroll-table-body');
        if (!tbody) return;
        tbody.innerHTML = data.map(p => {
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
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <span style="background:#dcfce7; color:#166534; padding:3px 8px; border-radius:10px; font-size:10px; font-weight:700;">
                        <i class="fas fa-check-circle"></i> TERKIRIM
                    </span>
                    <small style="color:#64748b; font-size:10px;">${sent.timestampDisplay || ''}</small>
                    <div style="display:flex; gap:4px;">
                        <button onclick="payroll.showSlip('${p.id}')" title="Lihat slip"
                            style="background:#94a3b8; color:white; border:none; padding:5px 8px; border-radius:6px; cursor:pointer; font-size:11px;">
                            <i class="fas fa-file-invoice"></i>
                        </button>
                        <button onclick="payroll.sendEmail('${p.id}', true)" title="Kirim ulang slip"
                            style="background:#f59e0b; color:white; border:none; padding:5px 8px; border-radius:6px; cursor:pointer; font-size:11px;">
                            <i class="fas fa-redo"></i>
                        </button>
                    </div>
                </div>` : `
                <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                    <button onclick="payroll.showSlip('${p.id}')" title="Lihat / Cetak Slip"
                        style="background:#6366f1; color:white; border:none; padding:7px 10px; border-radius:6px; cursor:pointer; font-size:12px;">
                        <i class="fas fa-file-invoice"></i>
                    </button>
                    <button onclick="payroll.sendEmail('${p.id}')" title="Kirim slip via email"
                        style="background:#10b981; color:white; border:none; padding:7px 10px; border-radius:6px; cursor:pointer; font-size:12px;">
                        <i class="fas fa-envelope"></i>
                    </button>
                </div>`;

            return `
            <tr style="${rowStyle}">
                <td style="padding:12px;">${lockIcon}<strong>${p.name}</strong><br><small style="color:${isPerJam ? '#6366f1' : '#64748b'};">${isPerJam ? 'PER JAM' : 'BULANAN'} · ID: ${p.id}</small></td>
                <td>${basisCell}</td>
                <td style="text-align:center;">${p.hadir} Hari</td>
                <td style="text-align:center; font-weight:bold; color:#2563eb;">${p.lemburJam.toFixed(2)}j</td>
                <td style="color:#10b981; font-weight:600;">${isPerJam ? '<small>(incl. di basis)</small>' : '+' + p.bonusLembur.toLocaleString('id-ID')}</td>
                <td style="color:#ef4444;">${isPerJam ? '<small>n/a</small>' : '-' + p.dendaTelat.toLocaleString('id-ID') + '<br><small>(' + p.menitTelat + ' m)</small>'}</td>
                <td style="color:#ef4444;">-${p.bpjs.toLocaleString('id-ID')}</td>
                <td style="background:${isSent ? '#f1f5f9' : '#fef9c3'}; padding:6px;">${bonusInput}</td>
                <td data-total-id="${p.id}" style="background:#f0fdf4; font-weight:700; color:#166534;">Rp ${p.totalGaji.toLocaleString('id-ID')}</td>
                <td style="text-align:center;">${aksiCell}</td>
            </tr>
        `; }).join('');
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
                    <tr><td style="padding:8px 0;">JAM KERJA</td><td style="text-align:right;">${(data.hadir*8).toFixed(0)}j (${data.hadir} hari × 8j)</td></tr>
                    <tr><td style="padding:8px 0;">JAM LEMBUR</td><td style="text-align:right;">${data.lemburJam.toFixed(2)}j</td></tr>
                    <tr><td style="padding:8px 0;">TARIF / JAM</td><td style="text-align:right;">Rp ${data.tarifPerJam.toLocaleString('id-ID')}</td></tr>
                    <tr><td style="padding:8px 0; color:#10b981;"><strong>(=) BASIS GAJI (${data.jamKerjaTotal.toFixed(2)}j)</strong></td><td style="text-align:right; color:#10b981;"><strong>Rp ${data.basisGaji.toLocaleString('id-ID')}</strong></td></tr>
                    <tr><td style="padding:8px 0; color:#ef4444;">(-) POTONGAN BPJS</td><td style="text-align:right; color:#ef4444;">- Rp ${data.bpjs.toLocaleString('id-ID')}</td></tr>
                    ` : `
                    <tr><td style="padding:8px 0;">GAJI POKOK</td><td style="text-align:right;">Rp ${data.gapok.toLocaleString('id-ID')}</td></tr>
                    <tr><td style="padding:8px 0; color:#10b981;">(+) LEMBUR (${data.lemburJam.toFixed(2)}j)</td><td style="text-align:right; color:#10b981;">+ Rp ${data.bonusLembur.toLocaleString('id-ID')}</td></tr>
                    <tr><td style="padding:8px 0; color:#ef4444;">(-) DENDA TELAT (${data.menitTelat} Mnt)</td><td style="text-align:right; color:#ef4444;">- Rp ${data.dendaTelat.toLocaleString('id-ID')}</td></tr>
                    <tr><td style="padding:8px 0; color:#ef4444;">(-) POTONGAN BPJS</td><td style="text-align:right; color:#ef4444;">- Rp ${data.bpjs.toLocaleString('id-ID')}</td></tr>
                    `}
                    ${Number(data.bonusCustom || 0) > 0 ? `
                    <tr><td style="padding:8px 0; color:#854d0e;">(+) BONUS CUSTOM</td><td style="text-align:right; color:#854d0e;">+ Rp ${Number(data.bonusCustom).toLocaleString('id-ID')}</td></tr>
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
