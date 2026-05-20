// ── supabase.js ─────────────────────────────────────────────
// Single source of truth for the Supabase client.
// Every other JS file reads `window.sb` and `window.currentProfile`.

const SUPABASE_URL = "https://ojojzrrtclsrzwsvboyx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qb2p6cnJ0Y2xzcnp3c3Zib3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjc3MTAsImV4cCI6MjA5NDcwMzcxMH0.uU5rTuhAO0FHcZOR_Tr2uo4RMXamwc4T-r8xbGC9PIk";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// Shared state - set once in auth.js, read everywhere esle
window.currentUser = null;
window.currentProfile = null;

//--Shared utility
/**
 * Display an inline feedback message.
 * @param {HTMLElement} el - The message container element
 * @param {string} text - Message text
 * @param {'success'|'error'} type
 */

function showMsg(el, text, type) {
    el.style.display = 'block';
    el.style.background = type === 'success' ? 'var(--accent-1)' : 'var(--red-1)';
    el.style.color = type === 'success' ? 'var(--accent)'   : 'var(--red)';
    el.style.border = `1px solid ${type === 'success' ? '#B0D8BC' : '#F0C0C0'}`;
    el.style.borderRadius = '8px';
    el.style.padding = '10px 14px';
    el.textContent = text;
}

//--Modal helpers
function openModal(id) {document.getElementById(id).classList.add('open');}
function closeModal(id) {document.getElementById(id).classList.remove('open');}
function closeOnOverlay(e,id) {
    if (e.target === document.getElementById(id)) closeModal(id);
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') 
        document.querySelectorAll('.overlay.open').forEach(m => m.classList.remove('open'));

});

//- Page navigation
function showPage(id, navE1) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = document.getElementById('page-' + id);
    if (page) page.classList.add('active');

    if (navE1) {
        navE1.classList.add('active');
    } else {
        const auto = document.getElementById('nav-' + id);
        if (auto) auto.classList.add('active');
    }

    document.getElementById('profilMenu').classList.remove('open');
}

//-- Profile dropdown toggle
function toggleProfileMenu() {
    document.getElementById('profileMenu').classList.toggle('open');
}

document.addEventListener('click', e => {
    const menu = document.getElementById('profileMenu');
    const pill = document.querySelector('.user-pill');
    if (menu && pill && !menu.contains(e.target) && !pill.contains(e.target)) {
        menu.classList.remove('open');
    }
});