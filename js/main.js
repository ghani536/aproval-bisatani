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

// Jam Digital
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
});
