-- Phase 14: allow hotel admins to store Google Maps embed iframe/html

alter table public.hotels
  add column if not exists map_embed_html text;
