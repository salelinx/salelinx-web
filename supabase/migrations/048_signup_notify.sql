-- Sends only the id so no password hash leaves the database; errors are swallowed so a signup never fails.

CREATE OR REPLACE FUNCTION public.notify_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://owaxopwpktmffqsxavsz.supabase.co/functions/v1/signup-notify',
      body := jsonb_build_object('id', NEW.id),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_signup: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_signup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_signup ON auth.users;
CREATE TRIGGER trg_notify_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_signup();
