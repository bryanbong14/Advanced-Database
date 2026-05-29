// ── dashboard.js ─────────────────────────────────────────────
// Handles: dashboard stat cards, quick-access cards.

// ── Stats ─────────────────────────────────────────────────────
async function loadDashboardStats(profile) {
  const role = profile.role;

  // Invoices + overdue (finance, sales, admin)
  if (['admin', 'finance', 'sales'].includes(role)) {
    let q = sb.from('invoices').select('*', { count: 'exact', head: true });
    if (role === 'sales') q = q.eq('sales_agent', profile.department);
    const { count } = await q;
    document.getElementById('stat-invoices').textContent = count ?? 0;

    let oq = sb.from('invoices')
      .select('*', { count: 'exact', head: true })
      .lt('due_date', new Date().toISOString().split('T')[0])
      .not('status', 'in', '("paid","cancelled")');
    if (role === 'sales') oq = oq.eq('sales_agent', profile.department);
    const { count: overdueCount } = await oq;
    document.getElementById('stat-overdue').textContent = overdueCount ?? 0;

    if (overdueCount > 0) {
      const badge = document.getElementById('overdue-badge');
      badge.style.display = '';
      badge.textContent   = overdueCount;
    }
  } else {
    document.getElementById('stat-overdue-card').style.display = 'none';
  }

  // Customers (finance, sales, admin)
  if (['admin', 'finance', 'sales'].includes(role)) {
    const { count } = await sb.from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    document.getElementById('stat-customers').textContent = count ?? 0;
  } else {
    document.getElementById('stat-customers').textContent = '—';
  }

  // Open orders (all roles)
  const { count: orderCount } = await sb.from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .not('status', 'in', '("delivered","cancelled")');
  document.getElementById('stat-orders').textContent = orderCount ?? 0;

  // Low stock (admin, warehouse, sales)
  if (['admin', 'warehouse', 'sales'].includes(role)) {
    const { data: stockData } = await sb.from('inventory')
      .select('qty_on_hand, qty_reserved, qty_available, reorder_level')
      .eq('is_active', true);

    if (stockData) {
      const lowCount = stockData.filter(item => {
        const avail = item.qty_available
          ?? ((item.qty_on_hand ?? 0) - (item.qty_reserved ?? 0));
        return avail <= (item.reorder_level ?? 0);
      }).length;
      document.getElementById('stat-stock').textContent = lowCount;

      // Warn badge color if any are out of stock
      const outCount = stockData.filter(item => {
        const avail = item.qty_available
          ?? ((item.qty_on_hand ?? 0) - (item.qty_reserved ?? 0));
        return avail <= 0;
      }).length;
      if (outCount > 0) {
        const card = document.getElementById('stat-stock-card');
        if (card) card.classList.add('danger');
      }
    } else {
      document.getElementById('stat-stock').textContent = 0;
    }
  } else {
    document.getElementById('stat-stock-card').style.display = 'none';
  }
}

// ── Quick cards ───────────────────────────────────────────────
const QUICK_CARDS = {
  admin: [
    { color: 'green', label: 'Customers', desc: 'View all accounts',    page: 'customers', svg: '<circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2.5-5 5-5s5 2 5 5"/><path d="M11 2a3 3 0 0 1 0 6"/><path d="M15 14c0-3-1.5-4.5-4-5"/>' },
    { color: 'blue',  label: 'Invoices',  desc: 'Track payments & dues', page: 'invoices',  svg: '<path d="M4 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h6M5 11h4"/>' },
    { color: 'amber', label: 'Inventory', desc: 'Stock levels & alerts', page: 'inventory', svg: '<rect x="1" y="8" width="14" height="7" rx="1"/><rect x="3" y="4" width="10" height="4" rx="1"/><rect x="5" y="1" width="6" height="3" rx="1"/>' },
    { color: 'red',   label: 'Users',     desc: 'Manage staff access',  page: 'users',     svg: '<circle cx="8" cy="5" r="3.5"/><path d="M1 15c0-4 3-6 7-6s7 2 7 6"/>' },
  ],
  finance: [
    { color: 'blue',  label: 'Invoices',  desc: 'All invoices & payments', page: 'invoices',  svg: '<path d="M4 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h6M5 11h4"/>' },
    { color: 'green', label: 'Customers', desc: 'Credit & balance info',   page: 'customers', svg: '<circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2.5-5 5-5s5 2 5 5"/>' },
    { color: 'amber', label: 'Orders',    desc: 'Sales order tracking',    page: 'orders',    svg: '<path d="M2 4l1.5-2h9L14 4v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z"/><path d="M5 7h6"/>' },
  ],
  sales: [
    { color: 'blue',  label: 'My Invoices', desc: 'Your sales invoices',      page: 'invoices',  svg: '<path d="M4 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h6M5 11h4"/>' },
    { color: 'green', label: 'Customers',   desc: 'Your customer accounts',   page: 'customers', svg: '<circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2.5-5 5-5s5 2 5 5"/>' },
    { color: 'amber', label: 'Orders',      desc: 'Create & track orders',    page: 'orders',    svg: '<path d="M2 4l1.5-2h9L14 4v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z"/><path d="M5 7h6"/>' },
    { color: 'red',   label: 'Inventory',   desc: 'Check stock availability', page: 'inventory', svg: '<rect x="1" y="8" width="14" height="7" rx="1"/><rect x="3" y="4" width="10" height="4" rx="1"/>' },
  ],
  warehouse: [
    { color: 'amber', label: 'Inventory', desc: 'Stock levels & updates', page: 'inventory', svg: '<rect x="1" y="8" width="14" height="7" rx="1"/><rect x="3" y="4" width="10" height="4" rx="1"/><rect x="5" y="1" width="6" height="3" rx="1"/>' },
    { color: 'blue',  label: 'Orders',    desc: 'Pending deliveries',     page: 'orders',    svg: '<path d="M2 4l1.5-2h9L14 4v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z"/><path d="M5 7h6"/>' },
  ],
};

function buildQuickCards(role) {
  const cards = QUICK_CARDS[role] || [];
  document.getElementById('quickGrid').innerHTML = cards.map(c => `
    <div class="quick-card" onclick="showPage('${c.page}', null)">
      <div class="q-icon ${c.color}">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${c.svg}</svg>
      </div>
      <div>
        <div class="q-label">${c.label}</div>
        <div class="q-desc">${c.desc}</div>
      </div>
    </div>
  `).join('');
}

// ── Modal helpers (dashboard only) ───────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeOnOverlay(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.overlay.open').forEach(m => m.classList.remove('open'));
});

// ── Page navigation ───────────────────────────────────────────
function showPage(id, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');

  if (navEl) {
    navEl.classList.add('active');
  } else {
    const auto = document.getElementById('nav-' + id);
    if (auto) auto.classList.add('active');
  }

  const menu = document.getElementById('profileMenu');
  if (menu) menu.classList.remove('open');
}

// ── Profile dropdown ──────────────────────────────────────────
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
