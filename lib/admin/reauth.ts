import { createBrowserClient } from "@/lib/supabase/client";

// Step-up re-authentication for destructive admin actions (e.g. deleting a
// ticket). We re-verify the admin's password by signing in again with their
// current email: a success proves they currently know the password, blunting a
// hijacked-but-idle session from doing irreversible damage. This does NOT issue
// a new factor or change the session's AAL - it is a possession-of-password
// check. (TODO(admin-mfa): once MFA ships, prefer an AAL2 step-up challenge.)
//
// Returns true on success; throws on a wrong password / no session so callers
// can surface the error and abort the destructive action.

export async function requireReauth(password: string): Promise<boolean> {
  const supabase = createBrowserClient();

  const { data, error: userErr } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (userErr || !email) {
    throw new Error("Could not verify your session. Please sign in again.");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error("Incorrect password.");
  }

  return true;
}
