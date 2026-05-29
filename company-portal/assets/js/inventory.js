// ── inventory.js ─────────────────────────────────────────────
// Handles: inventory page rendering, stock level bars, search.

function loadInventoryPage(role) {
  if (!canAccess('inventory')) return;

  document.getElementById('inventory-content').innerHTML = `
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">Stock List</div>
        <div class="table-tools">
          <div class="search-box">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4 4"/>
            </svg>
            <input type="text" placeholder="Search item..." oninput="searchInventory(this.value)"/>
          </div>
          <select class="filter-sel" onchange="filterInventoryStatus(this.value)">
            <option value="">All Status</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
            <option value="ok">OK</option>
          </select>
        </div>
      </div>
      <table>
        <colgroup>
          <col style="width: 40px"/>
          <col style="width: 100px"/>
          <col style="width: 180px"/>
          <col style="width: 110px"/>
          <col style="width: 70px"/>
          <col style="width: 70px">
          <col style="width: 80px"/>
          <col style="width: 100px"/>
          <col style="width: 90px"/>
          <col style="width: 90px"/>
        </colgroup>
        <thead>
          <tr>
            <th style="text-align:center">No</th>
            <th style="text-align:center">Code</th>
            <th style="text-align:center">Item Name</th>
            <th style="text-align:center">Category</th>
            <th style="text-align:center">On Hand</th>
            <th style="text-align:center">Reserved</th>
            <th style="text-align:center">Available</th>
            <th style="text-align:center">Reorder Level</th>
            <th>Stock Level</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="inventory-tbody">
          <tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text3)">Loading...</td></tr>
        </tbody>
      </table>
      <div class="pagination">
        <span id="inventory-count">—</span>
        <div class="page-btns" id="inventory-pages"></div>
      </div>
    </div>`;


  window._inventorySearch = '';
  window._inventoryFilter = '';

  fetchInventory();
}

async function fetchInventory(search = '', stockFilter = '') {

  // Save latestt state so both filters apply together
  if (search !== undefined) window._inventorySearch = search;
  if (stockFilter !== undefined) window._inventoryFilter = stockFilter;

  let q = sb.from('inventory')
    .select('*')
    .eq('is_active', true)
    .order('item_name')
    .limit(200);

  if (search) q = q.ilike('item_name', `%${search}%`);

  const { data, error } = await q;
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--red)">
      Error loading inventory: ${error.message}
    </td></tr>`;
    return;
  }

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text3)">
      No inventory found. Data will appear after AutoCount sync in Phase 2.
    </td></tr>`;
    const count = document.getElementById('inventory-count');
    if (count) count.textContent = '0 items';
    return;
  }

  // Apply client-side stock filter
  const keyword = (window._inventorySearch || '').toLowerCase().trim();
  let filtered = keyword
    ? data.filter(i =>
      (i.item_name || '').toLowerCase().includes(keyword) ||
      (i.item_code || '').toLowerCase().includes(keyword) ||
      (i.itm_id || '').toLowerCase().includes(keyword) ||
      (i.category || '').toLowerCase().includes(keyword)
    )
  : data;

  // Apply client-side stock status filter
  const sf = window._inventoryFilter;
  if (sf === 'out') filtered = filtered.filter(i => getAvailable(i) <= 0);
  else if (sf === 'low') filtered = filtered.filter(i => getAvailable(i) > 0 && getAvailable(i) <= i.reorder_level);
  else if (sf === 'ok')  filtered = filtered.filter(i => getAvailable(i) > i.reorder_level);

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text3)">
      No items match this filter.
    </td></tr>`;

    const count = document.getElementById('inventory-count');
    if (count) count.textContent = '0 results';
    return;
  }

  tbody.innerHTML = filtered.map((item, index) => {
    const avail  = getAvailable(item);
    const status = getStockStatus(item, avail);
    const pct    = item.reorder_level > 0
      ? Math.min(100, Math.round((avail / (item.reorder_level * 3)) * 100))
      : (avail > 0 ? 100 : 0);

    return `
      <tr>
        <td style="color:var(--text); font-size:12px; text-align:center">${index + 1}</td>
        <td class="mono" style="text-align:center">${item.itm_id || item.item_code}</td>
        <td style="font-weight:500">${item.item_name}</td>
        <td style="text-align:center">${item.category || '—'}</td>
        <td style="text-align:center">${item.qty_on_hand ?? 0}</td>
        <td style="text-align:center">${item.qty_reserved ?? 0}</td>
        <td style="font-weight:500; text-align:center; color:${
          avail <= 0 
            ? 'var(--red)' 
            : avail <= item.reorder_level 
              ? 'var(--amber)' 
              : 'var(--accent)'
          }">${avail}
        </td>
        <td style="text-align:center">${item.reorder_level ?? 0}</td>
        <td>
          <div class="stock-bar">
            <div class="stock-fill ${status.barClass}" style="width:${pct}%; text-align:center"></div>
          </div>
        </td>
        <td>
          <span class="badge ${status.badgeClass}">${status.label}</span>
        </td>
      </tr>`;
  }).join('');

  // Update footer count
  const count = document.getElementById('inventory-count');
  if (count) {
    count.textContent = filtered.length === data.length
      ? `${data.length} item${data.length !== 1 ? 's' : ''}`
      : `${filtered.length} of ${data.length} items`;
  }
}

// ── Helpers ───────────────────────────────────────────────────
function getAvailable(item) {
  // Use computed column if available, otherwise calculate
  return item.qty_available ?? ((item.qty_on_hand ?? 0) - (item.qty_reserved ?? 0));
}

function getStockStatus(item, avail) {
  if (avail <= 0) return { label: 'Out of Stock', badgeClass: 'b-red',   barClass: 'sf-empty' };
  if (avail <= item.reorder_level) return { label: 'Low Stock', badgeClass: 'b-amber', barClass: 'sf-low' };
  return { label: 'OK', badgeClass: 'b-green', barClass: 'sf-ok' };
}

function searchInventory(value) {
  fetchInventory(value, window._inventoryFilter);
}

function filterInventoryStatus(value) {
  fetchInventory(window._inventorySearch, value);
}
