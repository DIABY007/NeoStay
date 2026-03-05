-- Phase 12: room photos support (primary + secondary gallery)

alter table public.room_types
  add column if not exists primary_image_url text,
  add column if not exists secondary_image_urls jsonb not null default '[]'::jsonb;

alter table public.room_types
  drop constraint if exists room_types_secondary_image_urls_is_array;

alter table public.room_types
  add constraint room_types_secondary_image_urls_is_array
  check (jsonb_typeof(secondary_image_urls) = 'array');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'room-photos',
  'room-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
