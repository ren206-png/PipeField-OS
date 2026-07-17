-- PC-3: Material heat numbers on welds
-- Three columns: base metal A, base metal B (butt welds), filler batch

ALTER TABLE public.welds
  ADD COLUMN IF NOT EXISTS base_metal_heat_a TEXT,
  ADD COLUMN IF NOT EXISTS base_metal_heat_b TEXT,
  ADD COLUMN IF NOT EXISTS filler_batch_number TEXT;

CREATE INDEX IF NOT EXISTS idx_welds_heat_a  ON public.welds(base_metal_heat_a) WHERE base_metal_heat_a IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_welds_heat_b  ON public.welds(base_metal_heat_b) WHERE base_metal_heat_b IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_welds_filler  ON public.welds(filler_batch_number) WHERE filler_batch_number IS NOT NULL;
