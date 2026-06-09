create table if not exists public.firestore_documents (
  path text primary key,
  parent_path text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists firestore_documents_parent_path_idx
  on public.firestore_documents (parent_path);

create index if not exists firestore_documents_data_gin_idx
  on public.firestore_documents using gin (data);

alter table public.firestore_documents enable row level security;

drop policy if exists "authenticated can read firestore compat docs" on public.firestore_documents;
create policy "authenticated can read firestore compat docs"
  on public.firestore_documents
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated can insert firestore compat docs" on public.firestore_documents;
create policy "authenticated can insert firestore compat docs"
  on public.firestore_documents
  for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated can update firestore compat docs" on public.firestore_documents;
create policy "authenticated can update firestore compat docs"
  on public.firestore_documents
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated can delete firestore compat docs" on public.firestore_documents;
create policy "authenticated can delete firestore compat docs"
  on public.firestore_documents
  for delete
  to authenticated
  using (true);

create or replace function public.set_firestore_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_firestore_documents_updated_at on public.firestore_documents;
create trigger set_firestore_documents_updated_at
  before update on public.firestore_documents
  for each row
  execute function public.set_firestore_documents_updated_at();
