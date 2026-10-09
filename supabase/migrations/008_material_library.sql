ALTER TABLE public.simulado_documents
  ALTER COLUMN expires_at DROP NOT NULL;

ALTER TABLE public.simulado_documents
  ADD COLUMN IF NOT EXISTS ocr_pages INTEGER NOT NULL DEFAULT 0 CHECK (ocr_pages >= 0),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

UPDATE public.simulado_documents
SET expires_at = NULL
WHERE status = 'ready';

CREATE INDEX IF NOT EXISTS simulado_documents_user_library_idx
  ON public.simulado_documents (user_id, archived_at, updated_at DESC)
  WHERE status = 'ready';
