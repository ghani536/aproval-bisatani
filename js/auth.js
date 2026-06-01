/**
 * Portal Karyawan - Auth PT. BISATANI
 */
const auth = {
    user: null,

    init() {
        console.log("Auth: Inisialisasi...");
        // Gunakan localStorage langsung jika storage.js belum siap
        const session = localStorage.getItem('session');
        if (session) {
            try {
                this.user = JSON.parse(session);
                this.showApp();
            } catch (e) { localStorage.removeItem('session'); }
        }

        const form = document.getElementById('login-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                await this.handleLogin();
            };
        }

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.onclick = () => this.handleLogout();
        }

        // Toggle show/hide password
        const toggleBtn = document.getElementById('toggle-password');
        const pwdInput = document.getElementById('login-password');
        if (toggleBtn && pwdInput) {
            toggleBtn.onclick = (e) => {
                e.preventDefault();
                const isHidden = pwdInput.type === 'password';
                pwdInput.type = isHidden ? 'text' : 'password';
                // Swap icon eye <-> eye-slash
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.classList.remove(isHidden ? 'fa-eye' : 'fa-eye-slash');
                    icon.classList.add(isHidden ? 'fa-eye-slash' : 'fa-eye');
                }
                toggleBtn.setAttribute('aria-label', isHidden ? 'Sembunyikan password' : 'Tampilkan password');
            };
            toggleBtn.setAttribute('aria-label', 'Tampilkan password');
        }
    },

    async handleLogin() {
        const emailEl = document.getElementById('login-email');
        const passwordEl = document.getElementById('login-password');
        const roleEl = document.querySelector('input[name="role"]:checked');

        if (!emailEl || !passwordEl || !roleEl) return;

        const email = emailEl.value.trim();
        const password = passwordEl.value.trim();
        const selectedRole = roleEl.value;

        const btn = document.querySelector('.btn-login');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>Memverifikasi...</span>';
        }

        try {
            // Memanggil API login
            const res = await api.login(email, password);
            
            // PERBAIKAN: Kode.gs mengembalikan 'res.user', bukan 'res.data'
            if (res.success && res.user) {
                // Gunakan role dari database, jika kosong baru pakai pilihan di form
                this.user = { 
                    ...res.user, 
                    role: res.user.role || selectedRole 
                };
                
                localStorage.setItem('session', JSON.stringify(this.user));
                this.showApp();
            } else {
                alert(res.error || "Login Gagal: Periksa ID/Email dan Password.");
                this.resetButton();
            }
        } catch (err) {
            console.error(err);
            alert("Kesalahan sistem: Tidak dapat terhubung ke server.");
            this.resetButton();
        }
    },

    resetButton() {
        const btn = document.querySelector('.btn-login');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>Login</span><i class="fas fa-arrow-right"></i>';
        }
    },

    showApp() {
        const loginCont = document.getElementById('login-container');
        const appCont = document.getElementById('app-container');
        
        if (loginCont) loginCont.style.display = 'none';
        if (appCont) {
            appCont.classList.remove('hidden');
            appCont.style.display = 'flex';
        }

        if (this.user) {
            // Update UI Identitas (welcome-name sudah obsolete — dashboard karyawan
            // pakai emp-greeting di dashboard.js, dashboard admin pakai header sendiri)
            const nameEl = document.getElementById('user-name');
            const roleEl = document.getElementById('user-role');

            if (nameEl) nameEl.textContent = this.user.name;
            if (roleEl) roleEl.textContent = this.user.role === 'admin' ? 'Administrator' : 'Karyawan';
            
            // Manajemen Menu Admin vs Karyawan vs Super Admin
            const adminMenu = document.getElementById('admin-menu-nav');
            const empMenu = document.getElementById('employee-menu');
            const role = String(this.user.role || '').toLowerCase();
            const isSuperAdmin = role === 'superadmin';
            const isAdmin = role === 'admin' || isSuperAdmin; // superadmin inherits admin privileges

            // Toggle class di body untuk styling navigation
            document.body.classList.toggle('is-employee', !isAdmin);
            document.body.classList.toggle('is-admin', isAdmin);
            document.body.classList.toggle('is-superadmin', isSuperAdmin);

            // Toggle nav items berdasarkan role (di sidebar + bottom nav)
            document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
            document.querySelectorAll('.employee-only').forEach(el => el.classList.toggle('hidden', isAdmin));
            // Super admin only menu (Audit Log)
            document.querySelectorAll('.superadmin-only').forEach(el => el.classList.toggle('hidden', !isSuperAdmin));

            if (isAdmin) {
                if (adminMenu) adminMenu.classList.remove('hidden');
                if (empMenu) empMenu.classList.add('hidden');
                if (window.router) router.navigate('admin-dashboard');
                // Refresh badge counter di sidebar
                setTimeout(() => {
                    if (window.adminApproval) adminApproval.refreshBadgeOnly();
                    if (window.adminPengajuan) adminPengajuan.preloadBadge();
                }, 1000);
            } else {
                if (adminMenu) adminMenu.classList.add('hidden');
                if (empMenu) empMenu.classList.remove('hidden');
                if (window.router) router.navigate('dashboard');
            }
        }
    },

    isLoggedIn() {
        return this.user !== null;
    },

    handleLogout() {
        if (confirm("Apakah Anda yakin ingin keluar?")) {
            localStorage.removeItem('session');
            this.user = null;
            window.location.reload();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => auth.init());
window.auth = auth;
