-- Phase 11: enrich room types pricing with day/night windows and hourly tiers

alter table public.room_types
  add column if not exists price_per_day numeric(10, 2) check (price_per_day >= 0),
  add column if not exists day_start_time time,
  add column if not exists day_end_time time,
  add column if not exists night_start_time time,
  add column if not exists night_end_time time,
  add column if not exists hourly_rates jsonb not null default '[]'::jsonb;

-- Keep a soft guard to ensure this field always stores an array.
alter table public.room_types
  drop constraint if exists room_types_hourly_rates_is_array;

alter table public.room_types
  add constraint room_types_hourly_rates_is_array
  check (jsonb_typeof(hourly_rates) = 'array');
