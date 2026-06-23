/* ============================================================
   Mersea Island Retreat — book.html booking form
   ------------------------------------------------------------
   - Calls /api/check-availability on date change for live
     pricing + a clear nights × rate breakdown.
   - Validates all fields before allowing submission.
   - On submit, calls /api/create-checkout-session and redirects
     to Stripe Checkout for the £200 deposit.
   ============================================================ */

(() => {
  'use strict';

  const DEPOSIT = 200;

  const form        = document.getElementById('book-form');
  const checkinEl    = document.getElementById('b-checkin');
  const checkoutEl   = document.getElementById('b-checkout');
  const guestsEl     = document.getElementById('b-guests');
  const fnameEl      = document.getElementById('b-fname');
  const lnameEl      = document.getElementById('b-lname');
  const emailEl      = document.getElementById('b-email');
  const phoneEl      = document.getElementById('b-phone');

  const payBtn      = document.getElementById('book-pay-btn');
  const payBtnText  = document.getElementById('book-pay-btn-text');
  const paySpinner  = document.getElementById('book-pay-spinner');

  const statusBox    = document.getElementById('summary-status');
  const breakdownBox = document.getElementById('price-breakdown');

  /* Restrict the date pickers to today onward */
  const todayStr = new Date().toISOString().slice(0, 10);
  checkinEl.min = todayStr;
  checkoutEl.min = todayStr;

  let latestQuote = null; // { available, price, nights, breakdown }
  let availSeq = 0;

  /* ---- Live availability + pricing ---- */
  function resetSummary(message) {
    statusBox.className = 'summary-status';
    statusBox.innerHTML = '';
    breakdownBox.innerHTML = `<p class="pb-empty">${message}</p>`;
    latestQuote = null;
    updatePayButtonState();
  }

  function renderLoading() {
    statusBox.className = 'summary-status loading';
    statusBox.innerHTML = '<span class="spinner"></span> Checking live availability…';
    breakdownBox.innerHTML = '';
  }

  function renderUnavailable(reason) {
    statusBox.className = 'summary-status unavailable';
    statusBox.innerHTML = `✕ ${reason || 'These dates are not available.'}`;
    breakdownBox.innerHTML = '';
    latestQuote = null;
    updatePayButtonState();
  }

  function renderError() {
    statusBox.className = 'summary-status error';
    statusBox.innerHTML = '⚠ Could not verify live availability — please try again.';
    breakdownBox.innerHTML = '';
    latestQuote = null;
    updatePayButtonState();
  }

  function renderQuote(data) {
    statusBox.className = 'summary-status available';
    statusBox.innerHTML = `✓ Available — ${data.nights} night${data.nights !== 1 ? 's' : ''}`;

    const avgRate = Math.round((data.price / data.nights) * 100) / 100;
    breakdownBox.innerHTML = `
      <div class="pb-row"><span>${data.nights} night${data.nights !== 1 ? 's' : ''} × £${avgRate}/night avg</span><span>£${data.price.toLocaleString()}</span></div>
      <div class="pb-row total"><span>Total</span><span>£${data.price.toLocaleString()}</span></div>
      <div class="pb-row deposit"><span>Deposit due today</span><span>£${DEPOSIT}</span></div>
      <div class="pb-row"><span>Balance due 8 weeks before arrival</span><span>£${(data.price - DEPOSIT).toLocaleString()}</span></div>
    `;
    latestQuote = data;
    updatePayButtonState();
  }

  async function checkAvailability() {
    const checkIn = checkinEl.value;
    const checkOut = checkoutEl.value;

    if (!checkIn || !checkOut) {
      resetSummary('Select your check-in and check-out dates to see live pricing.');
      return;
    }
    if (checkOut <= checkIn) {
      resetSummary('Check-out must be after check-in.');
      return;
    }

    const seq = ++availSeq;
    renderLoading();
    try {
      const res = await fetch('/api/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkIn, checkOut }),
      });
      const data = await res.json();
      if (seq !== availSeq) return;

      if (!res.ok || data.error) { renderError(); return; }
      if (!data.available) { renderUnavailable(data.reason); return; }
      renderQuote(data);
    } catch {
      if (seq === availSeq) renderError();
    }
  }

  checkinEl.addEventListener('change', checkAvailability);
  checkoutEl.addEventListener('change', checkAvailability);

  /* ---- Validation ---- */
  function setFieldError(input, errorId, message) {
    const errEl = document.getElementById(errorId);
    if (message) {
      input.classList.add('invalid');
      errEl.textContent = message;
    } else {
      input.classList.remove('invalid');
      errEl.textContent = '';
    }
    return !message;
  }

  function validateForm() {
    let ok = true;

    ok = setFieldError(checkinEl, 'err-checkin', checkinEl.value ? '' : 'Check-in date is required.') && ok;
    ok = setFieldError(
      checkoutEl, 'err-checkout',
      !checkoutEl.value ? 'Check-out date is required.'
        : (checkinEl.value && checkoutEl.value <= checkinEl.value) ? 'Check-out must be after check-in.' : ''
    ) && ok;

    const guests = Number(guestsEl.value);
    ok = setFieldError(
      guestsEl, 'err-guests',
      !guestsEl.value ? 'Please select the number of guests.'
        : (guests < 1 || guests > 8) ? 'Maximum occupancy is 8 guests.' : ''
    ) && ok;

    ok = setFieldError(fnameEl, 'err-fname', fnameEl.value.trim() ? '' : 'First name is required.') && ok;
    ok = setFieldError(lnameEl, 'err-lname', lnameEl.value.trim() ? '' : 'Last name is required.') && ok;

    const emailVal = emailEl.value.trim();
    ok = setFieldError(
      emailEl, 'err-email',
      !emailVal ? 'Email address is required.'
        : !/\S+@\S+\.\S+/.test(emailVal) ? 'Please enter a valid email address.' : ''
    ) && ok;

    const phoneVal = phoneEl.value.trim();
    ok = setFieldError(
      phoneEl, 'err-phone',
      !phoneVal ? 'Phone number is required.'
        : !/^[+\d][\d\s()-]{6,}$/.test(phoneVal) ? 'Please enter a valid phone number.' : ''
    ) && ok;

    if (!latestQuote || !latestQuote.available) ok = false;

    return ok;
  }

  /* Re-validate a field as the guest types, once the form has been submitted once */
  let attemptedSubmit = false;
  [checkinEl, checkoutEl, guestsEl, fnameEl, lnameEl, emailEl, phoneEl].forEach(el => {
    el.addEventListener('input', () => { if (attemptedSubmit) validateForm(); });
  });

  function updatePayButtonState() {
    const hasQuote = !!(latestQuote && latestQuote.available);
    payBtn.disabled = !hasQuote;
  }

  /* ---- Submit → Stripe Checkout ---- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    attemptedSubmit = true;

    if (!validateForm()) return;

    payBtn.disabled = true;
    payBtnText.textContent = 'Redirecting to payment…';
    paySpinner.classList.remove('hidden');

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkIn: checkinEl.value,
          checkOut: checkoutEl.value,
          guests: Number(guestsEl.value),
          guestName: `${fnameEl.value.trim()} ${lnameEl.value.trim()}`,
          guestEmail: emailEl.value.trim(),
          guestPhone: phoneEl.value.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        renderError();
        payBtnText.textContent = `Pay Deposit — £${DEPOSIT}`;
        paySpinner.classList.add('hidden');
        updatePayButtonState();
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      renderError();
      payBtnText.textContent = `Pay Deposit — £${DEPOSIT}`;
      paySpinner.classList.add('hidden');
      updatePayButtonState();
    }
  });

  resetSummary('Select your check-in and check-out dates to see live pricing.');
})();
