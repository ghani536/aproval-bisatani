/**
 * Portal Admin - Settings PT. BISATANI
 * Konfigurasi sistem: jam kerja, penggajian, kuota cuti rule, hari libur,
 * branding, maintenance.
 */
const settings = {
    data: {},
    holidays: [],
    _holidayEditId: null,

    async init() {
        await this.loadSettings();
        this.bindEvents();
        this.setupCutiPreview();
        await this.loadHolidaysFilter();
        await this.loadHolidays();
    },

    switchTab(tab) {
        const sections = ['jam', 'payroll', 'cuti', 'libur', 'brand', 'maint'];
        sections.forEach(s => {
            const el = document.getElementById('set-sec-' + s);
            if (el) el.style.display = (s === tab) ? 'block' : 'none';
        });
        document.querySelectorAll('.set-tab-btn').forEach(b => {
            const isActive = b.getAttribute('data-set-tab') === tab;
            b.style.background = isActive ? '#10b981' : 'transparent';
            b.style.color = isActive ? 'white' : '#64748b';
        });
    },

    async loadSettings() {
        try {
            const res = await api.post({ action: 'getSettings' });
            if (res && res.success) {
                this.data = res.data || {};
                this.fillForm();
            }
        } catch (e) {
            console.error("Koneksi gagal:", e);
        }
    },

    _get(key, fallback) {
        // getSettingsData di GAS membersihkan key (lowercase, strip _). Coba beberapa varian.
        const v = this.data[key]
            || this.data[key.replace(/_/g, '')]
            || this.data[key.toLowerCase()]
            || this.data[key.toLowerCase().replace(/_/g, '')];
        return (v !== undefined && v !== null && v !== '') ? v : fallback;
    },

    fillForm() {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val == null ? '' : val; };
        const setTime = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!val) { el.value = ''; return; }
            let s = String(val).replace(/[^0-9:]/g, '');
            if (s.includes(':')) {
                const [h, m] = s.split(':');
                el.value = h.padStart(2, '0') + ':' + (m || '00').padStart(2, '0').substring(0, 2);
            }
        };

        // Tab Jam Kerja
        setTime('set-jam-masuk', this._get('jam_masuk', ''));
        setTime('set-jam-pulang', this._get('jam_pulang', ''));
        setTime('set-jam-lembur-min', this._get('jam_lembur_min', ''));
        setVal('set-toleransi-telat', this._get('toleransi_telat_menit', 0));
        const cbOt = document.getElementById('set-ot-anytime');
        if (cbOt) cbOt.checked = String(this._get('allow_overtime_anytime', false)) === 'true';

        // Tab Penggajian
        setVal('set-overtime-rate', this._get('overtime_rate', 0));
        setVal('set-hari-kerja', this._get('hari_kerja_per_bulan', 25));
        setVal('set-jam-kerja', this._get('jam_kerja_per_hari', 8));
        setVal('set-periode-start', this._get('periode_start_day', 26));

        // Tab Cuti
        setVal('set-kuota-min-bulan', this._get('kuota_masa_kerja_min_bulan', 12));
        setVal('set-kuota-standar', this._get('kuota_cuti_standar', 7));
        setVal('set-loyalty-min-bulan', this._get('kuota_loyalty_min_bulan', 36));
        setVal('set-kuota-loyalty', this._get('kuota_cuti_loyalty', 12));
        this.updateCutiPreview();

        // Tab Branding
        setVal('set-nama-perusahaan', this._get('nama_perusahaan', 'PT. Bisatani'));
        setVal('set-alamat', this._get('alamat_perusahaan', ''));
        setVal('set-logo-url', this._get('logo_url', ''));
        setVal('set-email-sender', this._get('email_sender_name', 'PT. Bisatani Payroll'));
    },

    setupCutiPreview() {
        const ids = ['set-kuota-min-bulan', 'set-kuota-standar', 'set-loyalty-min-bulan', 'set-kuota-loyalty'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el._previewBound) {
                el.addEventListener('input', () => this.updateCutiPreview());
                el._previewBound = true;
            }
        });
    },

    updateCutiPreview() {
        const minBulan = parseInt(document.getElementById('set-kuota-min-bulan')?.value) || 0;
        const standar = parseInt(document.getElementById('set-kuota-standar')?.value) || 0;
        const loyaltyMin = parseInt(document.getElementById('set-loyalty-min-bulan')?.value) || 0;
        const loyalty = parseInt(document.getElementById('set-kuota-loyalty')?.value) || 0;
        const out = document.getElementById('set-cuti-preview');
        if (!out) return;
        out.innerHTML = `<b>Rumus aktif:</b><br>
            • Masa kerja < ${minBulan} bulan → <b>0 hari</b><br>
            • Masa kerja ${minBulan}–${loyaltyMin - 1} bulan → <b>${standar} hari/tahun</b><br>
            • Masa kerja ≥ ${loyaltyMin} bulan → <b>${loyalty} hari/tahun</b>`;
    },

    bindEvents() {
        const btnSave = document.getElementById('btn-save-settings');
        if (btnSave && !btnSave._bound) {
            btnSave.onclick = () => this.saveAll();
            btnSave._bound = true;
        }
    },

    async saveAll() {
        const btn = document.getElementById('btn-save-settings');
        const originalHTML = btn.innerHTML;
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

            const val = (id) => document.getElementById(id)?.value || '';
            const payload = {
                action: 'savePayrollSettings',
                jam_masuk: val('set-jam-masuk'),
                jam_pulang: val('set-jam-pulang'),
                jam_lembur_min: val('set-jam-lembur-min'),
                toleransi_telat_menit: val('set-toleransi-telat'),
                allow_overtime_anytime: document.getElementById('set-ot-anytime')?.checked || false,
                overtime_rate: val('set-overtime-rate'),
                hari_kerja_per_bulan: val('set-hari-kerja'),
                jam_kerja_per_hari: val('set-jam-kerja'),
                periode_start_day: val('set-periode-start'),
                kuota_masa_kerja_min_bulan: val('set-kuota-min-bulan'),
                kuota_cuti_standar: val('set-kuota-standar'),
                kuota_loyalty_min_bulan: val('set-loyalty-min-bulan'),
                kuota_cuti_loyalty: val('set-kuota-loyalty'),
                nama_perusahaan: val('set-nama-perusahaan'),
                alamat_perusahaan: val('set-alamat'),
                logo_url: val('set-logo-url'),
                email_sender_name: val('set-email-sender')
            };

            const res = await api.post(payload);
            if (res && res.success) {
                alert('✅ Pengaturan tersimpan!');
                await this.loadSettings();
            } else {
                alert('❌ Gagal: ' + ((res && res.error) || 'cek koneksi'));
            }
        } catch (e) {
            alert('❌ Error: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    },

    // ============ HOLIDAYS ============

    async loadHolidaysFilter() {
        const sel = document.getElementById('libur-tahun-filter');
        if (!sel || sel.options.length > 0) return;
        const now = new Date().getFullYear();
        for (let y = now + 1; y >= now - 2; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === now) opt.selected = true;
            sel.appendChild(opt);
        }
    },

    async loadHolidays() {
        const wrap = document.getElementById('libur-list');
        if (!wrap) return;
        wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:13px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        const tahun = document.getElementById('libur-tahun-filter')?.value;
        try {
            const res = await api.post({ action: 'getHolidays', tahun: tahun });
            if (!res || !res.success) {
                wrap.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px; font-size:13px;">Gagal: ${(res && res.error) || 'cek koneksi'}</div>`;
                return;
            }
            this.holidays = res.data || [];
            this.renderHolidays();
        } catch (e) {
            wrap.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px; font-size:13px;">Error: ${e.message}</div>`;
        }
    },

    renderHolidays() {
        const wrap = document.getElementById('libur-list');
        if (!wrap) return;
        if (this.holidays.length === 0) {
            wrap.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px; font-size:13px;">Belum ada hari libur untuk tahun ini. Klik <b>Tambah</b> untuk mulai.</div>';
            return;
        }
        const namaHari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        wrap.innerHTML = this.holidays.map(h => {
            const d = new Date(h.tanggal + 'T00:00:00');
            const isPast = d < new Date(new Date().setHours(0, 0, 0, 0));
            const dayName = namaHari[d.getDay()];
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:${isPast ? '#f8fafc' : '#fffbeb'}; border-radius:8px; margin-bottom:6px; ${isPast ? 'opacity:0.7;' : ''}">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="background:${isPast ? '#cbd5e1' : '#f59e0b'}; color:white; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">${dayName}, ${d.getDate()}</div>
                    <div>
                        <div style="font-size:13px; font-weight:600; color:#1e293b;">${String(h.nama_libur).replace(/</g, '&lt;')}</div>
                        <div style="font-size:11px; color:#64748b;">${h.tanggal}</div>
                    </div>
                </div>
                <button onclick="settings.deleteHoliday(${h.id})" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600;"><i class="fas fa-trash"></i></button>
            </div>`;
        }).join('');
    },

    openHolidayForm() {
        this._holidayEditId = null;
        document.getElementById('lib-tanggal').value = '';
        document.getElementById('lib-nama').value = '';
        document.getElementById('modal-holiday').style.display = 'flex';
    },

    async saveHoliday() {
        const tgl = document.getElementById('lib-tanggal').value;
        const nama = document.getElementById('lib-nama').value.trim();
        if (!tgl || !nama) { alert('Tanggal & nama wajib diisi'); return; }
        try {
            const user = auth.user || {};
            const res = await api.post({
                action: 'saveHoliday',
                tanggal: tgl,
                nama_libur: nama,
                dibuat_oleh: user.name || user.nama || 'admin'
            });
            if (res && res.success) {
                document.getElementById('modal-holiday').style.display = 'none';
                // Jika tanggal di luar tahun filter saat ini, ganti filter
                const tglYear = String(tgl).substring(0, 4);
                const filter = document.getElementById('libur-tahun-filter');
                if (filter && filter.value !== tglYear) {
                    // Tambah option kalau belum ada
                    if (![...filter.options].some(o => o.value === tglYear)) {
                        const opt = document.createElement('option');
                        opt.value = tglYear; opt.textContent = tglYear;
                        filter.appendChild(opt);
                    }
                    filter.value = tglYear;
                }
                await this.loadHolidays();
            } else {
                alert('❌ ' + ((res && res.error) || 'gagal simpan'));
            }
        } catch (e) {
            alert('❌ Error: ' + e.message);
        }
    },

    async deleteHoliday(id) {
        const h = this.holidays.find(x => x.id === id);
        if (!h) return;
        if (!confirm(`Hapus hari libur "${h.nama_libur}" (${h.tanggal})?`)) return;
        try {
            const res = await api.post({ action: 'deleteHoliday', id: id });
            if (res && res.success) {
                this.loadHolidays();
            } else {
                alert('❌ ' + ((res && res.error) || 'gagal hapus'));
            }
        } catch (e) {
            alert('❌ Error: ' + e.message);
        }
    },

    // ============ MAINTENANCE ============

    async backupAll() {
        if (!confirm('Download semua data dari spreadsheet sebagai CSV terpisah (multi-file)?\n\nProses bisa 10-30 detik tergantung jumlah data.')) return;
        const btn = event && event.currentTarget;
        const originalHTML = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat...'; }
        try {
            const [resEmp, resAtt, resPengajuan, resPayroll, resHol] = await Promise.all([
                api.post({ action: 'getEmployees' }),
                api.post({ action: 'getAllAttendanceData' }),
                api.post({ action: 'getAllPengajuan' }),
                api.post({ action: 'getPayrollSentLog', bulan: '', tahun: '' }),
                api.post({ action: 'getHolidays' })
            ]);
            const ts = new Date().toISOString().slice(0, 10);
            this._downloadCSV(`Backup_Employees_${ts}.csv`, resEmp.data || []);
            this._downloadCSV(`Backup_Attendance_${ts}.csv`, resAtt.data || []);
            this._downloadCSV(`Backup_Pengajuan_${ts}.csv`, resPengajuan.data || []);
            this._downloadCSV(`Backup_PayrollSent_${ts}.csv`, (resPayroll && resPayroll.data) || []);
            this._downloadCSV(`Backup_Holidays_${ts}.csv`, resHol.data || []);
            this._downloadCSV(`Backup_Settings_${ts}.csv`, Object.entries(this.data).map(([k, v]) => ({ key: k, value: v })));
            alert('✅ 6 file CSV ter-download. Cek folder Downloads.');
        } catch (e) {
            alert('❌ Backup gagal: ' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
        }
    },

    _downloadCSV(filename, rows) {
        if (!rows || rows.length === 0) return;
        const headers = Object.keys(rows[0]);
        const esc = v => {
            const s = String(v == null ? '' : v);
            return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = '﻿' + [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    },

    clearLocalCache() {
        if (!confirm('Hapus semua cache localStorage di browser ini?\n\nIni akan menghapus:\n• Bonus payroll draft\n• Settings cache\n• Session info (KECUALI login yang sedang aktif)\n\nData di spreadsheet TIDAK terhapus.')) return;
        const keepLogin = localStorage.getItem('user') || localStorage.getItem('auth_user');
        const currentPage = localStorage.getItem('currentPage');
        localStorage.clear();
        if (keepLogin) localStorage.setItem('user', keepLogin);
        if (currentPage) localStorage.setItem('currentPage', currentPage);
        alert('✅ Cache cleared. Refresh halaman untuk efek penuh.');
    },

    openResetPwd() {
        if (router) router.navigate('employees');
        setTimeout(() => alert('Buka karyawan yang mau direset → tombol Edit → kosongkan field Password lalu simpan. Backend akan default ke ID karyawan.'), 300);
    }
};

window.settings = settings;
