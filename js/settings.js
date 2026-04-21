const settings = {
    data: {},

    async init() {
        console.log("Settings: Menghubungkan ke Google Sheets...");
        await this.loadSettings();
        this.bindEvents();
    },

    async loadSettings() {
        try {
            // Kita pakai api.get karena lebih stabil untuk tarik data
            const res = await api.get('getSettings');
            console.log("Respon Mentah dari Google:", res);

            if (res && res.success) {
                // Pastikan data tersimpan di variabel global settings
                this.data = res.data || {};
                this.fillForm();
            } else {
                console.error("Google Sheets menolak permintaan atau data kosong.");
            }
        } catch (e) {
            console.error("Koneksi ke API Gagal:", e);
        }
    },

    fillForm() {
        // Pemetaan ID HTML : Key di Google Sheets
        const fields = {
            'set-jam-masuk': 'jam_masuk',
            'set-jam-pulang': 'jam_pulang',
            'set-jam-lembur-min': 'jam_lembur_min',
            'set-overtime-rate': 'overtime_rate'
        };

        for (let id in fields) {
            const el = document.getElementById(id);
            const key = fields[id];
            let val = this.data[key];

            if (el) {
                if (val === undefined || val === null || val === "") {
                    el.value = "";
                    continue;
                }

                // Jika input adalah tipe jam (TIME)
                if (el.type === 'time') {
                    // BERSIHKAN DATA: Ambil hanya angka dan titik dua (misal: "08:00")
                    let cleanTime = String(val).replace(/[^0-9:]/g, "");
                    
                    // Jika formatnya 7:30, ubah jadi 07:30 (WAJIB 5 karakter)
                    if (cleanTime.includes(":")) {
                        let parts = cleanTime.split(":");
                        let jam = parts[0].padStart(2, '0');
                        let menit = parts[1].padStart(2, '0').substring(0, 2);
                        el.value = jam + ":" + menit;
                    }
                } else {
                    // Untuk angka (Nominal)
                    el.value = val;
                }
                console.log(`✅ ID ${id} berhasil diisi: ${el.value}`);
            }
        }

        // Checkbox Khusus Lembur
        const cb = document.getElementById('set-ot-anytime');
        if (cb) {
            cb.checked = (String(this.data.allow_overtime_anytime) === "true");
        }
    },

    bindEvents() {
        const btnSave = document.getElementById('btn-save-settings');
        if (btnSave) {
            btnSave.onclick = () => this.saveWorkTime();
        }
    },

    async saveWorkTime() {
        const btn = document.getElementById('btn-save-settings');
        const originalHTML = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

            const payload = {
                action: 'savePayrollSettings',
                jam_masuk: document.getElementById('set-jam-masuk').value,
                jam_pulang: document.getElementById('set-jam-pulang').value,
                jam_lembur_min: document.getElementById('set-jam-lembur-min').value,
                overtime_rate: document.getElementById('set-overtime-rate').value,
                allow_overtime_anytime: document.getElementById('set-ot-anytime').checked
            };

            const res = await api.post(payload);
            alert("✅ Sukses! Pengaturan PT. BISATANI diperbarui.");
            await this.loadSettings(); // Refresh tampilan
        } catch (e) {
            alert("❌ Gagal menyimpan. Cek koneksi internet.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }
};

window.settings = settings;
