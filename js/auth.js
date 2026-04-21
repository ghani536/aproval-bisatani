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
            // Update UI Identitas
            const nameEl = document.getElementById('user-name');
            const welcomeEl = document.getElementById('welcome-name');
            const roleEl = document.getElementById('user-role');

            if (nameEl) nameEl.textContent = this.user.name;
            if (welcomeEl) welcomeEl.textContent = this.user.name.split(' ')[0];
            if (roleEl) roleEl.textContent = this.user.role === 'admin' ? 'Administrator' : 'Karyawan';
            
            // Manajemen Menu Admin vs Karyawan
            const adminMenu = document.getElementById('admin-menu-nav');
            const empMenu = document.getElementById('employee-menu');

            if (this.user.role === 'admin') {
                if (adminMenu) adminMenu.classList.remove('hidden');
                if (empMenu) empMenu.classList.add('hidden');
                if (window.router) router.navigate('admin-dashboard');
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
