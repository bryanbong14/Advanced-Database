// ── auth.js ──────────────────────────────────────────────────
// Session guard, profile load, UI init, profile save, sign out.
// Loaded on: dashboard.html only.

// ── TIMEOUT CONFIG ────────────────────────────────────────────
const TIMEOUT_MS      = 15 * 60 * 1000; // 15 min idle → auto sign out
const TIMEOUT_WARN_MS = 13 * 60 * 1000; // warn at 13 min (2 min before)
let   _timeoutTimer   = null;
let   _warnTimer      = null;
let   _warnBanner     = null;
let   _countdownInterval = null;

// ── ON LOAD ───────────────────────────────────────────────────
window.addEventListener('load', async () => {
  const screen = document.getElementById('loadingScreen');

  try {
    // ── Force login on every fresh browser open / tab open ────
    // sessionStorage is cleared when the tab/browser is closed.
    // If no flag exists, this is a fresh open — always go to login.
    const isActiveSession = sessionStorage.getItem('dp_active_session');
    if (!isActiveSession) {
      await sb.auth.signOut();
      window.location.href = 'login.html';
      return;
    }

    const { data: { session } } = await sb.auth.getSession();

    if (!session) {
      sessionStorage.removeItem('dp_active_session');
      window.location.href = 'login.html';
      return;
    }

    window.currentUser = session.user;

    const { data: profile, error } = await sb
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error || !profile) {
      window.location.href = 'login.html';
      return;
    }

    if (!profile.is_active) {
      await sb.auth.signOut();
      sessionStorage.removeItem('dp_active_session');
      window.location.href = 'login.html';
      return;
    }

    window.currentProfile = profile;
    initUI(profile);
    loadDashboardStats(profile);

    // Start idle timeout after successful load
    startIdleTimeout();

    if (screen) screen.style.display = 'none';

  } catch (err) {
    console.error('Auth init error:', err);
    if (screen) screen.style.display = 'none';
  }
});

// ── IDLE TIMEOUT ──────────────────────────────────────────────
function startIdleTimeout() {
  // Create warning banner and append to body once
  _warnBanner = document.createElement('div');
  _warnBanner.id = 'timeout-banner';
  _warnBanner.style.cssText = `
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 9999;
    background: #B87010;
    color: white;
    font-size: 13px;
    font-weight: 500;
    padding: 10px 20px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    font-family: var(--font);
  `;
  _warnBanner.innerHTML = `
    ⚠️ You will be signed out in
    <strong><span id="timeout-countdown">2:00</span></strong>
    due to inactivity.
    <span
      onclick="resetIdleTimeout()"
      style="cursor:pointer; text-decoration:underline; margin-left:12px;">
      Stay signed in
    </span>
  `;
  document.body.appendChild(_warnBanner);

  resetIdleTimeout();

  // Any of these events resets the idle timer
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    .forEach(evt => document.addEventListener(evt, resetIdleTimeout, { passive: true }));
}

function resetIdleTimeout() {
  clearTimeout(_timeoutTimer);
  clearTimeout(_warnTimer);
  clearInterval(_countdownInterval);

  // Hide warning banner if visible
  if (_warnBanner) _warnBanner.style.display = 'none';

  // Show warning 2 minutes before timeout
  _warnTimer = setTimeout(() => {
    if (_warnBanner) {
      _warnBanner.style.display = 'block';
      startCountdown(2 * 60);
    }
  }, TIMEOUT_WARN_MS);

  // Auto sign out after full idle period
  _timeoutTimer = setTimeout(() => {
    handleSignOut(true);
  }, TIMEOUT_MS);
}

function startCountdown(seconds) {
  let remaining = seconds;
  const el = document.getElementById('timeout-countdown');

  _countdownInterval = setInterval(() => {
    remaining--;
    if (el) {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }
    if (remaining <= 0) clearInterval(_countdownInterval);
  }, 1000);
}

// ── INIT UI ───────────────────────────────────────────────────
function initUI(profile) {
  const role     = profile.role;
  const initials = profile.full_name
    .split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  document.getElementById('userAvatar').textContent    = initials;
  document.getElementById('userName').textContent      = profile.full_name;
  document.getElementById('userRoleLabel').textContent = role.charAt(0).toUpperCase() + role.slice(1);

  document.getElementById('profileAvatar').textContent  = initials;
  document.getElementById('profileName').textContent    = profile.full_name;
  document.getElementById('profileRole').textContent    = role + (profile.department ? ' — ' + profile.department : '');
  document.getElementById('profileFullName').value      = profile.full_name;
  document.getElementById('profileEmail').value         = profile.email;
  document.getElementById('profilePhone').value         = profile.phone || '';
  document.getElementById('profileUserId').value        = profile.user_id || '—';

  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-MY', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const hr       = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('welcomeTitle').textContent =
    greeting + ', ' + profile.full_name.split(' ')[0] + '!';

  const subMap = {
    admin:     "You have full system access. Here's the company overview.",
    finance:   "Here's your financial summary for today.",
    sales:     "Here's your sales activity for today.",
    warehouse: "Here's the inventory and order status."
  };
  document.getElementById('welcomeSub').textContent = subMap[role] || "Here's your dashboard.";

  // Show nav items for this role
  (window.ROLE_NAV_ACCESS[role] || []).forEach(id => {
    const el = document.getElementById('nav-' + id);
    if (el) el.classList.remove('hidden');
  });

  if (role === 'admin') {
    document.getElementById('admin-nav-label').style.display = '';
  }

  buildQuickCards(role);
  loadCustomersPage(role);
  loadInvoicesPage(role);
  loadOrdersPage(role);
  loadInventoryPage(role);
  if (role === 'admin') loadUsersPage();
}

// ── SAVE PROFILE ──────────────────────────────────────────────
async function saveProfile() {
  const name  = document.getElementById('profileFullName').value.trim();
  const phone = document.getElementById('profilePhone').value.trim();
  const msg   = document.getElementById('profileMsg');

  if (!name) { showMsg(msg, 'Name cannot be empty.', 'error'); return; }

  const { error } = await sb.from('users')
    .update({ full_name: name, phone })
    .eq('id', currentUser.id);

  if (error) {
    showMsg(msg, error.message, 'error');
  } else {
    showMsg(msg, 'Profile updated successfully!', 'success');
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('userName').textContent      = name;
    document.getElementById('profileName').textContent   = name;
    document.getElementById('userAvatar').textContent    = initials;
    document.getElementById('profileAvatar').textContent = initials;
  }
}

// ── SIGN OUT ──────────────────────────────────────────────────
async function handleSignOut(timedOut = false) {
  clearTimeout(_timeoutTimer);
  clearTimeout(_warnTimer);
  clearInterval(_countdownInterval);

  await sb.auth.signOut();
  sessionStorage.removeItem('dp_active_session');

  window.location.href = timedOut
    ? 'login.html?reason=timeout'
    : 'login.html?logout=1';
}
