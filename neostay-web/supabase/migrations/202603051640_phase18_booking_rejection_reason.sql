-- Phase 18: explicit rejection reason on bookings

alter table public.bookings
  add column if not exists rejection_reason text;
