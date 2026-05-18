-- Drop the FK that links fcm_tokens to auth.users (we use our own users table now)
ALTER TABLE public.fcm_tokens DROP CONSTRAINT IF EXISTS fcm_tokens_user_id_fkey;
