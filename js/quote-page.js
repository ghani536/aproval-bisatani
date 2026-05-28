/**
 * Portal Karyawan - Quote Page Controller (tab manager)
 * Switch antara tab 'Saya' dan 'Vote' di page Quote
 */
const quotePage = {
    currentTab: 'saya',

    init() {
        // Default tab: Saya
        this.switchTab('saya');
    },

    switchTab(tab) {
        this.currentTab = tab;
        const tabSayaBtn = document.getElementById('qtab-saya');
        const tabVoteBtn = document.getElementById('qtab-vote');
        const sayaContent = document.getElementById('qtab-saya-content');
        const voteContent = document.getElementById('qtab-vote-content');

        // Active style
        if (tabSayaBtn && tabVoteBtn) {
            const setActive = (btn, on) => {
                btn.style.background = on ? '#fff' : 'transparent';
                btn.style.color = on ? '#1e293b' : '#64748b';
                btn.style.boxShadow = on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none';
            };
            setActive(tabSayaBtn, tab === 'saya');
            setActive(tabVoteBtn, tab === 'vote');
        }
        if (sayaContent) sayaContent.style.display = (tab === 'saya') ? '' : 'none';
        if (voteContent) voteContent.style.display = (tab === 'vote') ? '' : 'none';

        // Trigger lazy init
        if (tab === 'saya' && window.quoteSaya) quoteSaya.init();
        if (tab === 'vote' && window.quoteVote) quoteVote.load();
    }
};

window.quotePage = quotePage;
