/**
 * Portal Karyawan - Admin Dashboard PT. BISATANI
 */
const adminDashboard = {
    init() {
        console.log("AdminDashboard: Mengambil data statistik...");
        this.renderAll();
    },

    async renderAll() {
        try {
            // 1. Ambil Semua Data Master
            const [resEmp, resAtt, resCfg] = await Promise.all([
                api.post({ action: 'getEmployees' }),
                api.post({ action: 'getAllAttendanceData' }),
                api.post({ action: 'getSettings' })
            ]);

            if (!resEmp.success || !resAtt.success) return;

            const employees = resEmp.data || [];
            const attendance = resAtt.data || [];
            const config = resCfg.data || {};

            // --- A. TOTAL KARYAWAN ---
            document.getElementById('dash-total-emp').textContent = employees.length;

            // --- B. HADIR HARI INI ---
            const todayStr = new Date().toISOString().split('T')[0];
            const hadirHariIni = attendance.filter(a => 
                a.type === 'MASUK' && 
                new Date(a.timestamp).toISOString().split('T')[0] === todayStr
            ).length;
            document.getElementById('dash-total-presence').textContent = hadirHariIni;

            // --- C. HITUNG ESTIMASI GAJI & LEMBUR (Periode 26 - 25) ---
            const now = new Date();
            const startPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 26, 0, 0, 0);
            const endPeriod = new Date(now.getFullYear(), now.getMonth(), 25, 23, 59, 59);

            let totalPayrollNominal = 0;
            let totalOvertimeSum = 0;

            employees.forEach(emp => {
                // Filter absensi user ini di periode ini
                const logs = attendance.filter(a => {
                    const t = new Date(a.timestamp);
                    return String(a.userId) === String(emp.id) && t >= startPeriod && t <= endPeriod;
                });

                // Hitung Jam Lembur & Denda Telat
                let jamLembur = 0;
                let telatKali = 0;
                const jamMasukKantor = config.jam_masuk || "08:00";

                logs.forEach(l => {
                    if (l.type === 'SELESAI_LEMBUR') jamLembur += parseFloat(l.totalHours || 0);
                    if (l.type === 'MASUK') {
                        const jamUser = new Date(l.timestamp).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' });
                        if (jamUser > jamMasukKantor) telatKali++;
                    }
                });

                const gapok = parseInt(emp.gaji_pokok || 0);
                const bonus = jamLembur * parseInt(config.overtime_rate || 0);
                const denda = telatKali * parseInt(config.late_rate || 0);
                const bpjs = parseInt(emp.bpjs || 0);

                totalPayrollNominal += (gapok + bonus) - (denda + bpjs);
                totalOvertimeSum += jamLembur;
            });

            document.getElementById('dash-total-payroll').textContent = "Rp " + totalPayrollNominal.toLocaleString('id-ID');
            document.getElementById('dash-total-overtime').innerHTML = totalOvertimeSum.toFixed(1) + ' <small style="font-size: 14px;">jam</small>';

            // --- D. AKTIVITAS TERBARU (5 Baris) ---
            const recentContainer = document.getElementById('dash-recent-list');
            const recentData = attendance.slice(-5).reverse(); // Ambil 5 data paling bawah di sheet

            if (recentData.length === 0) {
                recentContainer.innerHTML = '<p style="color:#94a3b8; font-size:13px; text-align:center;">Belum ada absensi.</p>';
            } else {
                recentContainer.innerHTML = recentData.map(r => `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${r.type === 'MASUK' ? '#10b981' : '#f43f5e'};"></div>
                            <div>
                                <span style="font-size: 13px; font-weight: 600; color: #1e293b;">${r.userName || r.userId}</span><br>
                                <small style="color: #64748b;">${r.type}</small>
                            </div>
                        </div>
                        <span style="font-size: 12px; color: #94a3b8;">${new Date(r.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                `).join('');
            }

        } catch (e) {
            console.error("Dashboard Error:", e);
        }
    }
};

window.adminDashboard = adminDashboard;
