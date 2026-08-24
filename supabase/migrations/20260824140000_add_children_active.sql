ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS children_active_idx
  ON public.children (is_active);
