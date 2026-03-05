-- Phase 13: hotel geolocation for public map guidance

alter table public.hotels
  add column if not exists latitude numeric(9, 6),
  add column if not exists longitude numeric(9, 6);

alter table public.hotels
  drop constraint if exists hotels_latitude_range,
  drop constraint if exists hotels_longitude_range,
  drop constraint if exists hotels_geo_pair_consistency;

alter table public.hotels
  add constraint hotels_latitude_range check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add constraint hotels_longitude_range check (longitude is null or (longitude >= -180 and longitude <= 180)),
  add constraint hotels_geo_pair_consistency check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  );
