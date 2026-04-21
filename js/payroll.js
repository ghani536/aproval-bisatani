/**
 * js/payroll.js - PT. BISATANI
 * Versi Final: Fix Desimal Lembur (Anti Pembulatan ke 0.0)
 */
const payroll = {
    config: {},
    employees: [],
    attendance: [],
    calculatedData: [],

    init() {
        const yearInput = document.getElementById('payroll-year');
        const monthInput = document.getElementById('payroll-month');
        if (yearInput) yearInput.value = new Date().getFullYear();
        if (monthInput) monthInput.value = new Date().getMonth(); 
    },

    async calculate() {
        const btn = document.querySelector('button[onclick="payroll.calculate()"]');
        const tbody = document.getElementById('payroll-table-body');
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px;"><i class="fas fa-sync fa-spin"></i> Sinkronisasi data...</td></tr>';

            const month = parseInt(document.getElementById('payroll-month').value);
            const year = parseInt(document.getElementById('payroll-year').value);

            const [resEmp, resCfg, resAtt] = await Promise.all([
                api.post({ action: 'getEmployees' }),
                api.post({ action: 'getSettings' }),
                api.post({ action: 'getAllAttendanceData' })
            ]);

            this.employees = resEmp.data || [];
            this.attendance = resAtt.data || [];
            this.config = resCfg.data || {};

            const startDate = new Date(year, month - 1, 26, 0, 0, 0);
            const endDate = new Date(year, month, 25, 23, 59, 59);

            this.calculatedData = this.employees.map(emp => this.calculateSingleEmployee(emp, startDate, endDate));
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
        let dendaPerMenit = parseFloat(emp.dendatelat || 0);

        if (dendaPerMenit <= 0 && gajiPokok > 0) {
            dendaPerMenit = Math.round(gajiPokok / 25 / 8 / 60);
        }

        let hadirCount = 0;
        let totalMenitTelat = 0;
        let jamLemburTotal = 0;

        userLogs.forEach(log => {
            if (log.type === 'MASUK') {
                hadirCount++;
                if (log.statusTelat && log.statusTelat !== "0" && log.statusTelat !== "-") {
                    totalMenitTelat += parseInt(log.statusTelat) || 0;
                }
            }
            // FORCE PARSE DECIMAL: Mengatasi 0.03j agar tidak hilang
            if (log.type === 'SELESAI_LEMBUR') {
                let jamRaw = String(log.totalHours || "0").replace(',', '.');
                jamLemburTotal += parseFloat(jamRaw);
            }
        });

        const bpjs = parseInt(emp.bpjs || 0);
        const bonusLembur = Math.round(jamLemburTotal * tarifLembur);
        const nominalDenda = Math.round(totalMenitTelat * dendaPerMenit);
        const totalGaji = (gajiPokok + bonusLembur) - (bpjs + nominalDenda);

        return {
            id: emp.id,
            name: emp.name,
            gapok: gajiPokok,
            hadir: hadirCount,
            lemburJam: jamLemburTotal,
            bonusLembur: bonusLembur,
            menitTelat: totalMenitTelat,
            dendaTelat: nominalDenda,
            bpjs: bpjs,
            totalGaji: totalGaji
        };
    },

    renderTable(data) {
        const tbody = document.getElementById('payroll-table-body');
        if (!tbody) return;
        tbody.innerHTML = data.map(p => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:12px;"><strong>${p.name}</strong><br><small style="color:#64748b;">ID: ${p.id}</small></td>
                <td>Rp ${p.gapok.toLocaleString('id-ID')}</td>
                <td style="text-align:center;">${p.hadir} Hari</td>
                <td style="text-align:center; font-weight:bold; color:#2563eb;">${p.lemburJam.toFixed(2)}j</td>
                <td style="color:#10b981; font-weight:600;">+${p.bonusLembur.toLocaleString('id-ID')}</td>
                <td style="color:#ef4444;">-${p.dendaTelat.toLocaleString('id-ID')}<br><small>(${p.menitTelat} m)</small></td>
                <td style="color:#ef4444;">-${p.bpjs.toLocaleString('id-ID')}</td>
                <td style="background:#f0fdf4; font-weight:700; color:#166534;">Rp ${p.totalGaji.toLocaleString('id-ID')}</td>
                <td style="text-align:center;">
                    <button onclick="payroll.showSlip('${p.id}')" style="background:#6366f1; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">
                        <i class="fas fa-file-invoice"></i> Slip
                    </button>
                </td>
            </tr>
        `).join('');
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
                    <tr><td style="width:120px; padding:5px 0;">NAMA</td><td>: <strong>${data.name.toUpperCase()}</strong></td></tr>
                    <tr><td style="padding:5px 0;">ID KARYAWAN</td><td>: ${data.id}</td></tr>
                    <tr><td colspan="2"><hr style="border:0; border-top:1px solid #cbd5e1; margin:15px 0;"></td></tr>
                    
                    <tr><td style="padding:8px 0;">GAJI POKOK</td><td style="text-align:right;">Rp ${data.gapok.toLocaleString('id-ID')}</td></tr>
                    <tr><td style="padding:8px 0; color:#10b981;">(+) LEMBUR (${data.lemburJam.toFixed(2)}j)</td><td style="text-align:right; color:#10b981;">+ Rp ${data.bonusLembur.toLocaleString('id-ID')}</td></tr>
                    <tr><td style="padding:8px 0; color:#ef4444;">(-) DENDA TELAT (${data.menitTelat} Mnt)</td><td style="text-align:right; color:#ef4444;">- Rp ${data.dendaTelat.toLocaleString('id-ID')}</td></tr>
                    <tr><td style="padding:8px 0; color:#ef4444;">(-) POTONGAN BPJS</td><td style="text-align:right; color:#ef4444;">- Rp ${data.bpjs.toLocaleString('id-ID')}</td></tr>
                    
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
