/* ============================================================
   Mersea Island Retreat — admin.html
   ------------------------------------------------------------
   Logs in against /api/admin-login, holds the session token in
   sessionStorage (cleared when the browser tab closes), and uses
   it as a Bearer token against the admin-* Netlify functions.
   ============================================================ */

(() => {
  'use strict';

  const TOKEN_KEY = 'mir_admin_token';

  const loginScreen   = document.getElementById('admin-login-screen');
  const dashboard      = document.getElementById('admin-dashboard');
  const logoutLink     = document.getElementById('admin-logout');

  const loginForm      = document.getElementById('admin-login-form');
  const passwordEl     = document.getElementById('admin-password');
  const loginErrorEl   = document.getElementById('admin-login-error');
  const loginBtn       = document.getElementById('admin-login-btn');
  const loginBtnText   = document.getElementById('admin-login-btn-text');
  const loginSpinner   = document.getElementById('admin-login-spinner');

  function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
  function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

  function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    logoutLink.classList.remove('hidden');
    loadSummary();
    loadBookings();
    loadPricing();
  }

  function showLogin() {
    dashboard.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    logoutLink.classList.add('hidden');
  }

  async function authedFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
    });
    if (res.status === 401) {
      clearToken();
      showLogin();
      throw new Error('Session expired — please log in again.');
    }
    return res;
  }

  /* ---- Login ---- */
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorEl.textContent = '';
    loginBtn.disabled = true;
    loginBtnText.textContent = 'Logging in…';
    loginSpinner.classList.remove('hidden');

    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordEl.value }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        loginErrorEl.textContent = data.error || 'Incorrect password.';
        return;
      }
      setToken(data.token);
      passwordEl.value = '';
      showDashboard();
    } catch {
      loginErrorEl.textContent = 'Could not reach the server — please try again.';
    } finally {
      loginBtn.disabled = false;
      loginBtnText.textContent = 'Log In';
      loginSpinner.classList.add('hidden');
    }
  });

  logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    clearToken();
    showLogin();
  });

  /* ---- Summary ---- */
  async function loadSummary() {
    try {
      const res = await authedFetch('/api/admin-summary');
      const data = await res.json();
      if (!res.ok) return;

      document.getElementById('stat-next-booking').textContent = data.nextBooking
        ? `${data.nextBooking.guest_name} — ${data.nextBooking.check_in}`
        : 'No upcoming bookings';
      document.getElementById('stat-occupancy').textContent = `${data.occupancyPct}%`;
      document.getElementById('stat-revenue').textContent = `£${Number(data.revenueThisMonth).toLocaleString()}`;
    } catch { /* handled by authedFetch redirect to login */ }
  }

  /* ---- Bookings table ---- */
  async function loadBookings() {
    const tbody = document.getElementById('bookings-tbody');
    try {
      const res = await authedFetch('/api/admin-bookings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load bookings');

      if (!data.bookings.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="admin-table-empty">No upcoming bookings.</td></tr>';
        return;
      }

      tbody.innerHTML = data.bookings.map(b => `
        <tr>
          <td>${b.check_in}</td>
          <td>${b.check_out}</td>
          <td>${escapeHtml(b.guest_name)}</td>
          <td>${b.guests}</td>
          <td><span class="status-pill ${b.status}">${b.status}</span></td>
          <td>£${Number(b.deposit_paid).toLocaleString()}</td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-table-empty">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  /* ---- Pricing table ---- */
  async function loadPricing() {
    const tbody = document.getElementById('pricing-tbody');
    try {
      const res = await authedFetch('/api/admin-pricing');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load pricing rules');

      if (!data.rules.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="admin-table-empty">No pricing rules yet.</td></tr>';
        return;
      }

      tbody.innerHTML = data.rules.map(r => `
        <tr>
          <td>${r.start_date}</td>
          <td>${r.end_date}</td>
          <td>£${Number(r.price_per_night).toLocaleString()}</td>
          <td>${r.min_stay_nights}</td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" class="admin-table-empty">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  /* ---- Block dates ---- */
  const blockForm = document.getElementById('block-dates-form');
  const blockStatus = document.getElementById('block-dates-status');
  blockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    blockStatus.className = 'admin-form-status';
    blockStatus.textContent = '';

    const startDate = document.getElementById('block-start').value;
    const endDate = document.getElementById('block-end').value;
    const reason = document.getElementById('block-reason').value.trim();

    if (endDate <= startDate) {
      blockStatus.className = 'admin-form-status err';
      blockStatus.textContent = 'End date must be after start date.';
      return;
    }

    try {
      const res = await authedFetch('/api/admin-block-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, reason }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to block dates');

      blockStatus.className = 'admin-form-status ok';
      blockStatus.textContent = `Blocked ${data.blocked.length} night(s).`;
      blockForm.reset();
    } catch (err) {
      blockStatus.className = 'admin-form-status err';
      blockStatus.textContent = err.message;
    }
  });

  /* ---- Pricing form ---- */
  const pricingForm = document.getElementById('pricing-form');
  const pricingStatus = document.getElementById('pricing-status');
  pricingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    pricingStatus.className = 'admin-form-status';
    pricingStatus.textContent = '';

    const startDate = document.getElementById('price-start').value;
    const endDate = document.getElementById('price-end').value;
    const pricePerNight = Number(document.getElementById('price-rate').value);
    const minStayNights = Number(document.getElementById('price-minstay').value) || 1;

    if (endDate < startDate) {
      pricingStatus.className = 'admin-form-status err';
      pricingStatus.textContent = 'End date must not be before start date.';
      return;
    }

    try {
      const res = await authedFetch('/api/admin-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, pricePerNight, minStayNights }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to save pricing rule');

      pricingStatus.className = 'admin-form-status ok';
      pricingStatus.textContent = 'Pricing rule saved.';
      pricingForm.reset();
      document.getElementById('price-minstay').value = '1';
      loadPricing();
    } catch (err) {
      pricingStatus.className = 'admin-form-status err';
      pricingStatus.textContent = err.message;
    }
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /* ---- Init ---- */
  if (getToken()) {
    showDashboard();
  } else {
    showLogin();
  }
})();
