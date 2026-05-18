-- Run this in Supabase SQL Editor (after schema.sql)

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "coaches_read_tokens" ON public.fcm_tokens;

CREATE POLICY "users_own_tokens" ON public.fcm_tokens
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "coaches_read_tokens" ON public.fcm_tokens
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'coach')
  );
