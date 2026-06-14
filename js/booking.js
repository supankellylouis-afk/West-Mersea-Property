/* ============================================================
   2 City Road — Booking & Availability System
   ============================================================ */

const Booking = (() => {
  'use strict';

  /* ---- Pricing by season ---- */
  const NIGHTLY_RATES = {
    low:  195,  // Oct-Mar (excl bank hols)
    mid:  265,  // Apr-Jun, Sep
    high: 385,  // Jul-Aug + bank holidays
  };

  const UK_BANK_HOLIDAYS_2025 = [
    '2025-01-01','2025-04-18','2025-04-21','2025-05-05',
    '2025-05-26','2025-08-25','2025-12-25','2025-12-26',
  ];
  const UK_BANK_HOLIDAYS_2026 = [
    '2026-01-01','2026-04-03','2026-04-06','2026-05-04',
    '2026-05-25','2026-08-31','2026-12-25','2026-12-28',
  ];
  const BANK_HOLIDAYS = new Set([...UK_BANK_HOLIDAYS_2025, ...UK_BANK_HOLIDAYS_2026]);

  function getSeason(date) {
    const m = date.getMonth() + 1;
    const ds = toYMD(date);
    if (BANK_HOLIDAYS.has(ds)) return 'high';
    if (m === 7 || m === 8) return 'high';
    if (m === 4 || m === 5 || m === 6 || m === 9) return 'mid';
    return 'low';
  }

  function nightRate(date) {
    return NIGHTLY_RATES[getSeason(date)];
  }

  /* ---- Date helpers ---- */
  function toYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function ymdToDate(s) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  function formatDisplay(d) {
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  }

  /* ---- Persistence ---- */
  const STORAGE_KEY = '2cr_bookings';

  function loadBookings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  }

  function saveBookings(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  /* Build set of all booked date strings — direct bookings made
     through this site (localStorage) plus OTA bookings shared via
     ota-bookings.js */
  function buildBookedSet() {
    const otaBookings = typeof OTA_BOOKINGS !== 'undefined' ? OTA_BOOKINGS : [];
    const bookings = [...otaBookings, ...loadBookings()];
    const set = new Set();
    bookings.forEach(b => {
      let d = ymdToDate(b.checkIn);
      const end = ymdToDate(b.checkOut);
      while (d < end) {
        set.add(toYMD(d));
        d = addDays(d, 1);
      }
    });
    return set;
  }

  /* ---- Calendar state ---- */
  let viewYear, viewMonth;
  let checkinDate = null;
  let checkoutDate = null;
  let hoverDate = null;
  let bookedSet = new Set();

  const WEEKDAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  /* ---- DOM refs ---- */
  const calMonths = document.getElementById('cal-months');
  const calMonthLabel = document.getElementById('cal-month-label');
  const calPrev = document.getElementById('cal-prev');
  const calNext = document.getElementById('cal-next');

  const dsCheckin   = document.getElementById('ds-checkin');
  const dsCheckout  = document.getElementById('ds-checkout');
  const dsNights    = document.getElementById('ds-nights');
  const dsTotal     = document.getElementById('ds-total');

  const proceedBtn = document.getElementById('proceed-payment-btn');
  const guestForm  = document.getElementById('guest-form');

  /* ---- Render calendar ---- */
  function renderCalendar() {
    calMonths.innerHTML = '';
    calMonthLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

    for (let m = 0; m < 2; m++) {
      let yr = viewYear, mo = viewMonth + m;
      if (mo > 11) { yr++; mo -= 12; }
      calMonths.appendChild(renderMonth(yr, mo));
    }
  }

  function renderMonth(year, month) {
    const wrap = document.createElement('div');
    wrap.className = 'cal-month';

    const nameEl = document.createElement('div');
    nameEl.className = 'cal-month-name';
    nameEl.textContent = `${MONTHS[month]} ${year}`;
    wrap.appendChild(nameEl);

    const wdRow = document.createElement('div');
    wdRow.className = 'cal-weekdays';
    WEEKDAYS.forEach(wd => {
      const el = document.createElement('div');
      el.className = 'cal-weekday';
      el.textContent = wd;
      wdRow.appendChild(el);
    });
    wrap.appendChild(wdRow);

    const daysEl = document.createElement('div');
    daysEl.className = 'cal-days';

    const firstDay = new Date(year, month, 1);
    /* Monday-based: Mon=0 */
    let startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    for (let i = 0; i < startOffset; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      daysEl.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const ymd = toYMD(date);
      const el = document.createElement('div');
      el.className = 'cal-day';
      el.textContent = day;
      el.dataset.date = ymd;

      const isPast   = date < today;
      const isBooked = bookedSet.has(ymd);
      const isToday  = date.getTime() === today.getTime();

      if (isPast)   el.classList.add('past');
      if (isBooked) el.classList.add('booked');
      if (isToday)  el.classList.add('today');

      if (checkinDate  && ymd === toYMD(checkinDate))  el.classList.add('selected', 'range-start');
      if (checkoutDate && ymd === toYMD(checkoutDate)) el.classList.add('selected', 'range-end');

      if (checkinDate && !checkoutDate && hoverDate) {
        const lo = checkinDate < hoverDate ? checkinDate : hoverDate;
        const hi = checkinDate < hoverDate ? hoverDate   : checkinDate;
        if (date > lo && date < hi) el.classList.add('in-range');
      } else if (checkinDate && checkoutDate) {
        if (date > checkinDate && date < checkoutDate) el.classList.add('in-range');
      }

      if (!isPast && !isBooked) {
        el.addEventListener('click',      () => handleDayClick(date));
        el.addEventListener('mouseenter', () => handleDayHover(date));
        el.addEventListener('mouseleave', () => { hoverDate = null; updateRangePreview(); });
      }

      daysEl.appendChild(el);
    }

    wrap.appendChild(daysEl);
    return wrap;
  }

  function handleDayClick(date) {
    if (!checkinDate || (checkinDate && checkoutDate)) {
      /* Start new selection */
      checkinDate  = date;
      checkoutDate = null;
      hoverDate    = null;
    } else {
      /* Second click — set checkout */
      if (date <= checkinDate) {
        checkinDate = date;
        checkoutDate = null;
      } else {
        /* Check no booked dates in range */
        let d = addDays(checkinDate, 1);
        let conflict = false;
        while (d < date) {
          if (bookedSet.has(toYMD(d))) { conflict = true; break; }
          d = addDays(d, 1);
        }
        if (conflict) {
          showToast('Your selected range includes unavailable dates. Please choose different dates.');
          checkinDate  = null;
          checkoutDate = null;
        } else {
          const nights = daysBetween(checkinDate, date);
          if (nights < 2) {
            showToast('Minimum stay is 2 nights. Please select a longer stay.');
            return;
          }
          checkoutDate = date;
        }
      }
    }
    renderCalendar();
    updateSummary();
  }

  function handleDayHover(date) {
    if (!checkinDate || checkoutDate) return;
    hoverDate = date;
    updateRangePreview();
  }

  /* Update the in-range highlight without rebuilding the whole
     calendar (avoids destabilising click targets on hover) */
  function updateRangePreview() {
    document.querySelectorAll('.cal-day.in-range').forEach(el => el.classList.remove('in-range'));
    if (!checkinDate || checkoutDate || !hoverDate) return;
    const lo = checkinDate < hoverDate ? checkinDate : hoverDate;
    const hi = checkinDate < hoverDate ? hoverDate   : checkinDate;
    document.querySelectorAll('.cal-day:not(.empty)').forEach(el => {
      const d = ymdToDate(el.dataset.date);
      if (d > lo && d < hi) el.classList.add('in-range');
    });
  }

  /* ---- Summary & pricing ---- */
  function calcTripTotal(ci, co) {
    let total = 0;
    let d = new Date(ci);
    const end = new Date(co);
    while (d < end) {
      total += nightRate(d);
      d = addDays(d, 1);
    }
    return total;
  }

  function updateSummary() {
    if (checkinDate && checkoutDate) {
      const nights = daysBetween(checkinDate, checkoutDate);
      const total  = calcTripTotal(checkinDate, checkoutDate);
      dsCheckin.textContent  = formatDisplay(checkinDate);
      dsCheckout.textContent = formatDisplay(checkoutDate);
      dsNights.textContent   = `${nights} night${nights !== 1 ? 's' : ''}`;
      dsTotal.textContent    = `£${total.toLocaleString()}`;
      proceedBtn.disabled = false;
    } else {
      dsCheckin.textContent  = '—';
      dsCheckout.textContent = '—';
      dsNights.textContent   = '—';
      dsTotal.textContent    = '—';
      proceedBtn.disabled = true;
    }
  }

  /* ---- Toast ---- */
  function showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
      background:#1e2022; color:#fff; padding:12px 24px; border-radius:4px;
      font-size:.85rem; z-index:9999; box-shadow:0 4px 20px rgba(0,0,0,.3);
      animation: fadeInUp .3s ease;
      pointer-events:none;
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  /* ---- Nav buttons ---- */
  function prevMonth() {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  }

  function nextMonth() {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  }

  /* ---- Payment modal ---- */
  const paymentOverlay = document.getElementById('payment-modal-overlay');
  const paymentClose   = document.getElementById('payment-modal-close');
  const modalBookingSummary = document.getElementById('modal-booking-summary');
  const amountDueBox   = document.getElementById('amount-due-box');
  const bankAmountDue  = document.getElementById('bank-amount-due-box');
  const bankRef        = document.getElementById('bank-ref');

  const confirmOverlay  = document.getElementById('confirm-modal-overlay');
  const confirmText     = document.getElementById('confirm-text');
  const confirmEmail    = document.getElementById('confirm-email');
  const confirmCloseBtn = document.getElementById('confirm-close-btn');

  const cardForm   = document.getElementById('card-form');
  const payBtn     = document.getElementById('pay-btn');
  const payBtnText = document.getElementById('pay-btn-text');
  const paySpinner = document.getElementById('pay-spinner');

  const bankConfirmBtn = document.getElementById('bank-confirm-btn');

  let currentBookingRef = '';
  let currentTotal = 0;
  let currentDeposit = 0;

  function openPaymentModal() {
    const total   = calcTripTotal(checkinDate, checkoutDate);
    const deposit = Math.round(total * 0.30);
    currentTotal   = total;
    currentDeposit = deposit;

    const nights = daysBetween(checkinDate, checkoutDate);
    currentBookingRef = `2CR-${Date.now().toString(36).toUpperCase()}`;

    modalBookingSummary.textContent =
      `${formatDisplay(checkinDate)} → ${formatDisplay(checkoutDate)} · ${nights} nights`;

    const amtHtml = `
      Total stay: <strong>£${total.toLocaleString()}</strong><br/>
      <strong>Deposit due today (30%): £${deposit.toLocaleString()}</strong><br/>
      <small style="color:#888">Balance of £${(total - deposit).toLocaleString()} due 8 weeks before arrival</small>
    `;
    amountDueBox.innerHTML = amtHtml;
    bankAmountDue.innerHTML = amtHtml;
    bankRef.textContent = currentBookingRef;

    paymentOverlay.classList.add('open');
  }

  function closePaymentModal() {
    paymentOverlay.classList.remove('open');
  }

  function openConfirmModal() {
    const email  = document.getElementById('g-email').value;
    const nights = daysBetween(checkinDate, checkoutDate);
    confirmText.textContent =
      `Booking ref: ${currentBookingRef} · ${formatDisplay(checkinDate)} – ${formatDisplay(checkoutDate)} · ${nights} nights · Total £${currentTotal.toLocaleString()}`;
    confirmEmail.textContent = email;
    confirmOverlay.classList.add('open');
  }

  function finaliseBooking() {
    /* Save to localStorage */
    const bookings = loadBookings();
    bookings.push({
      checkIn:  toYMD(checkinDate),
      checkOut: toYMD(checkoutDate),
      source:   'Direct',
      ref:      currentBookingRef,
      guest:    `${document.getElementById('g-fname').value} ${document.getElementById('g-lname').value}`,
      email:    document.getElementById('g-email').value,
      total:    currentTotal,
      bookedAt: new Date().toISOString(),
    });
    saveBookings(bookings);
    bookedSet = buildBookedSet();

    closePaymentModal();

    /* Reset selection */
    checkinDate  = null;
    checkoutDate = null;
    renderCalendar();
    updateSummary();
    guestForm.reset();

    openConfirmModal();
  }

  /* ---- Card number formatting ---- */
  function formatCardNumber(el) {
    el.addEventListener('input', () => {
      let v = el.value.replace(/\D/g,'').slice(0,16);
      el.value = v.replace(/(.{4})/g,'$1 ').trim();
    });
  }

  function formatExpiry(el) {
    el.addEventListener('input', () => {
      let v = el.value.replace(/\D/g,'').slice(0,4);
      if (v.length >= 2) v = v.slice(0,2) + ' / ' + v.slice(2);
      el.value = v;
    });
  }

  /* ---- Payment tabs ---- */
  function initTabs() {
    document.querySelectorAll('.ptab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const id = tab.dataset.tab;
        document.getElementById('ptab-card').classList.toggle('hidden', id !== 'card');
        document.getElementById('ptab-bank').classList.toggle('hidden', id !== 'bank');
      });
    });
  }

  /* ---- Validate card (basic Luhn-ish for demo) ---- */
  function validateCard() {
    const name   = document.getElementById('card-name').value.trim();
    const num    = document.getElementById('card-number').value.replace(/\s/g,'');
    const expiry = document.getElementById('card-expiry').value.trim();
    const cvv    = document.getElementById('card-cvv').value.trim();

    if (!name)             { showToast('Please enter the name on card.'); return false; }
    if (num.length < 13)   { showToast('Please enter a valid card number.'); return false; }
    if (!expiry.includes('/') || expiry.length < 5) { showToast('Please enter a valid expiry date.'); return false; }
    if (cvv.length < 3)    { showToast('Please enter a valid CVV.'); return false; }
    return true;
  }

  /* ---- Validate guest form ---- */
  function validateGuestForm() {
    const required = ['g-fname','g-lname','g-email','g-phone','g-adults'];
    for (const id of required) {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        el.focus();
        showToast('Please fill in all required fields.');
        return false;
      }
    }
    if (!/\S+@\S+\.\S+/.test(document.getElementById('g-email').value)) {
      showToast('Please enter a valid email address.');
      return false;
    }
    return true;
  }

  /* ---- Init ---- */
  function init() {
    const now = new Date();
    viewYear  = now.getFullYear();
    viewMonth = now.getMonth();

    bookedSet = buildBookedSet();
    renderCalendar();
    updateSummary();

    calPrev.addEventListener('click', prevMonth);
    calNext.addEventListener('click', nextMonth);

    /* Guest form submit → open payment modal */
    guestForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!checkinDate || !checkoutDate) {
        showToast('Please select your check-in and check-out dates first.');
        return;
      }
      if (!validateGuestForm()) return;
      openPaymentModal();
    });

    /* Payment modal */
    paymentClose.addEventListener('click', closePaymentModal);
    paymentOverlay.addEventListener('click', e => {
      if (e.target === paymentOverlay) closePaymentModal();
    });

    /* Card form submit */
    cardForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validateCard()) return;

      payBtnText.textContent = 'Processing…';
      paySpinner.classList.add('show');
      payBtn.disabled = true;

      /* Simulate payment processing */
      await new Promise(r => setTimeout(r, 2200));

      payBtnText.textContent = 'Pay Deposit & Confirm Booking';
      paySpinner.classList.remove('show');
      payBtn.disabled = false;

      finaliseBooking();
    });

    /* Bank transfer confirm */
    bankConfirmBtn.addEventListener('click', () => {
      finaliseBooking();
    });

    /* Confirmation modal close */
    confirmCloseBtn.addEventListener('click', () => {
      confirmOverlay.classList.remove('open');
    });

    initTabs();

    /* Card formatting */
    formatCardNumber(document.getElementById('card-number'));
    formatExpiry(document.getElementById('card-expiry'));
    document.getElementById('card-cvv').addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g,'').slice(0,4);
    });

    /* Terms modal */
    const termsOverlay = document.getElementById('terms-modal-overlay');
    const termsClose   = document.getElementById('terms-modal-close');
    const termsLink    = document.getElementById('terms-link');
    const footerTerms  = document.getElementById('footer-terms-link');
    const rulesTerms   = document.getElementById('rules-terms-link');

    [termsLink, footerTerms, rulesTerms].forEach(el => {
      if (el) el.addEventListener('click', e => {
        e.preventDefault();
        termsOverlay.classList.add('open');
      });
    });
    termsClose.addEventListener('click', () => termsOverlay.classList.remove('open'));
    termsOverlay.addEventListener('click', e => {
      if (e.target === termsOverlay) termsOverlay.classList.remove('open');
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', Booking.init);
