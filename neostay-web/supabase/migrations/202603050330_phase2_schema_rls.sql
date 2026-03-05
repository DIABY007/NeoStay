-- NeoStay Phase 2
-- Database schema (multi-tenant) + RLS baseline policies.

create extension if not exists pgcrypto;

-- Keep `updated_at` in sync across mutable tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== Core tables =====

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  whatsapp_number text not null,
  theme_color text not null default '#0f766e',
  description text,
  hero_title text,
  hero_subtitle text,
  theme_template text not null default 'classic' check (theme_template in ('classic', 'modern')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotels_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create trigger trg_hotels_updated_at
before update on public.hotels
for each row
execute function public.set_updated_at();

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone_number text not null unique,
  role text not null check (role in ('super_admin', 'hotel_admin')),
  hotel_id uuid references public.hotels (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_hotel_consistency check (
    (role = 'super_admin' and hotel_id is null)
    or (role = 'hotel_admin' and hotel_id is not null)
  )
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Helper functions used by RLS policies.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  );
$$;

create or replace function public.current_hotel_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.hotel_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create table if not exists public.room_types (
  id uuid not null default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (id) on delete cascade,
  name text not null,
  description text,
  price_per_night numeric(10, 2) not null check (price_per_night >= 0),
  total_quantity integer not null check (total_quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (id, hotel_id)
);

create index if not exists idx_room_types_hotel_id on public.room_types (hotel_id);

create trigger trg_room_types_updated_at
before update on public.room_types
for each row
execute function public.set_updated_at();

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null,
  room_type_id uuid not null,
  guest_name text not null,
  guest_phone text not null,
  special_request text,
  check_in_date date not null,
  check_out_date date not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'expired')),
  payment_proof_path text,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_dates_valid check (check_out_date > check_in_date),
  constraint fk_bookings_hotel foreign key (hotel_id) references public.hotels (id) on delete cascade,
  constraint fk_bookings_room_type_hotel
    foreign key (room_type_id, hotel_id)
    references public.room_types (id, hotel_id)
    on delete cascade
);

create index if not exists idx_bookings_hotel_id on public.bookings (hotel_id);
create index if not exists idx_bookings_room_type_id on public.bookings (room_type_id);
create index if not exists idx_bookings_status on public.bookings (status);
create index if not exists idx_bookings_date_range on public.bookings (check_in_date, check_out_date);
create index if not exists idx_bookings_expires_at on public.bookings (expires_at);

create trigger trg_bookings_updated_at
before update on public.bookings
for each row
execute function public.set_updated_at();

-- ===== RLS =====

alter table public.hotels enable row level security;
alter table public.profiles enable row level security;
alter table public.room_types enable row level security;
alter table public.bookings enable row level security;

-- Hotel policies
create policy hotels_super_admin_all
on public.hotels
for all
using (public.is_super_admin())
with check (public.is_super_admin());

create policy hotels_hotel_admin_read_own
on public.hotels
for select
using (id = public.current_hotel_id());

create policy hotels_hotel_admin_update_own
on public.hotels
for update
using (id = public.current_hotel_id())
with check (id = public.current_hotel_id());

-- Profiles policies
create policy profiles_super_admin_all
on public.profiles
for all
using (public.is_super_admin())
with check (public.is_super_admin());

create policy profiles_user_read_self
on public.profiles
for select
using (id = auth.uid());

-- Room types policies
create policy room_types_super_admin_all
on public.room_types
for all
using (public.is_super_admin())
with check (public.is_super_admin());

create policy room_types_hotel_admin_all_own
on public.room_types
for all
using (hotel_id = public.current_hotel_id())
with check (hotel_id = public.current_hotel_id());

-- Bookings policies
create policy bookings_super_admin_all
on public.bookings
for all
using (public.is_super_admin())
with check (public.is_super_admin());

create policy bookings_hotel_admin_all_own
on public.bookings
for all
using (hotel_id = public.current_hotel_id())
with check (hotel_id = public.current_hotel_id());

-- Helpers are callable by authenticated users.
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.current_hotel_id() to authenticated;
