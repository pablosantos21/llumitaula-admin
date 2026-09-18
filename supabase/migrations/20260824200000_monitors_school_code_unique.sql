-- A monitor code (PIN) must be unique within its school.
-- Idempotent so it can run against environments where the constraint
-- may already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monitors_school_id_code_key'
      AND conrelid = 'public.monitors'::regclass
  ) THEN
    ALTER TABLE public.monitors
      ADD CONSTRAINT monitors_school_id_code_key UNIQUE (school_id, code);
  END IF;
END $$;
