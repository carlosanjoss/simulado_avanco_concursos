REVOKE ALL ON TABLE public.simulado_documents FROM authenticated;
REVOKE ALL ON TABLE public.simulado_batches FROM authenticated;
REVOKE ALL ON TABLE public.simulado_chunks FROM authenticated;

DROP POLICY IF EXISTS simulado_documents_select_own ON public.simulado_documents;
DROP POLICY IF EXISTS simulado_documents_insert_own ON public.simulado_documents;
DROP POLICY IF EXISTS simulado_documents_update_own ON public.simulado_documents;
DROP POLICY IF EXISTS simulado_documents_delete_own ON public.simulado_documents;
DROP POLICY IF EXISTS simulado_batches_select_own ON public.simulado_batches;
DROP POLICY IF EXISTS simulado_batches_insert_own ON public.simulado_batches;
DROP POLICY IF EXISTS simulado_batches_update_own ON public.simulado_batches;
DROP POLICY IF EXISTS simulado_batches_delete_own ON public.simulado_batches;
DROP POLICY IF EXISTS simulado_chunks_select_own ON public.simulado_chunks;
DROP POLICY IF EXISTS simulado_chunks_insert_own ON public.simulado_chunks;
DROP POLICY IF EXISTS simulado_chunks_update_own ON public.simulado_chunks;
DROP POLICY IF EXISTS simulado_chunks_delete_own ON public.simulado_chunks;
