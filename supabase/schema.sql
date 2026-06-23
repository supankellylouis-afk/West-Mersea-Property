-- ============================================================
-- Mersea Island Retreat — Direct Booking System Schema
-- Run this in the Supabase SQL editor (or via `supabase db push`)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- bookings
-- ------------------------------------------------------------
create table if not exists bookings (
  id            uuid primary key default gen_random_uuid(),
  check_in      date not null,
  check_out     date not null,
  guests        integer not null check (guests > 0),
  guest_name    text not null,
  guest_email   text not null,
  guest_phone   text,
  total_price   numeric(10,2) not null check (total_price >= 0),
  deposit_paid  numeric(10,2) not null default 0 check (deposit_paid >= 0),
  status        text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at    timestamptz not null default now(),
  constraint check_out_after_check_in check (check_out > check_in)
);

create index if not exists idx_bookings_dates  on bookings (check_in, check_out);
create index if not exists idx_bookings_status on bookings (status);

-- ------------------------------------------------------------
-- blocked_dates  (owner-blocked dates: maintenance, personal use, etc.)
-- ------------------------------------------------------------
create table if not exists blocked_dates (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- pricing_rules  (seasonal nightly rates + minimum stay)
-- ------------------------------------------------------------
create table if not exists pricing_rules (
  id               uuid primary key default gen_random_uuid(),
  start_date       date not null,
  end_date         date not null,
  price_per_night  numeric(10,2) not null check (price_per_night > 0),
  min_stay_nights  integer not null default 2 check (min_stay_nights > 0),
  created_at       timestamptz not null default now(),
  constraint end_after_start check (end_date >= start_date)
);

create index if not exists idx_pricing_rules_dates on pricing_rules (start_date, end_date);

-- ============================================================
-- Row Level Security
-- ------------------------------------------------------------
-- Base tables are locked down by default. All writes (creating
-- bookings, managing blocked dates / pricing) go through Netlify
-- functions using the Supabase SERVICE ROLE key, which bypasses
-- RLS. The public anon key (used by the static frontend) only
-- gets read access to non-sensitive data needed to render the
-- calendar and pricing — never guest names, emails or phone
-- numbers.
-- ============================================================
alter table bookings      enable row level security;
alter table blocked_dates enable row level security;
alter table pricing_rules enable row level security;

-- Public read access to blocked dates and pricing (safe to expose)
create policy "Public can read blocked dates" on blocked_dates
  for select using (true);

create policy "Public can read pricing rules" on pricing_rules
  for select using (true);

-- No public policies on `bookings` — guest PII stays server-side only.
-- A view exposes just the date ranges so the frontend calendar can
-- still grey out unavailable dates without seeing who booked them.
create or replace view public_booked_ranges as
  select check_in, check_out
  from bookings
  where status in ('pending', 'confirmed');

grant select on public_booked_ranges to anon;
