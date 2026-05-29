// ── permissions.js ───────────────────────────────────────────
// Role-based access rules.
// Loaded before auth.js so canAccess() is always available.

window.ROLE_NAV_ACCESS = {
  admin:     ['customers', 'invoices', 'orders', 'inventory', 'users', 'sync'],
  finance:   ['customers', 'invoices', 'orders'],
  sales:     ['customers', 'invoices', 'orders', 'inventory'],
  warehouse: ['orders', 'inventory']
};

window.ROLE_PAGE_ACCESS = {
  customers: ['admin', 'finance', 'sales'],
  invoices:  ['admin', 'finance', 'sales'],
  orders:    ['admin', 'finance', 'sales', 'warehouse'],
  inventory: ['admin', 'warehouse', 'sales'],
  users:     ['admin'],
  sync:      ['admin'],
  reports:   ['admin', 'finance', 'sales', 'warehouse'],
};

// Returns true if the current user's role can access a given page
window.canAccess = function (page) {
  const role = window.currentProfile?.role;
  if (!role) return false;
  return (window.ROLE_PAGE_ACCESS[page] || []).includes(role);
};
