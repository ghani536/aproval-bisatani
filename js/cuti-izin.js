/**
 * Portal Karyawan - Cuti & Izin
 * Form pengajuan + riwayat sendiri + kuota cuti tahunan
 */
const cutiIzin = {
    _items: [],
    _fotoBase64: '',

    init() {
        this.loadQuota();
        this.load();
        this._bindForm();
    },

    _bindForm() {
        const mulai = document.getElementById('ci-mulai');
        const selesai = document.getElementById('ci-selesai');
        const foto = document.getElementById('ci-foto');
        if (mulai && !mulai._bound) {
            mulai.addEventListener('change', () => this._updateHariPreview());
            selesai.addEventListener('change', () => this._updateHariPreview());
            foto.addEventListener('change', (e) => this._handleFoto(e));
            mulai._bound = true;
        }
    },

    _updateHariPreview() {
        const m = document.getElementById('ci-mulai').value;
        const s = document.getElementById('ci-selesai').value;
        const out = document.getElementById('ci-hari-preview');
        if (!m || !s) {
            out.textContent = 'Pilih tanggal untuk lihat jumlah hari';
            out.style.color = '#475569';
            return;
        }
        const d1 = new Date(m), d2 = new Date(s);
        const hari = Math.floor((d2 - d1) / 86400000) + 1;
        if (hari < 1) {
            out.textContent = 'Tanggal selesai harus setelah/sama dengan tanggal mulai';
            out.style.color = '#ef4444';
            return;
        }
        out.innerHTML = `Total: <b>${hari}</b> hari kerja`;
        out.style.color = '#10b981';
    },

    async _handleFoto(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('ci-foto-preview');
        if (!file) { this._fotoBase64 = ''; preview.innerHTML = ''; return; }
        // Compress: max 800px, jpeg quality 0.6 (~50-150KB)
        this._fotoBase64 = await this._compressImage(file, 800, 0.6);
        preview.innerHTML = `<img src="${this._fotoBase64}" style="max-width:120px; max-height:120px; border-radius:6px; border:1px solid #e2e8f0;">
            <button type="button" onclick="cutiIzin._clearFoto()" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px; margin-left:8px;"><i class="fas fa-trash"></i> Hapus</button>`;
    },

    _clearFoto() {
        this._fotoBase64 = '';
        document.getElementById('ci-foto').value = '';
        document.getElementById('ci-foto-preview').innerHTML = '';
    },

    _compressImage(file, maxDim, quality) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let w = img.width, h = img.height;
                    if (w > h && w > maxDim) { h = h * maxDim / w; w = maxDim; }
                    else if (h > maxDim) { w = w * maxDim / h; h = maxDim; }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    openForm() {
        document.getElementById('ci-tipe').value = 'CUTI';
        document.getElementById('ci-mulai').value = '';
        document.getElementById('ci-selesai').value = '';
        document.getElementById('ci-alasan').value = '';
        this._clearFoto();
        document.getElementById('ci-hari-preview').textContent = 'Pilih tanggal untuk lihat jumlah hari';
        document.getElementById('ci-hari-preview').style.color = '#475569';
        const modal = document.getElementById('ci-modal');
        modal.style.display = 'flex';
    },

    closeForm() {
        document.getElementById('ci-modal').style.display = 'none';
    },

    async submit(e) {
        e.preventDefault();
        const btn = document.getElementById('ci-submit-btn');
        const user = auth.user || {};
        const tipe = document.getElementById('ci-tipe').value;
        const mulai = document.getElementById('ci-mulai').value;
        const selesai = document.getElementById('ci-selesai').value;
        const alasan = document.getElementById('ci-alasan').value.trim();
        if (new Date(selesai) < new Date(mulai)) {
            alert('Tanggal selesai harus setelah tanggal mulai');
            return;
        }
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
        try {
            const res = await api.post({
                action: 'submitPengajuan',
                userId: user.id,
                nama: user.name || user.nama || '',
                tipe: tipe,
                tanggal_mulai: mulai,
                tanggal_selesai: selesai,
                alasan: alasan,
                foto: this._fotoBase64 || ''
            });
            if (res && res.success) {
                alert('Pengajuan terkirim, menunggu approval admin.');
                this.closeForm();
                this.loadQuota();
                this.load();
            } else {
                alert('Gagal: ' + ((res && res.error) || 'cek koneksi'));
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Ajukan';
        }
    },

    async loadQuota() {
        const user = auth.user || {};
        if (!user.id) return;
        const tahun = new Date().getFullYear();
        document.getElementById('ci-quota-tahun').textContent = tahun;
        try {
            const res = await api.post({ action: 'getLeaveQuota', userId: user.id, tahun: tahun });
            if (res && res.success) {
                document.getElementById('ci-quota-sisa').textContent = res.sisa;
                document.getElementById('ci-quota-total').textContent = res.kuota;
                document.getElementById('ci-quota-terpakai').textContent = res.terpakai;
            }
        } catch (err) { /* silent */ }
    },

    async load() {
        const list = document.getElementById('ci-list');
        const user = auth.user || {};
        if (!user.id) {
            list.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px;">User tidak terdeteksi, login ulang.</div>';
            return;
        }
        list.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px;"><i class="fas fa-sync fa-spin"></i> Memuat...</div>';
        try {
            const res = await api.post({ action: 'getMyPengajuan', userId: user.id });
            if (!res || !res.success) {
                list.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Gagal: ${(res && res.error) || 'cek koneksi'}</div>`;
                return;
            }
            this._items = res.data || [];
            if (this._items.length === 0) {
                list.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px;"><i class="fas fa-inbox" style="font-size:2rem; opacity:0.5;"></i><p style="margin:8px 0 0;">Belum ada pengajuan</p></div>';
                return;
            }
            list.innerHTML = this._items.map(it => this._renderCard(it)).join('');
        } catch (err) {
            list.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Error: ${err.message}</div>`;
        }
    },

    _renderCard(it) {
        const st = String(it.status || 'PENDING').toUpperCase();
        const stColor = st === 'APPROVED' ? '#10b981' : st === 'REJECTED' ? '#ef4444' : '#f59e0b';
        const stBg = st === 'APPROVED' ? '#dcfce7' : st === 'REJECTED' ? '#fee2e2' : '#fef3c7';
        const stText = st === 'APPROVED' ? 'Disetujui' : st === 'REJECTED' ? 'Ditolak' : 'Menunggu';
        const tipeIcon = it.tipe === 'CUTI' ? 'fa-umbrella-beach' : 'fa-file-medical';
        const tipeColor = it.tipe === 'CUTI' ? '#10b981' : '#3b82f6';
        return `
            <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:10px; background:white;">
                <div style="display:flex; justify-content:space-between; align-items:start; gap:8px; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas ${tipeIcon}" style="color:${tipeColor}; font-size:18px;"></i>
                        <div>
                            <div style="font-weight:600; color:#1e293b;">${it.tipe} · ${it.jumlah_hari} hari</div>
                            <div style="font-size:12px; color:#64748b;">${it.tanggal_mulai} → ${it.tanggal_selesai}</div>
                        </div>
                    </div>
                    <span style="background:${stBg}; color:${stColor}; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700;">${stText}</span>
                </div>
                <div style="font-size:13px; color:#475569; background:#f8fafc; padding:8px 10px; border-radius:6px;">${(it.alasan || '-').replace(/</g, '&lt;')}</div>
                ${it.has_foto ? `<button onclick="cutiIzin.viewFoto(${it.rowId})" style="margin-top:8px; background:#f1f5f9; border:1px solid #e2e8f0; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; color:#475569;"><i class="fas fa-image"></i> Lihat Lampiran</button>` : ''}
                ${it.catatan_admin ? `<div style="margin-top:8px; font-size:12px; color:#64748b; border-left:3px solid ${stColor}; padding-left:8px;"><b>Catatan admin:</b> ${String(it.catatan_admin).replace(/</g, '&lt;')}</div>` : ''}
                <div style="margin-top:8px; font-size:11px; color:#94a3b8;">Diajukan: ${it.submitted_at}</div>
            </div>`;
    },

    async viewFoto(rowId) {
        const res = await api.post({ action: 'getPengajuanFoto', rowId: rowId });
        if (!res || !res.success || !res.image) {
            alert('Lampiran tidak tersedia');
            return;
        }
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; cursor:pointer;';
        overlay.innerHTML = `<img src="${res.image}" style="max-width:100%; max-height:90vh; border-radius:8px;">`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    }
};

window.cutiIzin = cutiIzin;
