ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS edited_text text;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS edited_text_updated_at timestamptz;

ALTER TABLE public.resume_enhancements ADD COLUMN IF NOT EXISTS score_ceiling_note text;
ALTER TABLE public.resume_enhancements ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'file';