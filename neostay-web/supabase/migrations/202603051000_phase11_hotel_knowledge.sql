-- NeoStay Phase 11
-- Hotel knowledge base from admin-uploaded PDF documents.

create table if not exists public.hotel_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null unique references public.hotels (id) on delete cascade,
  file_name text not null,
  storage_bucket text not null default 'hotel-knowledge-pdfs',
  object_path text not null,
  source_text text not null,
  source_chars integer not null default 0 check (source_chars >= 0),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hotel_knowledge_hotel_id
on public.hotel_knowledge_documents (hotel_id);

create trigger trg_hotel_knowledge_documents_updated_at
before update on public.hotel_knowledge_documents
for each row
execute function public.set_updated_at();

alter table public.hotel_knowledge_documents enable row level security;

create policy hotel_knowledge_super_admin_all
on public.hotel_knowledge_documents
for all
using (public.is_super_admin())
with check (public.is_super_admin());

create policy hotel_knowledge_hotel_admin_all_own
on public.hotel_knowledge_documents
for all
using (hotel_id = public.current_hotel_id())
with check (hotel_id = public.current_hotel_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hotel-knowledge-pdfs',
  'hotel-knowledge-pdfs',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;