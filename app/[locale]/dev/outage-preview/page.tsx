import { notFound } from "next/navigation";

// Dev-only preview of the maintenance / error screen, so the copy can be seen
// without taking Supabase down. Throws on purpose: error.tsx is an error
// boundary, so the only honest way to see it is to actually fail.
//
// 404s in production. The equivalent of the extension's
// Settings > Simulate cloud outage toggle.
//
// Which copy you get is decided by error.tsx asking /api/health/supabase:
//   - Supabase healthy  -> "Something went wrong" (the bug branch)
//   - Supabase down     -> "We're temporarily down" (the outage branch)
//
// To see the outage branch without a real outage, run the app pointed at an
// unreachable host, which makes the probe return 503:
//
//   NEXT_PUBLIC_SUPABASE_URL=https://offline.invalid \
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=anything npm run build && npm start
//
// then open /dev/outage-preview.
export const dynamic = "force-dynamic";

export default async function OutagePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  await Promise.resolve();
  throw new Error("outage-preview: simulated Supabase failure");
}
