create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.simulado_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id text not null,
  file_name text not null,
  file_hash text not null check (length(file_hash) = 64),
  file_size integer not null check (file_size > 0 and file_size <= 20971520),
  total_pages integer not null check (total_pages between 1 and 400),
  total_batches integer not null check (total_batches between 1 and 80),
  processed_batches integer not null default 0 check (processed_batches >= 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.simulado_batches (
  document_id uuid not null references public.simulado_documents(id) on delete cascade,
  batch_index integer not null check (batch_index >= 0),
  page_start integer not null check (page_start > 0),
  page_end integer not null check (page_end >= page_start),
  chunk_count integer not null default 0 check (chunk_count >= 0),
  status text not null check (status in ('complete')),
  completed_at timestamptz,
  primary key (document_id, batch_index)
);

create table if not exists public.simulado_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.simulado_documents(id) on delete cascade,
  user_id text not null,
  batch_index integer not null check (batch_index >= 0),
  chunk_index integer not null check (chunk_index >= 0),
  page_number integer not null check (page_number > 0),
  text_content text not null,
  content_hash text not null check (length(content_hash) = 64),
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now(),
  unique (document_id, batch_index, chunk_index)
);

create index if not exists simulado_documents_user_status_idx
  on public.simulado_documents (user_id, status, created_at desc);
create index if not exists simulado_chunks_document_page_idx
  on public.simulado_chunks (document_id, page_number);
create index if not exists simulado_chunks_embedding_hnsw_idx
  on public.simulado_chunks using hnsw (embedding vector_cosine_ops);

alter table public.simulado_documents enable row level security;
alter table public.simulado_batches enable row level security;
alter table public.simulado_chunks enable row level security;

revoke all on public.simulado_documents from anon, authenticated;
revoke all on public.simulado_batches from anon, authenticated;
revoke all on public.simulado_chunks from anon, authenticated;

create or replace function public.match_simulado_chunks(
  query_embedding extensions.vector(384),
  match_threshold double precision,
  match_count integer,
  p_document_id uuid,
  p_user_id text,
  p_page_from integer default null,
  p_page_to integer default null
)
returns table (
  id bigint,
  page_number integer,
  text_content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with filtered_chunks as materialized (
    select chunks.*
    from public.simulado_chunks as chunks
    where chunks.document_id = p_document_id
      and chunks.user_id = p_user_id
      and (p_page_from is null or chunks.page_number >= p_page_from)
      and (p_page_to is null or chunks.page_number <= p_page_to)
  )
  select
    chunks.id,
    chunks.page_number,
    chunks.text_content,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from filtered_chunks as chunks
  where 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by chunks.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_simulado_chunks(
  extensions.vector, double precision, integer, uuid, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.match_simulado_chunks(
  extensions.vector, double precision, integer, uuid, text, integer, integer
) to service_role;

-- Execute periodicamente (por cron ou agendador) para remover processamentos abandonados.
create or replace function public.delete_expired_simulado_documents()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.simulado_documents where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_expired_simulado_documents() from public, anon, authenticated;
grant execute on function public.delete_expired_simulado_documents() to service_role;
