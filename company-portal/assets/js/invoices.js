// ── invoices.js ──────────────────────────────────────────────
// Handles: invoices page rendering, status filter.

const INVOICE_STATUS_BADGE = {
  paid:      'b-green',
  pending:   'b-amber',
  overdue:   'b-red',
  draft:     'b-gray',
  cancelled: 'b-gray'
};

function resolveInvoiceStatus(invoice) {
  const stored = invoice.status;
  if (stored === 'paid' || stored === 'cancelled') return stored;

  if (invoice.due_date) {
    const due = new Date(invoice.due_date);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (due < today) return 'overdue';
  }

  return stored;
}

function loadInvoicesPage(role) {
  if (!canAccess('invoices')) return;

  document.getElementById('invoices-content').innerHTML = `
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">Invoices</div>
        <div class="table-tools">
          <div class="search-box">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4 4"/></svg>
            <input 
              type="text" 
              placeholder="Search invoice or customer..."
              oninput="searchInvoices(this.value)"/>
          </div>
          <select class="filter-sel" onchange="filterInvoiceStatus(this.value)">
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
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
          <col style="width:60px"/>
          <col style="width:90px"/>
        </colgroup>
        <thead>
          <tr>
            <th>No</th>
            <th>Invoice No</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Due Date</th>
            <th>Total (RM)</th>
            <th>Agent</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="invoices-tbody">
          <tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">Loading...</td></tr>
        </tbody>
      </table>
      <div class="pagination">
        <span id="invoices-count">-</span>
      </div>
    </div>`;

    // Strore current filter state so search + filter work together
    window._invoiceFilter = '';
    window._invoiceSearch = '';

  fetchInvoices();
}

//-- Fetch---
async function fetchInvoices(statusFilter = '', search = '') {
  // Store latest filter/ search so both can be applied together
  if (statusFilter !== undefined) window._invoiceFilter = statusFilter;
  if (search !== undefined) window._invoiceSearch = search;

  let q = sb.from('invoices')
    .select('*')
    .order('invoice_date', { ascending: false })
    .limit(200); //fetch more so client-side search has full data

  // Server-side status filter (efficient)
  if (window._invoiceFilter === 'overdue') {
    q = q.in('status', ['pending', 'overdue']);
  } else if (window._invoiceFilter) {
    q = q.eq('status', window._invoiceFilter);
  }

  // Sales staff only see their own invoices
  if (window.currentProfile?.role === 'sales') {
    q = q.eq('sales_agent', window.currentProfile.department);
  }

  const { data, error } = await q;
  const tbody = document.getElementById('invoices-tbody');
  if(!tbody) return;

  if(error){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--red)">
      Error loading invoices: ${error.message}
    </td></tr>`;
    return;
  }

  if (!data || !data.length){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text3)">
      No invoices found. Data will appear after AutoCount sync in Phase 2.
    </td></tr>`;
    const count = document.getElementById('invoices-count');
    if (count) count.textContent = '0 invoices';
    return;
  }

  //Resolve actual status for each invoice (catches DB-stale overdue)
  const withStatus = data.map(i => ({
    ...i,
    displayStatus: resolveInvoiceStatus(i)
  }));

  // If filtering by overdue, keep only truly overdue records
  let filtered = withStatus;
  if (window._invoiceFilter === 'overdue') {
    filtered = withStatus.filter(i => i.displayStatus === 'overdue');
  }

  // Client-side search - filters by invoice no OR customer name
  const keyword = (window._invoiceSearch || '').toLowerCase().trim();
  if (keyword){
    filtered = filtered.filter(i =>
      (i.inv_id        || '').toLowerCase().includes(keyword) ||
      (i.invoice_no    || '').toLowerCase().includes(keyword) ||
      (i.customer_name || '').toLowerCase().includes(keyword) ||
      (i.sales_agent   || '').toLowerCase().includes(keyword)
    );
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text3)">
      No invoices match your search.
    </td></tr>`;
    const count = document.getElementById('invoices-count');
    if (count) count.textContent = '0 results';
    return;
  }

  // Render rows with index number in first column
  tbody.innerHTML = filtered.map((i, index) => {
    const status = i.displayStatus;

    // Hight due date in red if overdue
    const dueDateStyle = status === 'overdue'
    ? 'color:var(--red); font-weight:500'
    : '';
  
    
    return `
    <tr>
      <td style="color:var(--text); font-size:12px">${index + 1}</td>
      <td class="mono">${i.inv_id || i.invoice_no}</td>
      <td>${i.customer_name || '-'}</td>
      <td>${i.invoice_date ? new Date(i.invoice_date).toLocaleDateString('en-MY') : '-'}</td>
      <td>${i.due_date ? new Date(i.due_date).toLocaleDateString('en-MY') : '-'}</td>
      <td style="font-weight:500">RM ${(i.total_amount || 0).toLocaleString()}</td>
      <td>${i.sales_agent || '-'}</td>
      <td><span class="badge ${INVOICE_STATUS_BADGE[i.status] || 'b-gray'}">${i.status}</span></td>
    </tr>`
  }).join('');

  //Update footer count
  const count = document.getElementById('invoices-count');
  if (count) {
    count.textContent = filtered.length === data.length
      ? `${data.length} invoice${data.length !== 1 ? 's' : ''}`
      : `${filtered.length} of ${data.length} invoices`;
  }
}
//--Search & filter
function searchInvoices(value) {
  fetchInvoices(window._invoiceFilter, value);
}

function filterInvoiceStatus(value) {
  fetchInvoices(value, window._invoiceSearch);
}
