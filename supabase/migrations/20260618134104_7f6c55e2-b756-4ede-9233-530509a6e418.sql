
CREATE TABLE public.resume_enhancements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_description text,
  mode text NOT NULL DEFAULT 'general' CHECK (mode IN ('general','targeted')),
  overall_score integer,
  category_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  rewrite_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_keywords text[] NOT NULL DEFAULT '{}',
  keyword_stuffing_warnings text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_resume_enhancements_resume_created ON public.resume_enhancements(resume_id, created_at DESC);
CREATE INDEX idx_resume_enhancements_user ON public.resume_enhancements(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_enhancements TO authenticated;
GRANT ALL ON public.resume_enhancements TO service_role;

ALTER TABLE public.resume_enhancements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own enhancements"
ON public.resume_enhancements
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.resume_enhancements;
ALTER TABLE public.resume_enhancements REPLICA IDENTITY FULL;
