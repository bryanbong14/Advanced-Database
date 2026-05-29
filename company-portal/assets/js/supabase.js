// ── supabase.js ─────────────────────────────────────────────
// Single source of truth for the Supabase client.
// Safe to load on ANY page.

const SUPABASE_URL = 'https://ojojzrrtclsrzwsvboyx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qb2p6cnJ0Y2xzcnp3c3Zib3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjc3MTAsImV4cCI6MjA5NDcwMzcxMH0.uU5rTuhAO0FHcZOR_Tr2uo4RMXamwc4T-r8xbGC9PIk';

const { createClient } = supabase;
window.sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Expose constants so users.js can call the Edge Function
window.SUPABASE_URL      = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_KEY;

// Shared state — written by auth.js, read by all modules
window.currentUser    = null;
window.currentProfile = null;

// ── Shared utility ────────────────────────────────────────────
function showMsg(el, text, type) {
  el.style.display      = 'block';
  el.style.background   = type === 'success' ? 'var(--accent-l)' : 'var(--red-l)';
  el.style.color        = type === 'success' ? 'var(--accent)'   : 'var(--red)';
  el.style.border       = `1px solid ${type === 'success' ? '#B0D8BC' : '#F0C0C0'}`;
  el.style.borderRadius = '8px';
  el.style.padding      = '10px 14px';
  el.textContent        = text;
}

// ── Modal helpers — shared across all pages ───────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
function closeOnOverlay(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

// ── Page navigation ───────────────────────────────────────────
function showPage(id, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  if (navEl) {
    navEl.classList.add('active');
  } else {
    document.getElementById('nav-' + id)?.classList.add('active');
  }
  document.getElementById('profileMenu')?.classList.remove('open');
}

// ── Profile menu toggle ───────────────────────────────────────
function toggleProfileMenu() {
  document.getElementById('profileMenu')?.classList.toggle('open');
}
document.addEventListener('click', e => {
  const menu = document.getElementById('profileMenu');
  const pill = document.querySelector('.user-pill');
  if (menu && pill && !menu.contains(e.target) && !pill.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// ── Role hint for Add User modal ──────────────────────────────
const ROLE_HINTS = {
  sales:     'Sales staff can view their own invoices and orders, and check inventory.',
  finance:   'Finance staff can view all invoices, orders, and customers.',
  warehouse: 'Warehouse staff can view and update inventory and track orders.',
  admin:     'Admin has full access to all pages including user management and sync logs.'
};

function updateRoleHint(role) {
  const el = document.getElementById('role-hint');
  if (el) el.textContent = ROLE_HINTS[role] || '';
}

// Close modals on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.open').forEach(m => m.classList.remove('open'));
  }
});
