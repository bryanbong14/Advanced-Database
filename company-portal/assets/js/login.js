// ── login.js ─────────────────────────────────────────────────
// Login page logic: sign in, forgot password, password toggle.

const SUPABASE_URL = 'https://ojojzrrtclsrzwsvboyx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qb2p6cnJ0Y2xzcnp3c3Zib3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjc3MTAsImV4cCI6MjA5NDcwMzcxMH0.uU5rTuhAO0FHcZOR_Tr2uo4RMXamwc4T-r8xbGC9PIk';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('year').textContent = new Date().getFullYear();

// ── ON LOAD — show timeout message if redirected due to inactivity ──
window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);

  if (params.get('reason') === 'timeout') {
    // Show a message telling user why they were logged out
    showError('You were automatically signed out due to inactivity.');
  }

  // Clean up the session flag on any login page arrival
  // (whether from logout, timeout, or fresh open)
  sessionStorage.removeItem('dp_active_session');
});

// ── Enter key support ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const forgotVisible = document.getElementById('forgotForm').style.display === 'block';
  forgotVisible ? handleReset() : handleLogin();
});

// ── Sign in ───────────────────────────────────────────────────
async function handleLogin() {
  const email    = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const btn      = document.getElementById('loginBtn');

  if (!email || !password) {
    showError('Please enter your email and password.');
    return;
  }

  setLoading(btn, true);
  hideError();

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      showError(error.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : error.message);
      return;
    }

    // Verify account exists in public.users and is active
    const { data: userData, error: userError } = await sb
      .from('users')
      .select('is_active')
      .eq('id', data.user.id)
      .single();

    if (userError || !userData) {
      await sb.auth.signOut();
      showError('Your account is not set up yet. Please contact your administrator.');
      return;
    }

    if (!userData.is_active) {
      await sb.auth.signOut();
      showError('Your account has been deactivated. Please contact your administrator.');
      return;
    }

    // Record last login
    await sb.from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.user.id);

    // ── Set session flag — tells dashboard this is a real active login ──
    // sessionStorage is cleared automatically when tab/browser closes,
    // which forces the login page to show on next open.
    sessionStorage.setItem('dp_active_session', '1');

    // Show success then redirect
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('successScreen').classList.add('show');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);

  } catch {
    showError('Something went wrong. Please try again.');
  } finally {
    setLoading(btn, false);
  }
}

// ── Reset password ────────────────────────────────────────────
async function handleReset() {
  const email = document.getElementById('resetEmail').value.trim();
  const btn   = document.getElementById('resetBtn');
  const msg   = document.getElementById('resetMsg');

  if (!email) {
    msg.classList.add('show');
    document.getElementById('resetText').textContent = 'Please enter your email address.';
    return;
  }

  setLoading(btn, true);

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html'
  });

  setLoading(btn, false);
  msg.classList.add('show');
  document.getElementById('resetText').textContent = error
    ? error.message
    : 'Reset link sent! Check your email inbox.';
}

// ── UI helpers ────────────────────────────────────────────────
function setLoading(btn, state) {
  btn.classList.toggle('loading', state);
  btn.disabled = state;
}

function showError(msg) {
  document.getElementById('errorText').textContent = msg;
  document.getElementById('errorMsg').classList.add('show');
  document.getElementById('emailInput').classList.add('error');
  document.getElementById('passwordInput').classList.add('error');
}

function hideError() {
  document.getElementById('errorMsg').classList.remove('show');
  document.getElementById('emailInput').classList.remove('error');
  document.getElementById('passwordInput').classList.remove('error');
}

function togglePassword() {
  const input  = document.getElementById('passwordInput');
  const icon   = document.getElementById('eyeIcon');
  const hidden = input.type === 'password';
  input.type   = hidden ? 'text' : 'password';
  icon.innerHTML = hidden
    ? `<path d="M2 2l12 12M6.5 6.6A5 5 0 0 0 8 13c4.5 0 7-5 7-5a12.5 12.5 0 0 0-2.4-3M4.2 4.3C2.6 5.5 1 8 1 8s2.5 5 7 5a6.8 6.8 0 0 0 3.8-1.1"/><circle cx="8" cy="8" r="2" fill="none"/>`
    : `<path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>`;
}

function showForgot(e) {
  e.preventDefault();
  document.getElementById('loginForm').style.display  = 'none';
  document.getElementById('forgotForm').style.display = 'block';
}

function showLogin(e) {
  e.preventDefault();
  document.getElementById('forgotForm').style.display = 'none';
  document.getElementById('loginForm').style.display  = 'block';
  document.getElementById('resetMsg').classList.remove('show');
}
