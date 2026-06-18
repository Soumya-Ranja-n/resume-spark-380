# Resume Enhancer (ATS Score + Improvement Engine)

Builds on the existing resumes + auth + storage setup. Adds a transparent, rubric-driven "Estimated ATS Compatibility Score" with actionable fixes, AI rewrites, and progress tracking over time.

## 1. Database

New table `public.resume_enhancements`:

- `id` uuid PK (gen_random_uuid)
- `resume_id` uuid → `resumes.id` on delete cascade
- `user_id` uuid → `auth.users.id` on delete cascade
- `job_description` text nullable
- `mode` text ('general' | 'targeted')
- `overall_score` int (0-100)
- `category_scores` jsonb `{ parseability, keyword_match, content_quality, structure, length }`
- `issues` jsonb (array of `{ category, severity, issue, fix, section }`)
- `rewrite_suggestions` jsonb (array of `{ original, improved, reasoning }`)
- `missing_keywords` text[]
- `keyword_stuffing_warnings` text[]
- `status` text ('pending'|'processing'|'completed'|'failed') default 'pending'
- `error_message` text nullable
- `created_at` timestamptz default now()

Grants + RLS:
- `GRANT SELECT, INSERT, UPDATE, DELETE` to `authenticated`, `GRANT ALL` to `service_role`
- RLS policy: `auth.uid() = user_id` (using + with check), admins via `has_role`
- Add to `supabase_realtime` publication
- Index on `(resume_id, created_at desc)`

## 2. Backend (server function, not Edge Function)

Per stack rules, app-internal AI logic uses TanStack `createServerFn` with `requireSupabaseAuth`, calling Lovable AI Gateway (no OPENAI_API_KEY needed — `LOVABLE_API_KEY` is already provisioned). No secret is exposed to the client.

`src/lib/enhance-resume.functions.ts`:
- `startEnhancement({ resumeId, jobDescription? })` — auth-guarded
  1. Insert `resume_enhancements` row with `status='processing'`
  2. Fetch resume row (RLS-scoped) and download file from `resumes` bucket via signed URL
  3. Extract text using existing `pdf-extract.server.ts` (unpdf + mammoth)
  4. Call Lovable AI Gateway (`google/gemini-2.5-flash`) with the strict rubric system prompt + JSON schema (structured output)
  5. Update row with results + `status='completed'`, or `status='failed'` + `error_message`
  6. Return enhancement id
- `listEnhancements({ resumeId })` — history for charting
- `getEnhancement({ id })`

System prompt embeds the exact 100-pt weighted rubric (Parseability 30 / Keyword Match 30 / Content Quality 20 / Structure 15 / Length 5), the anti-fabrication guardrail verbatim, and the two operating modes (general vs targeted). Response is strict JSON via Gemini structured output.

## 3. Frontend

New route `src/routes/_authenticated/resumes/$id.enhance.tsx` (also linked from existing resume detail page via "Enhance with AI" button).

Components in `src/components/enhancer/`:
- `enhance-launcher.tsx` — JD textarea (optional, with "More accurate with a JD" hint), mode toggle hint, Run button
- `score-radial.tsx` — large animated radial score (0-100) with band label + color (green/amber/orange/red)
- `category-bars.tsx` — horizontal bars per category with earned/max and tooltip explaining the category
- `issues-list.tsx` — grouped by severity (high → low), colored badges, expandable "Fix" details, filter chips by category
- `rewrites-diff.tsx` — side-by-side original vs improved, copy button, "Apply to clipboard" toast, reasoning shown on hover
- `keywords-panel.tsx` — missing keyword chips (click to copy), conditional stuffing-warnings card
- `history-chart.tsx` — Recharts line chart of score vs date (shows only if ≥2 runs); per-run drill-in
- `processing-state.tsx` — skeleton + live status via Realtime subscription on `resume_enhancements` filtered by `resume_id`
- `disclaimer-banner.tsx` — "Estimated ATS Compatibility Score" framing copy

Interactive patterns:
- Tabs: Overview / Issues / Rewrites / Keywords / History
- Sticky score header on scroll
- Severity filter chips on Issues
- Copy-to-clipboard on every rewrite and keyword
- Realtime status updates without refresh
- Empty state on history until 2nd run exists
- All copy says "Estimated" — never implies official ATS score

## 4. Files changed

- `supabase/migrations/<ts>_resume_enhancements.sql` (new)
- `src/lib/enhance-resume.functions.ts` (new)
- `src/lib/ats-rubric.ts` (new — shared rubric metadata for UI labels/tooltips)
- `src/routes/_authenticated/resumes/$id.enhance.tsx` (new)
- `src/routes/_authenticated/resumes/$id.tsx` (edit — add "Enhance with AI" CTA)
- `src/components/enhancer/*` (new, listed above)
- `src/integrations/supabase/types.ts` regenerates after migration

## 5. Verification

- Run migration → confirm RLS + realtime publication
- Trigger enhancement without JD → general mode score appears, category sum matches overall
- Trigger with JD → `missing_keywords` reflect JD terms
- Realtime: status flips processing → completed without refresh
- Second run renders history chart
- No API keys in frontend bundle (Lovable AI Gateway only)

## Notes on deviations from your prompt

- Uses **Lovable AI Gateway** (Gemini) instead of a Supabase Edge Function calling OpenAI directly. Reason: this stack uses TanStack server functions, not Edge Functions, for app-internal logic, and `LOVABLE_API_KEY` is already configured — no `OPENAI_API_KEY` setup needed. The rubric, guardrail, output schema, security posture, and UX requirements are identical.
- If you specifically want OpenAI `gpt-4o-mini`, say so and I'll add `OPENAI_API_KEY` as a secret and swap the model call.
