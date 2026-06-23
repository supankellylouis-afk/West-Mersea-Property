/* ============================================================
   Live availability + pricing check
   ------------------------------------------------------------
   Listens for the 'datesSelected' event dispatched by
   js/booking.js whenever a guest picks a check-in/check-out
   range, calls the check-availability Netlify function, and
   renders real-time availability + a peak/off-peak nightly
   breakdown into #availability-status.
   ============================================================ */

(() => {
  'use strict';

  const statusBox = document.getElementById('availability-status');
  const proceedBtn = document.getElementById('proceed-payment-btn');
  if (!statusBox) return;

  let requestSeq = 0;

  function formatDate(ymd) {
    return new Date(ymd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function renderLoading() {
    statusBox.className = 'availability-status loading';
    statusBox.innerHTML = '<span class="avail-spinner"></span> Checking live availability…';
  }

  function renderUnavailable(reason) {
    statusBox.className = 'availability-status unavailable';
    statusBox.innerHTML = `✕ ${reason || 'These dates are not available.'}`;
    if (proceedBtn) proceedBtn.disabled = true;
  }

  function renderError() {
    statusBox.className = 'availability-status error';
    statusBox.innerHTML = '⚠ Could not verify live availability — please try again.';
  }

  function renderAvailable(data) {
    statusBox.className = 'availability-status available';
    const rows = data.breakdown.map(b =>
      `<div class="avail-row"><span>${formatDate(b.date)}</span><span class="avail-tier ${b.tier}">${b.tier === 'peak' ? 'Peak' : 'Off-peak'}</span><span>£${b.rate}</span></div>`
    ).join('');

    statusBox.innerHTML = `
      <div class="avail-ok">✓ Available — ${data.nights} night${data.nights !== 1 ? 's' : ''}</div>
      <div class="avail-breakdown">${rows}</div>
      <div class="avail-row avail-total"><span>Total</span><span></span><span>£${data.price.toLocaleString()}</span></div>
    `;
  }

  function clearStatus() {
    statusBox.className = 'availability-status';
    statusBox.innerHTML = '';
  }

  async function checkAvailability(checkIn, checkOut) {
    const seq = ++requestSeq;
    renderLoading();
    try {
      const res = await fetch('/api/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkIn, checkOut }),
      });
      const data = await res.json();
      if (seq !== requestSeq) return; // a newer request superseded this one

      if (!res.ok || data.error) {
        renderError();
        return;
      }
      if (!data.available) {
        renderUnavailable(data.reason);
        return;
      }
      renderAvailable(data);
    } catch {
      if (seq === requestSeq) renderError();
    }
  }

  document.addEventListener('datesSelected', (e) => {
    checkAvailability(e.detail.checkIn, e.detail.checkOut);
  });

  document.addEventListener('datesCleared', () => {
    requestSeq++; // invalidate any in-flight request
    clearStatus();
  });
})();
