-- הרץ את זה ב-Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.users (id, phone, role)
    VALUES (
      NEW.id,
      '+' || substr(split_part(COALESCE(NEW.email, ''), '@', 1), 2),
      'trainee'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- לא לחסום את הרישום בגלל שגיאה בטבלה
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
