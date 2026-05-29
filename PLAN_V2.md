# Plan V2 — Roadmap Fitur

Dokumen ini menyimpan rencana fitur V2 yang akan dikerjakan setelah V1 berjalan stabil di production beberapa minggu/bulan. Strategi: **observasi V1 dulu**, kumpulkan bug & feedback real, baru eksekusi V2 dengan prioritas berdasarkan pengalaman pakai.

**Tanggal disusun**: 2026-05-29 (saat go-live V1)

---

## 🎯 3 Fitur Utama V2

### 1. 📧 Email Notifikasi Pengajuan Cuti/Izin
**Effort**: ~30-45 menit · **Risk**: 🟢 Low (additive only)

**Skenario:**
- Karyawan submit pengajuan cuti/izin via app → admin auto-receive email
- Subject: `[Pengajuan Baru] [Nama] - [Tipe] - [Tanggal]`
- Body: detail pengajuan + link langsung ke menu Pengajuan di app
- Saat admin approve/reject → karyawan auto-receive email keputusan

**Schema changes**: NONE

**Settings baru** (di tab Branding atau "Notifications" baru):
- `email_admin_notif` — alamat email penerima notif
  - Opsi: 1 email tunggal, atau multi (comma-separated)
  - Atau: per supervisor karyawan (tambah kolom `supervisor_email` di Employees)
- `notif_pengajuan_aktif` — toggle on/off (default true)
- `notif_approval_aktif` — toggle on/off untuk notif keputusan ke karyawan (default true)

**GAS changes:**
```js
// Di submitPengajuan(), setelah append sukses:
if (settings.notif_pengajuan_aktif === 'true') {
  _sendNotifPengajuanBaru(p, settings.email_admin_notif);
}

// Di decidePengajuan(), setelah update sukses:
if (settings.notif_approval_aktif === 'true') {
  // Cari email karyawan dari Employees
  _sendNotifKeputusan(p, karyawanEmail, status, catatan_admin);
}
```

**Caveat develop**: saat testing, kalau email penerima real, admin/karyawan kena spam. Solusi pakai email test (`gmail.com user`) selama dev.

---

### 2. 🛡️ Super Admin Role
**Effort**: ~45-60 menit · **Risk**: 🟡 Medium (auth changes)

**Skenario:**
- Saat ini cuma 2 role: `employee` + `admin`
- Tambah role ke-3: `superadmin` untuk owner PT / direktur
- Akses super admin:
  - Lihat Audit Log (Phase 3)
  - Restore deleted data
  - Kelola admin (promote/demote)
  - Override decision admin
- Admin biasa: tidak bisa lihat audit log mereka sendiri (anti-cover-up)

**Schema changes**: existing kolom `role` di Employees, tambah enum `superadmin`.

**GAS changes:**
- `handleLogin`: return role yang benar (tetap)
- Helper `_isSuperAdmin(actorId)`:
  ```js
  function _isSuperAdmin(actorId) {
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Employees');
    var d = s.getDataRange().getValues();
    for (var i = 1; i < d.length; i++) {
      if (String(d[i][0]) === String(actorId)) {
        return String(d[i][11] || '').toLowerCase() === 'superadmin';
      }
    }
    return false;
  }
  ```
- Endpoint sensitive butuh super admin check:
  - `getAuditLog` — super admin only
  - `restoreDeleted` — super admin only (future)
  - `kelolaAdmin` — super admin only (future)

**Frontend changes:**
- `auth.js` — cek role superadmin, set body class `is-superadmin`
- Sidebar: tambah section "Super Admin" dengan menu khusus
- `Audit Log` page — visible hanya untuk superadmin
- Filter di Data Karyawan: hide juga superadmin (selain admin yang sudah hide)

**Cara promote akun**: edit manual di sheet `Employees`, kolom `role` → `superadmin`. Mis. promote ID 1 (Admin) ke superadmin.

**Caveat develop**: V1 frontend tidak handle role `superadmin` → user dengan role itu default ke UI employee. Jangan promote sampai V2 deployed.

---

