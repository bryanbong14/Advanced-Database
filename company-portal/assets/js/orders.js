// ── orders.js ────────────────────────────────────────────────
// Handles: sales orders page — grouped by customer, expandable rows.

const ORDER_STATUS_BADGE = {
  draft:      'b-gray',
  confirmed:  'b-blue',
  processing: 'b-amber',
  shipped:    'b-blue',
  delivered:  'b-green',
  cancelled:  'b-gray'
};

// ── Page scaffold ─────────────────────────────────────────────
function loadOrdersPage(role) {
  if (!canAccess('orders')) return;

  document.getElementById('orders-content').innerHTML = `
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">Sales Orders</div>
        <div class="table-tools">
          <div class="search-box">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4 4"/>
            </svg>
            <input type="text" placeholder="Search customer or order..." oninput="searchOrders(this.value)"/>
          </div>
          <select class="filter-sel" onchange="filterOrderStatus(this.value)">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button class="btn" id="toggle-orders-btn" onclick="toggleAllOrders()">▸ Expand All</button>
        </div>
      </div>
      <table id="orders-table" style="table-layout:fixed;width:100%">
        <colgroup>
          <col style="width:40px"/>
          <col style="width:36px"/>
          <col style="width:200px"/>
          <col style="width:80px"/>
          <col style="width:120px"/>
          <col style="width:110px"/>
          <col style="width:110px"/>
          <col style="width:80px"/>
          <col style="width:100px"/>
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th></th>
            <th>Customer</th>
            <th>Orders</th>
            <th>Total (RM)</th>
            <th>Order Date</th>
            <th>Delivery Date</th>
            <th>Agent</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="orders-tbody">
          <tr>
            <td colspan="9" style="text-align:center;padding:24px;color:var(--text3)">
              Loading...
            </td>
          </tr>
        </tbody>
      </table>
      <div class="pagination">
        <span id="orders-count">—</span>
      </div>
    </div>`;

  // FIX 5: Initialise ALL state before fetching
  window._orderSearch = '';
  window._orderStatus = '';
  window._openGroups  = new Set();
  window._orderGroups = {};

  fetchOrders();
}

// ── Fetch ─────────────────────────────────────────────────────
async function fetchOrders(statusFilter, search) {
  // Save state — only update if explicitly passed
  if (statusFilter !== undefined) window._orderStatus = statusFilter;
  if (search       !== undefined) window._orderSearch = search;

  let q = sb.from('sales_orders')
    .select('*')
    .order('order_date', { ascending: false })
    .limit(200);

  if (window._orderStatus) q = q.eq('status', window._orderStatus);

  if (window.currentProfile?.role === 'sales') {
    q = q.eq('sales_agent', window.currentProfile.department);
  }

  const { data, error } = await q;
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--red)">
      Error loading orders: ${error.message}
    </td></tr>`;
    return;
  }

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text3)">
      No orders found. Data will appear after AutoCount sync in Phase 2.
    </td></tr>`;
    document.getElementById('orders-count').textContent = '0 orders';
    return;
  }

  // Group by customer, apply client-side search
  const groups = {};
  data.forEach(order => {
    const key = order.customer_name || order.customer_code || 'Unknown';

    if (window._orderSearch) {
      const s = window._orderSearch.toLowerCase();
      const matchCustomer = key.toLowerCase().includes(s);
      const matchOrder    = (order.so_id || order.order_no || '').toLowerCase().includes(s);
      if (!matchCustomer && !matchOrder) return;
    }

    if (!groups[key]) groups[key] = { customer: key, orders: [] };
    groups[key].orders.push(order);
  });

  window._orderGroups = groups;
  renderGroupedOrders();
}

