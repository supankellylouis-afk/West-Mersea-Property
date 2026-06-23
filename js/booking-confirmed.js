/* ============================================================
   Mersea Island Retreat — booking-confirmed.html
   ------------------------------------------------------------
   Reads ?session_id= from the URL, fetches the booking summary
   from /api/get-booking, and renders it.
   ============================================================ */

(() => {
  'use strict';

  const statusBox = document.getElementById('confirm-status');
  const breakdownBox = document.getElementById('confirm-breakdown');

  function formatDate(ymd) {
    return new Date(ymd).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function showError(message) {
    statusBox.className = 'confirm-error';
    statusBox.innerHTML = message;
    breakdownBox.classList.add('hidden');
  }

  function showBooking(booking) {
    statusBox.classList.add('hidden');
    breakdownBox.classList.remove('hidden');
    const balanceDue = (booking.total_price - booking.deposit_paid).toFixed(2);
    breakdownBox.innerHTML = `
      <div class="pb-row"><span>Check-in</span><span>${formatDate(booking.check_in)}</span></div>
      <div class="pb-row"><span>Check-out</span><span>${formatDate(booking.check_out)}</span></div>
      <div class="pb-row"><span>Guests</span><span>${booking.guests}</span></div>
      <div class="pb-row total"><span>Total stay price</span><span>£${Number(booking.total_price).toLocaleString()}</span></div>
      <div class="pb-row deposit"><span>Deposit paid</span><span>£${Number(booking.deposit_paid).toLocaleString()}</span></div>
      <div class="pb-row"><span>Balance due (8 weeks before arrival)</span><span>£${Number(balanceDue).toLocaleString()}</span></div>
    `;
  }

  async function loadBooking() {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    if (!sessionId) {
      showError('No booking session was found. If you have just completed a payment, please check your email for confirmation.');
      return;
    }

    try {
      const res = await fetch(`/api/get-booking?session_id=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (!res.ok || data.error || !data.booking) {
        showError('We could not find this booking. If you have just completed a payment, please check your email for confirmation — your deposit was still processed successfully.');
        return;
      }
      showBooking(data.booking);
    } catch {
      showError('We could not load your booking details. If you have just completed a payment, please check your email for confirmation.');
    }
  }

  loadBooking();
})();
