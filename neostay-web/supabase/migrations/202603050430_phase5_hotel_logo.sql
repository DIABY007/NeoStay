-- NeoStay Phase 5
-- Add branding column for hotel logo.

alter table public.hotels
add column if not exists logo_url text;
