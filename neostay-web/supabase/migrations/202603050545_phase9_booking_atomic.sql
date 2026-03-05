-- NeoStay stabilization
-- Atomic booking creation to reduce race conditions on availability checks.

create or replace function public.create_pending_booking_atomic(
  p_hotel_id uuid,
  p_room_type_id uuid,
  p_guest_name text,
  p_guest_phone text,
  p_special_request text,
  p_check_in date,
  p_check_out date,
  p_payment_proof_path text default null
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
begin
  if p_check_out <= p_check_in then
    raise exception 'INVALID_STAY_DATES';
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
    and b.check_in_date < p_check_out
    and b.check_out_date > p_check_in
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
    expires_at
  )
  values (
    p_hotel_id,
    p_room_type_id,
    p_guest_name,
    p_guest_phone,
    nullif(p_special_request, ''),
    p_check_in,
    p_check_out,
    'pending',
    p_payment_proof_path,
    v_expires_at
  )
  returning bookings.id, bookings.status, bookings.expires_at
  into id, status, expires_at;

  return next;
end;
$$;