### 3. 📜 Audit Log (User Activity Log)
**Effort**: ~1-1.5 jam · **Risk**: 🟡 Medium (banyak endpoint)

**Skenario:**
- Setiap action mutating tercatat: siapa, kapan, apa, before/after value
- Super admin bisa lihat: *"Admin Budi pada 29 Mei 14:35 ubah gaji_pokok karyawan B005 dari 2.300.000 → 2.500.000"*
- Berguna untuk:
  - Audit/compliance
  - Investigate dispute ("kenapa data saya berubah?")
  - Anti-fraud (admin ubah gaji tanpa otorisasi)

**Schema baru — Sheet `Audit_Log`** (10 kolom):
```
A: id
B: timestamp
C: actor_id          (siapa yang melakukan)
D: actor_name
E: action            (CREATE/UPDATE/DELETE/APPROVE/REJECT/dst)
F: target_type       (employee, pengajuan, settings, holiday, payroll, dst)
G: target_id         (ID karyawan/pengajuan/dst yang di-affect)
H: old_value         (JSON snapshot before, atau null kalau CREATE)
I: new_value         (JSON snapshot after, atau null kalau DELETE)
J: metadata          (info tambahan: ip, user agent, catatan, dst)
```

**GAS helper:**
```js
function _logAudit(actorId, actorName, action, targetType, targetId, oldVal, newVal, metadata) {
  try {
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Audit_Log');
    if (!s) return; // silent fail kalau sheet belum ada
    var id = _nextId(s);
    var now = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    s.appendRow([id, now, actorId, actorName, action, targetType, targetId,
                 oldVal ? JSON.stringify(oldVal) : '',
                 newVal ? JSON.stringify(newVal) : '',
                 metadata ? JSON.stringify(metadata) : '']);
  } catch (e) { /* silent */ }
}
```

**Endpoint yang perlu inject `_logAudit`:**

| Endpoint | Action | Target |
|---|---|---|
| `saveEmployee` (create) | CREATE | employee |
| `saveEmployee` (update) | UPDATE | employee |
| `deleteEmployee` | DELETE | employee |
| `decidePengajuan` (approve) | APPROVE | pengajuan |
| `decidePengajuan` (reject) | REJECT | pengajuan |
| `savePayrollSettings` | UPDATE | settings |
| `saveHoliday` | CREATE/UPDATE | holiday |
| `deleteHoliday` | DELETE | holiday |
| `savePengumuman` | CREATE/UPDATE | pengumuman |
| `deletePengumuman` | DELETE | pengumuman |
| `savePerformanceReview` | CREATE/UPDATE | performance |
| `deletePerformanceReview` | DELETE | performance |
| `sendSlipEmail` | SEND | payroll |
| `updateApprovalStatus` | APPROVE/REJECT | attendance |
| `updateAttendanceTime` | UPDATE | attendance |

**Endpoint baru:**
- `getAuditLog(filter)` — return log dengan filter (actor, action, target_type, date range)
- Pagination: support `limit` & `offset`
- **Auth**: cuma untuk role `superadmin`

**Frontend:**
- Menu sidebar "Audit Log" (superadmin only)
- Table dengan kolom: Waktu, Actor, Action, Target, Detail (expand JSON)
- Filter: dropdown actor + action + target type + date range
- Export ke CSV untuk audit external

**Privacy/security note:**
- Field password TIDAK boleh masuk log (sudah hashed tapi tetap sensitive)
- Snapshot before/after harus exclude `password` field
- Log retention: simpan max 1-2 tahun (auto-clean via Apps Script trigger)

**Caveat develop**: setiap action test akan ke-log. Sheet bisa kotor dengan test entry. Solusi:
- Sebelum go-live V2, clear sheet `Audit_Log` untuk fresh start
- Atau filter di `_logAudit`: skip kalau actorId IN ('B002', '1') saat dev (hardcode test users)

---

## 🗺️ Implementation Order

### Phase 1: Email Notif (V2.1)
- Quick win, low risk
- Bisa langsung jadi value untuk admin tidak buka app
- Selesai → merge ke main

