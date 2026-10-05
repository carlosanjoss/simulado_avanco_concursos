-- Permite usar a chave publicável com o token de sessão do Clerk.
-- Antes de executar, ative Clerk em Supabase > Authentication > Third-party auth.

grant select, insert, update, delete on public.simulado_documents to authenticated;
grant select, insert, update, delete on public.simulado_batches to authenticated;
grant select, insert, update, delete on public.simulado_chunks to authenticated;
grant usage, select on sequence public.simulado_chunks_id_seq to authenticated;

drop policy if exists simulado_documents_select_own on public.simulado_documents;
drop policy if exists simulado_documents_insert_own on public.simulado_documents;
drop policy if exists simulado_documents_update_own on public.simulado_documents;
drop policy if exists simulado_documents_delete_own on public.simulado_documents;

create policy simulado_documents_select_own on public.simulado_documents
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);
create policy simulado_documents_insert_own on public.simulado_documents
  for insert to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);
create policy simulado_documents_update_own on public.simulado_documents
  for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);
create policy simulado_documents_delete_own on public.simulado_documents
  for delete to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists simulado_batches_select_own on public.simulado_batches;
drop policy if exists simulado_batches_insert_own on public.simulado_batches;
drop policy if exists simulado_batches_update_own on public.simulado_batches;
drop policy if exists simulado_batches_delete_own on public.simulado_batches;

create policy simulado_batches_select_own on public.simulado_batches
  for select to authenticated
  using (exists (
    select 1 from public.simulado_documents documents
    where documents.id = document_id and documents.user_id = (select auth.jwt()->>'sub')
  ));
create policy simulado_batches_insert_own on public.simulado_batches
  for insert to authenticated
  with check (exists (
    select 1 from public.simulado_documents documents
    where documents.id = document_id and documents.user_id = (select auth.jwt()->>'sub')
  ));
create policy simulado_batches_update_own on public.simulado_batches
  for update to authenticated
  using (exists (
    select 1 from public.simulado_documents documents
    where documents.id = document_id and documents.user_id = (select auth.jwt()->>'sub')
  ));
create policy simulado_batches_delete_own on public.simulado_batches
  for delete to authenticated
  using (exists (
    select 1 from public.simulado_documents documents
    where documents.id = document_id and documents.user_id = (select auth.jwt()->>'sub')
  ));

drop policy if exists simulado_chunks_select_own on public.simulado_chunks;
drop policy if exists simulado_chunks_insert_own on public.simulado_chunks;
drop policy if exists simulado_chunks_update_own on public.simulado_chunks;
drop policy if exists simulado_chunks_delete_own on public.simulado_chunks;

create policy simulado_chunks_select_own on public.simulado_chunks
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);
create policy simulado_chunks_insert_own on public.simulado_chunks
  for insert to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);
create policy simulado_chunks_update_own on public.simulado_chunks
  for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);
create policy simulado_chunks_delete_own on public.simulado_chunks
  for delete to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

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
  where (
      (select auth.jwt()->>'role') = 'service_role'
      or (select auth.jwt()->>'sub') = p_user_id
    )
    and 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by chunks.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_simulado_chunks(
  extensions.vector, double precision, integer, uuid, text, integer, integer
) from public, anon;
grant execute on function public.match_simulado_chunks(
  extensions.vector, double precision, integer, uuid, text, integer, integer
) to authenticated, service_role;
