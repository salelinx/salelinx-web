import { cookies } from "next/headers";
import {
  createServerClient as createClient,
  type CookieOptions,
} from "@supabase/ssr";

type CookieEntry = { name: string; value: string; options?: CookieOptions };

export async function createServerClient() {
  const cookieStore = await cookies();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (entries: CookieEntry[]) => {
          try {
            entries.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't set cookies — middleware handles refresh.
          }
        },
      },
    },
  );
}
