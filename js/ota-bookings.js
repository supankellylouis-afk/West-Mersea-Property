/* ============================================================
   2 City Road — Shared OTA Availability
   ------------------------------------------------------------
   Single source of truth for dates already reserved on OTHER
   sales channels (Booking.com, Airbnb, VRBO). The booking
   calendar on this site blocks these dates in addition to any
   direct bookings made through this website, so guests always
   see real, up-to-date availability across every channel.

   HOW TO KEEP THIS IN SYNC
   ------------------------------------------------------------
   Each OTA lets you export an iCal feed of your booked dates:
     - Booking.com:  Extranet → Calendar → Sync calendars → Export
     - Airbnb:       Hosting → Calendar → Availability → Export calendar
     - VRBO:         Calendar → Import/Export → Export calendar
   After every new booking on any platform, add (or remove) an
   entry below with the check-in / check-out dates (check-out is
   the departure date, exclusive) so this calendar stays accurate.
   ============================================================ */

const OTA_BOOKINGS = [
  // Example format — replace with real reservations:
  // { checkIn: '2026-07-04', checkOut: '2026-07-11', source: 'Airbnb',      ref: 'AIR-123456' },
  // { checkIn: '2026-07-18', checkOut: '2026-07-25', source: 'Booking.com', ref: 'BDC-789012' },
  // { checkIn: '2026-08-01', checkOut: '2026-08-08', source: 'VRBO',        ref: 'VRB-345678' },
];
