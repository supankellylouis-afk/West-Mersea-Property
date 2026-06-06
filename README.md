# 2 City Road — West Mersea Luxury Retreat

A fully interactive, self-contained static website for a luxury holiday rental property on West Mersea island, Essex.

## Features

- **Luxury design** — Cormorant Garamond serif + Jost sans, cream/gold palette, full-screen hero, scroll-reveal animations
- **Interactive availability calendar** — two-month view, date-range selection, booked dates clearly blocked out
- **Direct booking system** — guest form, real-time pricing by season (low/mid/high), minimum stay validation
- **Payment flow** — card payment (number formatting + basic validation) and bank transfer options; 30% deposit model
- **Booking persistence** — confirmed bookings written to `localStorage`; calendar immediately reflects new bookings
- **OTA integration links** — Booking.com, Airbnb, VRBO alongside a "Book Direct — Best Rate" prompt
- **Lightbox gallery** — keyboard-navigable, six-panel photo gallery
- **Terms & Conditions modal**, guest reviews, OpenStreetMap embed
- **Fully responsive** — desktop, tablet, mobile

## Pricing

| Season | Rate |
|--------|------|
| Low (Oct–Mar, excl. bank hols) | from £195/night |
| Mid (Apr–Jun, Sep) | from £265/night |
| High (Jul–Aug + bank holidays) | from £385/night |

30 % deposit secures the booking; balance due 8 weeks before arrival.

## Images

Place real property photography in `/images/` using these filenames:

| File | Subject |
|------|---------|
| `hero1.jpg` | Hero / estuary view |
| `living.jpg` | Living room |
| `kitchen.jpg` | Kitchen |
| `master.jpg` | Master bedroom |
| `garden.jpg` | Garden / terrace |
| `bath.jpg` | Bathroom |

Until real images are provided the site renders gradient SVG placeholders.

## Deployment

Pure HTML/CSS/JS — no build step required.  
Deploy to any static host: **GitHub Pages**, Netlify, Vercel, Cloudflare Pages.

