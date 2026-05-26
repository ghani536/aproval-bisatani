/**
 * Portal Karyawan - Main Utility PT. BISATANI
 */
const storage = {
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    get(key) { 
        const val = localStorage.getItem(key);
        try { return val ? JSON.parse(val) : null; } catch (e) { return null; }
    },
    remove(key) { localStorage.removeItem(key); },
    clear() { localStorage.clear(); }
};

const toast = {
    show(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) { alert(message); return; }
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = message;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); }
};

window.storage = storage;
window.toast = toast;

// Jam Digital + Hamburger sidebar
document.addEventListener('DOMContentLoaded', () => {
    const timeDisplay = document.getElementById('current-time');
    if (timeDisplay) {
        setInterval(() => {
            const now = new Date();
            const timeEl = timeDisplay.querySelector('.time');
            const dateEl = timeDisplay.querySelector('.date');
            if (timeEl) timeEl.textContent = now.toLocaleTimeString('id-ID');
            if (dateEl) dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }, 1000);
    }

    // Hamburger sidebar toggle (mobile/half-screen)
    const menuBtn = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const closeSidebar = () => {
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (backdrop) backdrop.classList.remove('active');
    };
    const openSidebar = () => {
        if (sidebar) sidebar.classList.add('mobile-open');
        if (backdrop) backdrop.classList.add('active');
    };
    if (menuBtn && sidebar) {
        menuBtn.onclick = (e) => {
            e.preventDefault();
            if (sidebar.classList.contains('mobile-open')) closeSidebar();
            else openSidebar();
        };
    }
    if (backdrop) backdrop.onclick = closeSidebar;
    // Auto-close sidebar saat klik nav item di mobile
    if (sidebar) {
        sidebar.querySelectorAll('.nav-link, .nav-item').forEach(el => {
            el.addEventListener('click', () => {
                if (window.innerWidth <= 768) closeSidebar();
            });
        });
    }
});
