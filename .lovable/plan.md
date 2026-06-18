# ResumeTracker AI — Build Plan

A polished SaaS-style job seeker dashboard with AI resume feedback, kanban job tracking, and live notifications.

## Stack confirmation / deviations from your spec

Your spec asks for "React + Vite + Supabase Edge Functions". This Lovable template is **TanStack Start (React 19 + Vite 7) with TypeScript + Tailwind v4 + shadcn/ui**, backed by **Lovable Cloud (Supabase under the hood)**. Functional equivalents:

- Server logic → **TanStack `createServerFn`** instead of Supabase Edge Functions (same security boundary — secrets stay server-side, never reach the browser). This is the recommended pattern on this stack; Edge Functions are reserved for external webhooks.
- AI calls → I'll use **OpenAI `gpt-4o-mini` exactly as you asked**, called from a server function with the API key stored as a Lovable Cloud secret. You'll need to provide an OpenAI API key when we get to step 3.
- Auth, Postgres, Storage, Realtime → all Supabase via Lovable Cloud (identical to your spec).

If you'd rather I use Lovable's built-in AI gateway (free monthly allowance, no key needed) instead of OpenAI direct, say the word — otherwise I'll proceed with OpenAI.

## Design system

- Deep indigo primary (~#4F46E5), warm amber accent, near-white bg, full dark mode
- Inter font, generous spacing, Linear/Notion feel
- Tokens defined in `src/styles.css` via `@theme inline` + `oklch` (no hardcoded colors in components)
- shadcn variants (`hero`, `accent`) for CTAs
- Sidebar nav on desktop (shadcn Sidebar), bottom tab bar on mobile
- Skeleton loaders, route fade transitions, friendly empty states with icons + CTA

## Build order

### 1. Foundation
- Enable Lovable Cloud
- Design tokens + dark mode toggle (class-based, persisted to localStorage)
- App shell: `_authenticated` layout with sidebar + mobile tab bar
- Auth page at `/auth` (email/password sign up + login, Supabase managed)

### 2. Database schema + RLS (single migration)
Tables exactly as specified: `profiles`, `resumes`, `job_applications`, `notifications`. Plus:
- `app_role` enum (`user`, `premium`, `admin`) in a **separate `user_roles` table** (security best practice — storing role on `profiles` enables privilege escalation). The `profiles.role` column in your spec will be replaced by `user_roles` + a `has_role()` security-definer function. `subscription_plan` stays on profiles as you specified.
- `handle_new_user()` trigger auto-creates a profile row + default 'user' role on signup
- RLS on every table: owner can CRUD own rows; admins can SELECT all via `has_role(auth.uid(), 'admin')`
- Storage bucket `resumes` (private) + RLS policies scoped to `auth.uid()` folder prefix
- Realtime publication on `resumes` and `notifications`
- Required `GRANT`s for `authenticated` + `service_role`

### 3. Resume upload + AI analysis
- Upload page: drag/drop PDF or DOCX → Supabase Storage under `{user_id}/{uuid}.{ext}`, insert `resumes` row with status `uploaded`
- Resume list/grid with status badges, delete, re-upload, "2+ resumes" free-tier hint
- `analyzeResume` server function (auth-gated):
  1. Loads resume row, downloads file from Storage (service-role, server-only)
  2. Extracts text (PDF via `unpdf`, DOCX via `mammoth` — both Worker-compatible)
  3. Calls OpenAI `gpt-4o-mini` with structured prompt → JSON `{score, strengths[], weaknesses[], suggestions[], missing_keywords[]}`
  4. Updates row: `ai_score`, `ai_feedback`, `status='analyzed'`, inserts `resume_analyzed` notification
- Frontend subscribes via Realtime to the resume row → live "Analyzing…" → "Analyzed" badge transition, no refresh
- Resume detail page shows score (big circular gauge) + categorized feedback

### 4. Job application kanban
- Kanban board (`@dnd-kit`) with columns: Saved, Applied, Interviewing, Offer, Rejected (+ Withdrawn shown as filter)
- Drag → optimistic update + `UPDATE job_applications SET status` via server fn; persists across refresh
- Table view toggle (shadcn Table)
- "Add application" dialog + click-card detail panel (company, title, URL, notes, linked resume select)
- Status change inserts `job_status_changed` notification

### 5. Dashboard (post-login landing at `/`)
- Stat cards: total applications, active (applied+interviewing), offers, avg resume score
- Donut: applications by status (Recharts)
- Line: applications created per week (last 8 weeks)
- Recent activity feed (last 10 notifications + recent app status changes)
- All queries scoped to `auth.uid()` via RLS, no mocks

### 6. Realtime notifications
- Bell icon in top bar with unread count
- Realtime subscription on `notifications` filtered by `user_id` → live badge + dropdown list
- Click notification → mark read + navigate to resume/application

### 7. Settings
- Profile (full name, avatar upload to `avatars` bucket)
- Change password (Supabase `updateUser`)
- Dark mode toggle (already wired in step 1, surface here too)
- Plan label: "Free Plan" (no checkout flow)

## Technical detail

```text
src/
  routes/
    __root.tsx                    sidebar provider, dark mode init, realtime auth listener
    index.tsx                     redirects to /dashboard or /auth
    auth.tsx                      login + signup
    _authenticated/
      route.tsx                   (integration-managed gate, ssr:false)
      dashboard.tsx
      resumes.index.tsx           list + upload
      resumes.$id.tsx             detail + AI feedback
      applications.tsx            kanban + table toggle
      notifications.tsx           full list
      settings.tsx
  components/
    app-sidebar.tsx, mobile-tabs.tsx, notification-bell.tsx
    resume-card.tsx, resume-upload.tsx, ai-feedback-panel.tsx
    kanban-board.tsx, application-dialog.tsx
    dashboard/{stat-card,status-donut,activity-line,recent-feed}.tsx
    empty-state.tsx, theme-toggle.tsx
  lib/
    resumes.functions.ts          uploadResume, deleteResume, analyzeResume(server fn, calls OpenAI)
    applications.functions.ts     CRUD + status update
    notifications.functions.ts    markRead, markAllRead
    profile.functions.ts          updateProfile
    pdf-extract.server.ts         server-only text extraction
  integrations/supabase/...       auto-generated by Cloud
```

Server functions use `requireSupabaseAuth` middleware → all writes scoped to current user via RLS. Public routes (auth, landing redirect) call no protected fns. Admin role exists in schema for future use; no admin UI built.

## Out of scope (per your spec)
- No Stripe/payments
- No admin dashboard UI
- No email sending beyond Supabase defaults
- No password reset page (would need separate ask)

## What I need from you
- Confirm OpenAI direct (you'll provide `OPENAI_API_KEY`) vs. Lovable AI gateway (free, no key)
- Then I enable Cloud, run the migration, and build straight through.