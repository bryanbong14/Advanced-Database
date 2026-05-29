// ── customers.js ─────────────────────────────────────────────
// Handles: customers page rendering, search, add customer modal.

function loadCustomersPage(role) {
  if (!canAccess('customers')) return;

  document.getElementById('customers-content').innerHTML = `
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">All Customers</div>
        <div class="table-tools">
          <div class="search-box">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4 4"/>
            </svg>
            <input type="text" placeholder="Search company..." oninput="searchCustomers(this.value)"/>
          </div>
          <select class="filter-sel" onchange="filterCustomerStatus(this.value)">
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>
      <table>
        <colgroup>
          <col style="width:40px"/>
          <col style="width:120px"/>
          <col style="width:180px"/>
          <col style="width:100px"/>
          <col style="width:100px"/>
          <col style="width:110px"/>
          <col style="width:110px"/>
          <col style="width:60px"/>
          <col style="width:90px"/>
        </colgroup>
        <thead>
          <tr>
            <th>No</th>
            <th>ID</th>
            <th>Company Name</th>
            <th>Contact Person</th>
            <th>Phone</th>
            <th>Credit Limit</th>
            <th>Balance</th>
            <th>Agent</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="customers-tbody">
          <tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text3)">Loading...</td></tr>
        </tbody>
      </table>
      <div class="pagination">
        <span id="customers-count">—</span>
      </div>
    </div>`;

  window._customerFilter = '';
  window._customerSearch = '';

  fetchCustomers();
}

async function fetchCustomers(search = '', statusFilter = '') {
  if (search !== undefined)       window._customerSearch = search;
  if (statusFilter !== undefined) window._customerFilter = statusFilter;
  
  let q = sb.from('customers').select('*').order('company_name').limit(200);

  if (window._customerFilter !== '') {
    q = q.eq('is_active', window._customerFilter === 'true');
  }

  const { data, error } = await q;
  const tbody = document.getElementById('customers-tbody');
  if (!tbody) return;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--red)">
      Error loading customers: ${error.message}
    </td></tr>`;
    return;
  }

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text3)">
      No customers found. Data will appear after AutoCount sync in Phase 2.
    </td></tr>`;
    const count = document.getElementById('customers-count');
    if (count) count.textContent = '0 customers';
    return;
  }

  // Client-side search - matches company name, contact, phone, agent code
  const keyword = (window._customerSearch || '').toLowerCase().trim();
  const filtered = keyword
    ? data.filter(c =>
      (c.company_name || '').toLowerCase().includes(keyword) ||
      (c.contact_person || '').toLowerCase().includes(keyword) ||
      (c.phone || '').toLowerCase().includes(keyword) ||
      (c.cust_id || '').toLowerCase().includes(keyword) ||
      (c.agent_code || '').toLowerCase().includes(keyword)
    )
    : data;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text3)">
      No customers match your search.
    </td></tr>`;
    const count = document.getElementById('customers-count');
    if (count) count.textContent = '0 results';
    return;
  }

  tbody.innerHTML = filtered.map((c, index )=> {
    const balanceColor = c.current_balance > c.credit_limit * 0.8
      ? 'var(--red)' : 'var(--accent)';
    return `
      <tr>
        <td style="color:var(--text); font-size:12px">${index + 1}</td>
        <td class="mono">${c.cust_id || c.customer_code || '—'}</td>
        <td style="font-weight:500">${c.company_name}</td>
        <td>${c.contact_person || '—'}</td>
        <td>${c.phone || '—'}</td>
        <td>RM ${(c.credit_limit || 0).toLocaleString()}</td>
        <td style="font-weight:500;color:${balanceColor}">
          RM ${(c.current_balance || 0).toLocaleString()}
        </td>
        <td>${c.agent_code || '—'}</td>
        <td>
          <span class="badge ${c.is_active ? 'b-green' : 'b-gray'}">
            ${c.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
      </tr>`;
  }).join('');

  // -- Footer Count--
  const count = document.getElementById('customers-count');
  if (count) {
    count.textContent = filtered.length === data.length
        ? `${data.length} customers${data.length !== 1 ? 's' : ''}`
        : `${filtered.length} of ${data.length} customers`;
  }      
}

// Called by search input
function searchCustomers(value) {
  fetchCustomers(value, window._customerFilter);
}

// Called by status filter dropdown
function filterCustomerStatus(value) {
  fetchCustomers(window._customerSearch, value);
}