### Phase 2: Super Admin Role (V2.2)
- Foundation untuk Phase 3
- Tidak break apa-apa
- Promote 1 akun via manual edit sheet

### Phase 3: Audit Log (V2.3)
- Butuh Phase 2 selesai (audit log akses-nya untuk superadmin)
- Sentuh banyak endpoint, test extensive
- High value untuk governance & compliance

---

## 🔮 Ide Lain untuk V2+ (Backlog)

Hasil brainstorming sebelumnya — tunggu request user / feedback.

### Quick Wins
- [ ] **PDF slip gaji download** — pakai jspdf, klik download di tabel Payroll
- [ ] **Search global di tabel** — filter real-time di Data Karyawan, Rekap, Pengajuan
- [ ] **Karyawan ganti password sendiri** — menu di dashboard karyawan
- [ ] **Force change pada first login setelah reset** — flag `password_temporary`

### Fitur HR
- [ ] **Pinjaman karyawan + auto-potong gaji** — sheet `Pinjaman` (cicilan, sisa)
- [ ] **Cuti khusus dengan sub-tipe** — Sakit/Melahirkan/Menikah/Dukacita
- [ ] **Multi-shift schedule** — admin assign shift pagi/sore/malam per tanggal
- [ ] **Reminder absen pagi** — cron daily jam 07:30 kirim email reminder ke yang belum MASUK

### Analytics
- [ ] **Annual report** — total gaji/lembur/cuti per tahun
- [ ] **Comparative analytics** — bulan ini vs bulan lalu
- [ ] **Heatmap kehadiran** — calendar view per karyawan

### Branding & UX
- [ ] **PWA + installable** — manifest.json + service worker
- [ ] **Dark mode** — toggle Settings
- [ ] **Custom domain** — `absensi.bisatani.com` (butuh beli domain)

### Advanced
- [ ] **PPh21 calculation** — pajak otomatis
- [ ] **GPS geofencing** — validasi absen di radius kantor (user skip sebelumnya)
- [ ] **Face recognition** — saat MASUK
- [ ] **n8n webhook** — integrate dengan workflow automation

---

## 📌 Pakai Branch & Backend mana?

**Branch**: `v2-dev` (current)
**Production**: `main` (live di `bisatani.vercel.app`)

**Backend untuk develop V2**:
- Default: **SAMA** dengan production (Sheets + GAS yang sama)
- Pro: setup minimal, perubahan langsung relevant untuk data real
- Con: harus hati-hati saat test destructive

**Kapan butuh duplikat backend**:
- Kalau V2 ada perubahan **schema sheet** (tambah/hapus kolom existing)
- Kalau V2 refactor logic kalkulasi yang bisa hasilkan angka beda

**Untuk 3 fitur utama (email/super admin/audit log)**: backend sama OK. Semua additive, tidak ada destructive change.

---

## 🚦 Kapan Mulai Develop V2?

Tunggu:
- ✅ V1 jalan minimal **2-4 minggu** di production
- ✅ Kumpulkan bug real dari karyawan
- ✅ User identifikasi pain point konkret (mis. "admin kewalahan cek pengajuan tiap hari")
- ✅ Prioritas re-confirm berdasarkan pengalaman pakai V1

Setelah itu, switch branch ke `v2-dev`, mulai implement sesuai phase order.

---

## 🔗 Quick Reference

| Resource | Link |
|---|---|
| Production URL (V1) | https://bisatani.vercel.app |
| V2 Dev URL | https://bisatani-git-v2-dev-ghani536-9880s-projects.vercel.app (Vercel login required) |
| GitHub repo | https://github.com/ghani536/aproval-bisatani |
| Spreadsheet | https://docs.google.com/spreadsheets/d/1M9mNvHsyiX-0Wp2naKJBipu97SABXoKFyNU9c6tUj4Q |
| GAS editor | https://script.google.com/d/1sAJYGlKUzZi_xTKNiA-5B_hd6rkOVdE3uDnAIcJ2W0DsDFMto5jyTawN/edit |
| Vercel dashboard | https://vercel.com/ghani536-9880s-projects |
