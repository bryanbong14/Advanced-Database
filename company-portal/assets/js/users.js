// ── users.js ─────────────────────────────────────────────────
// Handles: user management page, add user modal, toggle active.
// Admin-only — only called when role === 'admin'.

const ROLE_TAG_CLASS = {
  admin:     'rt-admin',
  finance:   'rt-finance',
  sales:     'rt-sales',
  warehouse: 'rt-warehouse'
};

const COL_WIDTHS = ['90px', '160px', '200px', '90px', '120px', '110px', '80px', '100px'];

// ── Load & render ─────────────────────────────────────────────
async function loadUsersPage() {
  const { data } = await sb.from('users').select('*').order('created_at');
  const tbody = document.getElementById('users-tbody');
  if (!tbody || !data) return;
  injectColgroup();
  renderUsersTable(data);
}

function injectColgroup() {
  const table = document.getElementById('users-table');
  if (!table || table.querySelector('colgroup')) return;
  const cg = document.createElement('colgroup');
  COL_WIDTHS.forEach(w => {
    const col = document.createElement('col');
    col.style.width = w;
    cg.appendChild(col);
  });
  table.prepend(cg);
}

function renderUsersTable(data) {
  const tbody = document.getElementById('users-tbody');
  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(u => {
    const isSelf   = u.id === window.currentUser?.id;
    const isActive = u.is_active;

    const statusBadge = isActive
      ? `<span class="badge b-green">Active</span>`
      : `<span class="badge b-red">Inactive</span>`;

    const btnDisabled = isSelf ? 'disabled title="You cannot deactivate your own account"' : '';
    const btnStyle    = isSelf ? 'opacity:0.4;cursor:not-allowed;' : '';
    const actionBtn   = `
      <button class="btn btn-sm" style="${btnStyle}" ${btnDisabled}
        onclick="${isSelf ? '' : `toggleUserActive('${u.id}', ${isActive})`}">
        ${isActive ? 'Deactivate' : 'Activate'}
      </button>`;

    return `
      <tr id="user-row-${u.id}">
        <td class="mono">${u.user_id || '—'}</td>
        <td style="font-weight:500">
          ${u.full_name}
          ${isSelf ? '<span style="font-size:10px;color:var(--text3);margin-left:4px">(you)</span>' : ''}
        </td>
        <td style="color:var(--text2)">${u.email}</td>
        <td><span class="role-tag ${ROLE_TAG_CLASS[u.role] || ''}">${u.role}</span></td>
        <td>${u.department || '—'}</td>
        <td style="color:var(--text3)">
          ${u.last_login ? new Date(u.last_login).toLocaleDateString('en-MY') : 'Never'}
        </td>
        <td id="user-status-${u.id}">${statusBadge}</td>
        <td id="user-action-${u.id}">${actionBtn}</td>
      </tr>`;
  }).join('');
}

// ── Search ────────────────────────────────────────────────────
async function filterUsers(search) {
  const { data } = await sb.from('users').select('*')
    .ilike('full_name', `%${search}%`).order('created_at');
  if (data) renderUsersTable(data);
}

// ── Toggle active ─────────────────────────────────────────────
async function toggleUserActive(userId, currentStatus) {
  if (userId === window.currentUser?.id) {
    alert('You cannot deactivate your own account.');
    return;
  }

  const newStatus  = !currentStatus;
  const statusCell = document.getElementById(`user-status-${userId}`);
  const actionCell = document.getElementById(`user-action-${userId}`);

  // Optimistic UI update
  if (statusCell) {
    statusCell.innerHTML = newStatus
      ? `<span class="badge b-green">Active</span>`
      : `<span class="badge b-red">Inactive</span>`;
  }
  if (actionCell) {
    actionCell.innerHTML = `
      <button class="btn btn-sm"
        onclick="toggleUserActive('${userId}', ${newStatus})">
        ${newStatus ? 'Deactivate' : 'Activate'}
      </button>`;
  }

  const { error } = await sb.from('users')
    .update({ is_active: newStatus }).eq('id', userId);

  if (error) {
    // Revert on failure
    if (statusCell) {
      statusCell.innerHTML = currentStatus
        ? `<span class="badge b-green">Active</span>`
        : `<span class="badge b-red">Inactive</span>`;
    }
    if (actionCell) {
      actionCell.innerHTML = `
        <button class="btn btn-sm"
          onclick="toggleUserActive('${userId}', ${currentStatus})">
          ${currentStatus ? 'Deactivate' : 'Activate'}
        </button>`;
    }
    alert('Failed to update: ' + error.message);
  }
}

