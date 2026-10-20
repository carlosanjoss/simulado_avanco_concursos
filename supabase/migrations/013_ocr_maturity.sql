ALTER TABLE public.simulado_documents
  ADD COLUMN IF NOT EXISTS ocr_language TEXT,
  ADD COLUMN IF NOT EXISTS ocr_confidence INTEGER CHECK (ocr_confidence BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS ocr_page_limit INTEGER NOT NULL DEFAULT 40 CHECK (ocr_page_limit BETWEEN 1 AND 400);

CREATE TABLE IF NOT EXISTS public.simulado_ocr_pages (
  document_id UUID NOT NULL REFERENCES public.simulado_documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  language TEXT NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  detection_reason TEXT NOT NULL CHECK (detection_reason IN ('empty', 'partial')),
  recognized_text TEXT NOT NULL,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, page_number)
);
CREATE INDEX IF NOT EXISTS simulado_ocr_pages_document_idx ON public.simulado_ocr_pages(document_id, page_number);
ALTER TABLE public.simulado_ocr_pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.simulado_ocr_pages FROM anon, authenticated;
