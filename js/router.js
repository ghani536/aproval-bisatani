/**
 * Portal Karyawan - Router PT. BISATANI
 * Menangani navigasi antar halaman & Inisialisasi Script
 */
const router = {
    currentPage: 'dashboard',
    
    init() {
        console.log("Router: Menginisialisasi navigasi...");
        
        // Ambil semua elemen yang punya atribut data-page
        const menuItems = document.querySelectorAll('[data-page]');
        
        menuItems.forEach(item => {
            item.onclick = (e) => {
                const page = item.getAttribute('data-page');
                if (page) {
                    e.preventDefault();
                    this.navigate(page);
                }
            };
        });

        // Cek sesi login
        const savedPage = localStorage.getItem('currentPage') || 'dashboard';
        if (typeof auth !== 'undefined' && auth.isLoggedIn()) {
            this.navigate(savedPage);
        }
    },

    navigate(page) {
        if (typeof auth !== 'undefined' && !auth.isLoggedIn()) return;

        console.log("Router: Berpindah ke ->", page);

        // 1. Update UI Active Class
        document.querySelectorAll('[data-page]').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === page) {
                item.classList.add('active');
            }
        });

        // 2. Switch Halaman
        const allPages = document.querySelectorAll('.page');
        allPages.forEach(p => {
            p.classList.remove('active');
            p.style.display = 'none';
        });

        const target = document.getElementById(`page-${page}`);
        if (target) {
            target.classList.add('active');
            target.style.display = 'block';
            
            this.currentPage = page;
            localStorage.setItem('currentPage', page);
            
            const titleEl = document.getElementById('page-title');
            if (titleEl) {
                titleEl.textContent = page.replace(/-/g, ' ').toUpperCase();
            }
            
            // 3. JALANKAN INIT SPESIFIK HALAMAN
            this.triggerPageInit(page);
        } else {
            console.error("Router: ID halaman tidak ditemukan -> page-" + page);
        }
    },

    triggerPageInit(page) {
        try {
            // Mapping halaman ke script yang sesuai
            switch (page) {
                case 'admin-dashboard':
                    if (window.adminDashboard) adminDashboard.init();
                    break;
                case 'dashboard':
                    // Jika kamu punya dashboard.js, panggil di sini
                    if (window.dashboard) window.dashboard.init();
                    break;
                case 'absensi':
                    if (window.absensi) {
                        console.log("Router: Menyalakan mesin absensi...");
                        absensi.init(); // Memanggil versi Turbo yang baru kita buat
                    }
                    break;
                case 'employees':
                    if (window.adminEmployees) adminEmployees.init();
                    break;
                case 'attendance-reports':
                    if (window.adminReports) adminReports.init();
                    break;
                case 'payroll-reports':
                    if (window.payroll) payroll.init();
                    break;
                case 'settings':
                    if (window.settings) settings.init();
                    break;
            }
        } catch (e) {
            console.error("Router: Gagal init halaman " + page, e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        router.init();
    }, 300);
});
