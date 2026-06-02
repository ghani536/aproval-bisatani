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

    // Initial scan for scrollable tables + periodic recheck (cover async render)
    setTimeout(() => enhanceAllScrollableTables(), 400);
    setTimeout(() => enhanceAllScrollableTables(), 1500);
    window.addEventListener('resize', () => enhanceAllScrollableTables());
});

// Tambah tombol scroll horizontal di setiap .table-responsive yang melebar
function enhanceTableScroll(scrollEl) {
    if (!scrollEl || !scrollEl.classList.contains('table-responsive')) return;
    let wrap = scrollEl.parentElement;
    // Wrap kalau belum ada
    if (!wrap || !wrap.classList.contains('table-scroll-wrap')) {
        const newWrap = document.createElement('div');
        newWrap.className = 'table-scroll-wrap';
        scrollEl.parentNode.insertBefore(newWrap, scrollEl);
        newWrap.appendChild(scrollEl);
        wrap = newWrap;
    }
    let btnL = wrap.querySelector('.h-scroll-btn-left');
    let btnR = wrap.querySelector('.h-scroll-btn-right');
    if (!btnL) {
        btnL = document.createElement('button');
        btnL.type = 'button';
        btnL.className = 'h-scroll-btn h-scroll-btn-left';
        btnL.innerHTML = '<i class="fas fa-chevron-left"></i>';
        btnL.onclick = (e) => { e.preventDefault(); scrollEl.scrollBy({ left: -280, behavior: 'smooth' }); };
        wrap.appendChild(btnL);
    }
    if (!btnR) {
        btnR = document.createElement('button');
        btnR.type = 'button';
        btnR.className = 'h-scroll-btn h-scroll-btn-right';
        btnR.innerHTML = '<i class="fas fa-chevron-right"></i>';
        btnR.onclick = (e) => { e.preventDefault(); scrollEl.scrollBy({ left: 280, behavior: 'smooth' }); };
        wrap.appendChild(btnR);
    }
    const update = () => {
        const max = scrollEl.scrollWidth - scrollEl.clientWidth;
        const needScroll = max > 10;
        const canL = needScroll && scrollEl.scrollLeft > 5;
        const canR = needScroll && scrollEl.scrollLeft < max - 5;
        btnL.classList.toggle('visible', canL);
        btnR.classList.toggle('visible', canR);
    };
    if (!scrollEl.dataset.hsBound) {
        scrollEl.addEventListener('scroll', update);
        scrollEl.dataset.hsBound = '1';
    }
    update();
}

function enhanceAllScrollableTables() {
    document.querySelectorAll('.table-responsive').forEach(enhanceTableScroll);
}
window.enhanceAllScrollableTables = enhanceAllScrollableTables;

// Deteksi karyawan Live Streamer (dari department/position).
// Dipakai untuk mengeluarkan streamer dari monitoring absensi karyawan biasa.
window.isLiveStreamer = function (emp) {
    if (!emp) return false;
    var s = (String(emp.department || '') + ' ' + String(emp.position || '')).toLowerCase();
    return s.indexOf('live streamer') !== -1 || s.indexOf('livestreamer') !== -1;
};
