# V2 Development Branch

Branch ini untuk **iterasi V2** tanpa mengganggu production V1 yang sudah jalan di `bisatani.vercel.app`.

## URL

| Environment | URL | Branch |
|---|---|---|
| **Production (V1)** | https://bisatani.vercel.app | `main` |
| **Production alias** | https://aproval-bisatani.vercel.app | `main` |
| **Dev (V2)** | https://bisatani-git-v2-dev-ghani536-9880s-projects.vercel.app | `v2-dev` |

## Workflow

### Develop di V2

```bash
git checkout v2-dev
# edit code...
git add -A
git commit -m "feat(v2): xxx"
git push
```

Vercel auto-deploy preview ke URL dev (~1 menit). Karyawan di production **tidak terpengaruh**.

### Test di Dev Preview

1. Buka URL dev di browser (atau incognito untuk avoid cache login)
2. Test fitur baru
3. Iterate sampai oke

### Saat Ready Merge ke Main (Production)

```bash
git checkout main
git pull
git merge v2-dev          # atau via PR di GitHub
git push                  # auto-deploy ke bisatani.vercel.app
```

Atau via PR:
```bash
gh pr create --base main --head v2-dev --title "V2.x: xxx"
gh pr merge --squash
```

## ⚠️ Catatan Penting

### Backend (GAS + Sheets) sama untuk V1 & V2

API endpoint di `js/api.js` sama:
```js
const API_BASE_URL = 'https://script.google.com/macros/.../exec';
```

Artinya:
- **Absen test dari URL dev → masuk ke Sheets production juga**
- **Karyawan test dengan akun real → data tercampur dengan produksi**

### Cara Aman Untuk Test

**Untuk perubahan UI/UX kecil** (warna, layout, copywriting):
- Test langsung di dev URL, tidak perlu special handling
- Data minimal, tidak destructive

**Untuk perubahan logic kalkulasi atau schema**:
- Backup spreadsheet dulu via Settings → Backup CSV
- Test dengan akun khusus (mis. B002 yang sudah di-skip dari payroll)
- Verify hasil di sheet, lalu rollback jika perlu

**Untuk perubahan besar (struktur sheet, GAS endpoint)**:
- Pertimbangkan **clone spreadsheet** ke ID baru untuk dev
- Pertimbangkan **deploy GAS terpisah** ke deployment ID dev
- Adjust `API_BASE_URL` di v2-dev branch untuk point ke deployment dev
- Setelah V2 stable, switch back ke production endpoint

## Git Cheatsheet

| Aksi | Command |
|---|---|
| Switch ke v2-dev | `git checkout v2-dev` |
| Switch balik ke main | `git checkout main` |
| Lihat status | `git status` |
| Pull update dari main ke v2-dev | `git checkout v2-dev && git merge main` |
| Sync v2-dev terbaru ke main | `git checkout main && git merge v2-dev && git push` |

## Saat V2 Sudah Stable di Production

Kalau V2 sudah merged ke main dan jadi production V2, branch `v2-dev` bisa:
- **Di-hapus** (`git branch -D v2-dev && git push origin --delete v2-dev`)
- **Reset untuk V3** (`git checkout v2-dev && git reset --hard main`)
- Atau biarkan untuk arsip
