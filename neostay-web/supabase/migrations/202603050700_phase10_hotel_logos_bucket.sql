-- NeoStay Phase 10
-- Public storage bucket for hotel logos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hotel-logos',
  'hotel-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