// ── Add user via Edge Function ────────────────────────────────
async function addUser() {
  const full_name  = document.getElementById('newUserName').value.trim();
  const email      = document.getElementById('newUserEmail').value.trim();
  const password   = document.getElementById('newUserPassword').value;
  const role       = document.getElementById('newUserRole').value;
  const department = document.getElementById('newUserDept').value.trim();
  const phone      = document.getElementById('newUserPhone').value.trim();
  const msg        = document.getElementById('addUserMsg');

  // Client-side validation
  if (!full_name || !email || !password || !role) {
    showMsg(msg, 'Please fill in all required fields.', 'error');
    return;
  }
  if (password.length < 8) {
    showMsg(msg, 'Password must be at least 8 characters.', 'error');
    return;
  }
  if (password !== document.getElementById('newUserPasswordConfirm').value) {
    showMsg(msg, 'Passwords do not match.', 'error');
    return;
  }

  // Set button loading state
  const btn = document.getElementById('addUserBtn');
  btn.classList.add('loading');
  btn.disabled = true;
  msg.style.display = 'none';

  try {
    // Get current session token to pass to Edge Function
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      showMsg(msg, 'Session expired. Please log in again.', 'error');
      return;
    }

    // Call Edge Function — admin API runs server-side (safe)
    const response = await fetch(
      `${window.SUPABASE_URL}/functions/v1/create-user`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey':        window.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ full_name, email, password, role, department, phone })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      showMsg(msg, result.error || 'Failed to create user.', 'error');
      return;
    }

    // Success
    showMsg(msg, `✓ ${result.message}`, 'success');
    setTimeout(() => {
      closeModal('addUserModal');
      resetAddUserForm();
      loadUsersPage();
    }, 1500);

  } catch (err) {
    showMsg(msg, 'Network error. Please try again.', 'error');
    console.error('Add user error:', err);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── Reset form after close ────────────────────────────────────
function resetAddUserForm() {
  ['newUserName','newUserEmail','newUserPassword',
   'newUserPasswordConfirm','newUserDept','newUserPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('newUserRole').value = 'sales';
  const msg = document.getElementById('addUserMsg');
  if (msg) msg.style.display = 'none';
  updatePasswordStrength('');
}

// ── Password strength indicator ───────────────────────────────
function updatePasswordStrength(pw) {
  const bar   = document.getElementById('pw-strength-bar');
  const label = document.getElementById('pw-strength-label');
  if (!bar || !label) return;

  const hasLength  = pw.length >= 8;
  const hasUpper   = /[A-Z]/.test(pw);
  const hasNumber  = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const score      = [hasLength, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  const levels = [
    { pct: '0%',   color: 'var(--border)',  text: '' },
    { pct: '25%',  color: 'var(--red)',     text: 'Weak' },
    { pct: '50%',  color: 'var(--amber)',   text: 'Fair' },
    { pct: '75%',  color: '#F0A820',        text: 'Good' },
    { pct: '100%', color: 'var(--accent)',  text: 'Strong' },
  ];

  const lvl = pw.length === 0 ? levels[0] : levels[score];
  bar.style.width      = lvl.pct;
  bar.style.background = lvl.color;
  label.textContent    = lvl.text;
  label.style.color    = lvl.color;
}