// ── Render grouped rows ───────────────────────────────────────
function renderGroupedOrders() {
  const tbody  = document.getElementById('orders-tbody');
  const groups = window._orderGroups;
  const open   = window._openGroups;

  if (!tbody || !groups) return;

  const groupList = Object.values(groups);

  if (!groupList.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text3)">
      No orders match your search.
    </td></tr>`;
    document.getElementById('orders-count').textContent = '0 customers';
    updateOrderToggleButton();
    return;
  }

  let html = '';

  groupList.forEach((group, index) => {
    const isOpen      = open.has(group.customer);
    const total       = group.orders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const latestOrder = group.orders[0]; // sorted by date desc
    const agent       = latestOrder.sales_agent || '—';

    const hasActive    = group.orders.some(o =>
      ['confirmed', 'processing', 'shipped'].includes(o.status));
    const allCancelled = group.orders.every(o => o.status === 'cancelled');

    const summaryBadge = allCancelled
      ? '<span class="badge b-gray">Cancelled</span>'
      : hasActive
        ? '<span class="badge b-blue">Active</span>'
        : '<span class="badge b-green">All Delivered</span>';

    // FIX 3: Renamed headers to Order Date / Delivery Date
    // Parent row shows latest order date + latest delivery date
    const latestOrderDate    = latestOrder.order_date
      ? new Date(latestOrder.order_date).toLocaleDateString('en-MY') : '—';
    const latestDeliveryDate = latestOrder.delivery_date
      ? new Date(latestOrder.delivery_date).toLocaleDateString('en-MY') : '—';

    const chevronStyle = `
      display:inline-block;
      transition:transform .2s;
      transform:${isOpen ? 'rotate(90deg)' : 'rotate(0deg)'};
      font-size:16px;
      color:var(--text3);
      line-height:1;
    `;

    // ── Parent row — 9 columns ────────────────────────────────
    html += `
      <tr
        class="order-parent-row"
        style="cursor:pointer"
        onclick="toggleOrderGroup('${group.customer.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')"
      >
        <td style="color:var(--text3);font-size:12px;text-align:center">${index + 1}</td>
        <td style="text-align:center">
          <span style="${chevronStyle}">›</span>
        </td>
        <td style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${group.customer}
          <span style="
            display:inline-flex;align-items:center;justify-content:center;
            width:18px;height:18px;border-radius:50%;
            background:var(--blue-l);color:var(--blue);
            font-size:10px;font-weight:600;margin-left:6px;
            vertical-align:middle;flex-shrink:0;
          ">${group.orders.length}</span>
        </td>
        <td style="color:var(--text2)">${group.orders.length} order${group.orders.length > 1 ? 's' : ''}</td>
        <td style="font-weight:500">RM ${total.toLocaleString()}</td>
        <td style="color:var(--text2)">${latestOrderDate}</td>
        <td style="color:var(--text2)">${latestDeliveryDate}</td>
        <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${agent}</td>
        <td>${summaryBadge}</td>
      </tr>`;

    // ── Child rows — 9 columns to match parent exactly ────────
    // FIX 2: 2 empty tds at start (for # and chevron columns)
    // FIX 3: Col 6 = order_date, Col 7 = delivery_date — clearly labelled
    if (isOpen) {
      group.orders.forEach(o => {
        const orderDate    = o.order_date
          ? new Date(o.order_date).toLocaleDateString('en-MY') : '—';
        const deliveryDate = o.delivery_date
          ? new Date(o.delivery_date).toLocaleDateString('en-MY') : '—';

        html += `
          <tr style="background:var(--surface2)">
            <td></td>
            <td></td>
            <td class="mono" style="padding-left:16px;font-size:12px;
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${o.so_id || o.order_no}
            </td>
            <td style="color:var(--text2);font-size:12px">—</td>
            <td style="font-weight:500;font-size:12px">
              RM ${(o.total_amount || 0).toLocaleString()}
            </td>
            <td style="color:var(--text2);font-size:12px">${orderDate}</td>
            <td style="color:var(--text2);font-size:12px">${deliveryDate}</td>
            <td style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${o.sales_agent || '—'}
            </td>
            <td>
              <span class="badge ${ORDER_STATUS_BADGE[o.status] || 'b-gray'}">
                ${o.status}
              </span>
            </td>
          </tr>`;
      });
    }
  });

  tbody.innerHTML = html;

  // Update footer count
  const count = document.getElementById('orders-count');
  if (count) {
    const totalOrders = groupList.reduce((s, g) => s + g.orders.length, 0);
    count.textContent =
      `${groupList.length} customer${groupList.length !== 1 ? 's' : ''}, ${totalOrders} order${totalOrders !== 1 ? 's' : ''}`;
  }

  // FIX 2: Always update button after every render
  updateOrderToggleButton();
}

// ── Single toggle button ──────────────────────────────────────
function toggleAllOrders() {
  const groups = window._orderGroups;
  if (!groups) return;

  const open    = window._openGroups;
  const allKeys = Object.keys(groups);
  const allOpen = allKeys.length > 0 && allKeys.every(k => open.has(k));

  // If all open → collapse all; otherwise → expand all
  if (allOpen) {
    open.clear();
  } else {
    allKeys.forEach(k => open.add(k));
  }

  renderGroupedOrders();
}

// FIX 2: Update button text correctly based on actual state
function updateOrderToggleButton() {
  const btn    = document.getElementById('toggle-orders-btn');
  const groups = window._orderGroups;
  if (!btn || !groups) return;

  const allKeys = Object.keys(groups);
  const allOpen = allKeys.length > 0 &&
    allKeys.every(k => window._openGroups.has(k));

  btn.textContent = allOpen ? '▾ Collapse All' : '▸ Expand All';
}

// ── Toggle single group ───────────────────────────────────────
function toggleOrderGroup(customer) {
  const open = window._openGroups;
  open.has(customer) ? open.delete(customer) : open.add(customer);
  renderGroupedOrders(); // this also calls updateOrderToggleButton()
}

// ── Filter & search ───────────────────────────────────────────
function filterOrderStatus(value) {
  fetchOrders(value, window._orderSearch);
}

function searchOrders(value) {
  fetchOrders(window._orderStatus, value);
}
