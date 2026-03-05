-- Phase 17: day-tier pricing and precise booking durations (hours/days)

alter table public.room_types
  add column if not exists daily_rates jsonb not null default '[]'::jsonb;

alter table public.room_types
  drop constraint if exists room_types_daily_rates_is_array;

alter table public.room_types
  add constraint room_types_daily_rates_is_array
  check (jsonb_typeof(daily_rates) = 'array');

alter table public.bookings
  add column if not exists booked_days integer;

alter table public.bookings
  drop constraint if exists bookings_booked_days_valid;

alter table public.bookings
  add constraint bookings_booked_days_valid
  check (booked_days is null or (booked_days >= 1 and booked_days <= 30));

alter table public.bookings
  drop constraint if exists bookings_dates_valid;

-- Allow same-day bookings for day/hourly formulas.
alter table public.bookings
  add constraint bookings_dates_valid check (check_out_date >= check_in_date);

create or replace function public.create_pending_booking_atomic(
  p_hotel_id uuid,
  p_room_type_id uuid,
  p_guest_name text,
  p_guest_phone text,
  p_special_request text,
  p_check_in date,
  p_check_out date,
  p_payment_proof_path text default null,
  p_booking_formula text default 'night',
  p_booking_hourly_hours integer default null,
  p_booking_daily_days integer default null
)
returns table (id uuid, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_quantity integer;
  v_active_count integer;
  v_expires_at timestamptz;
  v_formula text;
  v_hourly_hours integer;
  v_daily_days integer;
  v_effective_new_end date;
begin
  if p_check_out < p_check_in then
    raise exception 'INVALID_STAY_DATES';
  end if;

  v_formula := lower(coalesce(nullif(trim(p_booking_formula), ''), 'night'));
  if v_formula not in ('night', 'day', 'hourly') then
    raise exception 'INVALID_BOOKING_FORMULA';
  end if;

  if v_formula = 'hourly' then
    if p_booking_hourly_hours is null or p_booking_hourly_hours < 1 or p_booking_hourly_hours > 24 then
      raise exception 'INVALID_BOOKING_HOURLY_HOURS';
    end if;
    v_hourly_hours := p_booking_hourly_hours;
    v_daily_days := null;
    v_effective_new_end := p_check_in + 1;
  elsif v_formula = 'day' then
    if p_booking_daily_days is not null and (p_booking_daily_days < 1 or p_booking_daily_days > 30) then
      raise exception 'INVALID_BOOKING_DAILY_DAYS';
    end if;

    v_daily_days := coalesce(p_booking_daily_days, 1);
    v_hourly_hours := null;

    -- Day formula is same-day for 1 day, then extends by additional days.
    if v_daily_days = 1 then
      v_effective_new_end := p_check_in + 1;
    else
      v_effective_new_end := p_check_in + v_daily_days;
    end if;
  else
    v_hourly_hours := null;
    v_daily_days := null;

    if p_check_out <= p_check_in then
      raise exception 'INVALID_STAY_DATES';
    end if;

    v_effective_new_end := p_check_out;
  end if;

  select rt.total_quantity
  into v_total_quantity
  from public.room_types rt
  where rt.id = p_room_type_id
    and rt.hotel_id = p_hotel_id
  for update;

  if v_total_quantity is null then
    raise exception 'ROOM_TYPE_NOT_FOUND';
  end if;

  select count(*)
  into v_active_count
  from public.bookings b
  where b.hotel_id = p_hotel_id
    and b.room_type_id = p_room_type_id
    and b.check_in_date < v_effective_new_end
    and (
      case
        when b.booking_formula = 'hourly' then b.check_in_date + 1
        when b.booking_formula = 'day' and coalesce(b.booked_days, 1) = 1 then b.check_in_date + 1
        when b.booking_formula = 'day' then b.check_in_date + coalesce(b.booked_days, 1)
        else b.check_out_date
      end
    ) > p_check_in
    and (
      b.status = 'confirmed'
      or (b.status = 'pending' and b.expires_at > now())
    );

  if v_active_count >= v_total_quantity then
    raise exception 'NO_AVAILABILITY';
  end if;

  v_expires_at := now() + interval '2 hours';

  insert into public.bookings (
    hotel_id,
    room_type_id,
    guest_name,
    guest_phone,
    special_request,
    check_in_date,
    check_out_date,
    status,
    payment_proof_path,
    expires_at,
    booking_formula,
    booked_hours,
    booked_days
  )
  values (
    p_hotel_id,
    p_room_type_id,
    p_guest_name,
    p_guest_phone,
    nullif(p_special_request, ''),
    p_check_in,
    case
      when v_formula = 'hourly' then p_check_in
      when v_formula = 'day' and v_daily_days = 1 then p_check_in
      when v_formula = 'day' then p_check_in + (v_daily_days - 1)
      else p_check_out
    end,
    'pending',
    p_payment_proof_path,
    v_expires_at,
    v_formula,
    v_hourly_hours,
    v_daily_days
  )
  returning bookings.id, bookings.status, bookings.expires_at
  into id, status, expires_at;

  return next;
end;
$$;
