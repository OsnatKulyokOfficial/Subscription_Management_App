-- =========================================
-- Training App Database Schema
-- Run this in your Supabase SQL Editor
-- =========================================

-- Users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'trainee' CHECK (role IN ('trainee', 'coach')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups (קבוצות אימון)
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  max_capacity INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions (אימונים - תבנית)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun .. 6=Sat
  session_time TIME NOT NULL,
  is_recurring BOOLEAN DEFAULT TRUE,
  session_date DATE,                 -- NULL for recurring, set for one-time
  is_cancelled BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Group memberships (שיוך מתאמן לקבוצה)
CREATE TABLE IF NOT EXISTS public.user_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

-- Registrations (הרשמות לאימון ספציפי)
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  attended BOOLEAN,                  -- NULL=לא סומן, TRUE=הגיע, FALSE=לא הגיע
  UNIQUE(user_id, session_id, occurrence_date)
);

-- Group transfers (היסטוריית העברות)
CREATE TABLE IF NOT EXISTS public.group_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  from_group_id UUID REFERENCES public.groups(id),
  to_group_id UUID REFERENCES public.groups(id),
  transferred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications log
CREATE TABLE IF NOT EXISTS public.notifications_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  message TEXT NOT NULL,
  type TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- RLS (Row Level Security)
-- =========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own row; coaches can read all
CREATE POLICY "users_self" ON public.users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "coaches_read_users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'coach')
  );

-- Groups: everyone can read; coaches can write
CREATE POLICY "read_groups" ON public.groups FOR SELECT USING (true);
CREATE POLICY "coaches_write_groups" ON public.groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'coach')
  );

-- Sessions: everyone can read; coaches can write
CREATE POLICY "read_sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "coaches_write_sessions" ON public.sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'coach')
  );

-- User groups: trainees read own; coaches read/write all
CREATE POLICY "user_groups_self" ON public.user_groups
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "coaches_user_groups" ON public.user_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'coach')
  );

-- Registrations: trainees manage own; coaches manage all
CREATE POLICY "registrations_self" ON public.registrations
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "coaches_registrations" ON public.registrations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'coach')
  );

-- Transfers: coaches only
CREATE POLICY "coaches_transfers" ON public.group_transfers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'coach')
  );

-- Notifications: coaches only
CREATE POLICY "coaches_notifications" ON public.notifications_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'coach')
  );

-- =========================================
-- Trigger: auto-create user on signup
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone, role)
  VALUES (NEW.id, NEW.phone, 'trainee')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================
-- Sample Data (edit coach phone below!)
-- =========================================

-- Insert sample groups
INSERT INTO public.groups (name, color) VALUES
  ('קבוצת 17:00', '#4f46e5'),
  ('קבוצת 18:00', '#10b981'),
  ('קבוצת 19:00', '#f59e0b')
ON CONFLICT DO NOTHING;

-- Recurring sessions for each group (ראשון, שלישי, חמישי)
WITH g AS (SELECT id, name FROM public.groups)
INSERT INTO public.sessions (group_id, day_of_week, session_time, is_recurring)
SELECT id, d, session_time::TIME, TRUE
FROM g
CROSS JOIN (VALUES (0,'17:00'::TIME),(2,'17:00'::TIME),(4,'17:00'::TIME)) AS t(d, session_time)
WHERE g.name = 'קבוצת 17:00'
ON CONFLICT DO NOTHING;

WITH g AS (SELECT id FROM public.groups WHERE name = 'קבוצת 18:00')
INSERT INTO public.sessions (group_id, day_of_week, session_time, is_recurring)
SELECT id, d, '18:00'::TIME, TRUE
FROM g
CROSS JOIN (VALUES (0),(2),(4)) AS t(d)
ON CONFLICT DO NOTHING;

WITH g AS (SELECT id FROM public.groups WHERE name = 'קבוצת 19:00')
INSERT INTO public.sessions (group_id, day_of_week, session_time, is_recurring)
SELECT id, d, '19:00'::TIME, TRUE
FROM g
CROSS JOIN (VALUES (1),(3)) AS t(d)
ON CONFLICT DO NOTHING;

-- !! IMPORTANT: After creating your coach account via the app,
--    run this to promote them to coach role (replace the phone number):
--
--  UPDATE public.users SET role = 'coach' WHERE phone = '+972501234567';
--  UPDATE public.users SET name = 'המאמן שלי' WHERE phone = '+972501234567';
