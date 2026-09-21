// Lets an external scheduler start the Supabase watchdog.
//
// The watchdog's own GitHub schedule asks for four runs an hour and does not
// get them: scheduled runs are best-effort and high-frequency crons are the
// first dropped under load, leaving gaps of hours. See docs/OVERVIEW.md for
// the outage that sat inside one, and for why the caller is cron-job.org
// rather than Vercel or UptimeRobot.
//
// This is an adapter, not a decision. The caller cannot invoke GitHub itself:
// workflow_dispatch needs a POST with a bearer token, an Accept header and a
// JSON body, which is more than a cron service's URL field allows. Doing it
// here also keeps the GitHub token server-side, where a scheduler's stored
// job config cannot leak it.
//
// It deliberately does not probe. The workflow already probes three times and
// stands down on its own, so a second copy of that rule here could only
// disagree with the first. This just says "go and look" - which is why it is
// safe to call blind on a fixed interval, and why it needs no idea whether
// Supabase is actually down. The repo is public, so a run that finds nothing
// wrong costs nothing.

import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/safe-equal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DISPATCH_URL =
  "https://api.github.com/repos/salelinx/salelinx-web/actions/workflows/supabase-watchdog.yml/dispatches";

/** Well under the platform's function limit so a hung GitHub API leaves a real
 *  answer in the log rather than an opaque timeout. */
const DISPATCH_TIMEOUT_MS = 8_000;

export async function GET(request: Request) {
  const noStore = { "Cache-Control": "no-store, max-age=0" };

  // Unlike /api/health/supabase, this refuses to run unauthenticated rather
  // than defaulting open: it causes an action, and every call spends a CI run
  // that probes the very service the watchdog protects.
  const secret = process.env.WATCHDOG_TRIGGER_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "WATCHDOG_TRIGGER_SECRET not configured" },
      { status: 500, headers: noStore },
    );
  }
  // Header only, deliberately: a secret in the query string lands in access
  // logs, and the scheduler supports custom headers.
  if (!safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401, headers: noStore },
    );
  }

  const token = process.env.WATCHDOG_DISPATCH_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "WATCHDOG_DISPATCH_TOKEN not configured" },
      { status: 500, headers: noStore },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
  try {
    const res = await fetch(DISPATCH_URL, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "salelinx-watchdog-trigger",
      },
      body: JSON.stringify({ ref: "main" }),
    });
    // 204 is the documented success; anything else is a config fault worth
    // seeing (404 here usually means the token expired or lost its Actions
    // scope, not that the workflow moved).
    if (res.status !== 204) {
      return NextResponse.json(
        { ok: false, error: `dispatch failed with ${res.status}` },
        { status: 502, headers: noStore },
      );
    }
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json(
      { ok: false, error: "dispatch request failed" },
      { status: 502, headers: noStore },
    );
  } finally {
    clearTimeout(timer);
  }
}
