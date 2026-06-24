
-- 1) Move has_role out of the publicly-exposed schema
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Repoint every policy that referenced public.has_role
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR app_private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR app_private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users manage own resumes" ON public.resumes;
CREATE POLICY "Users manage own resumes" ON public.resumes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own applications" ON public.job_applications;
CREATE POLICY "Users manage own applications" ON public.job_applications
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR app_private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users manage own enhancements" ON public.resume_enhancements;
CREATE POLICY "Users manage own enhancements" ON public.resume_enhancements
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

-- Drop the publicly-exposed version (no longer referenced)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 2) Lock down realtime.messages so authenticated users can't subscribe to arbitrary channels
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
-- No policies created: app uses postgres_changes (governed by table RLS),
-- not Realtime Broadcast/Presence, so default-deny on realtime.messages is correct.
