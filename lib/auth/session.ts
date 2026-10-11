import { createServerClient } from '@/lib/supabase/server';

export async function isSignedIn(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}
