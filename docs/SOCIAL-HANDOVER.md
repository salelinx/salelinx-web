# Social Stats work: handover (temporary)

**Delete this file before `feat/social-stats-index` merges.** It is a working note for carrying on from another machine; the lasting documentation is `docs/SOCIAL.md`.

Written 16 Nov 2026.

## Where things are

- **Branch:** `feat/social-stats-index`, cut from `main` at `0f6f976` (the PR #296 merge). No PR yet.
- **What is on it (built, all checks passed), from the desktop:**
  - Migration `054_social_tags.sql`: `tags` on `social_posts` and `marketing_videos`, `media_seconds` on posts, `duration_seconds` and `caption` on videos, the `marketing_video_age_points` view, and the `admin_set_social_tags()` RPC. Tested on a local Postgres (admin reads and tags; non-admins, AAL1 and anon are refused).
  - Stats overview at `/admin/marketing`: every post as an index against our typical post on the same platform at 24 hours or 7 days, a Health table, By platform, the posts table with per-platform badges, and Accounts at the bottom.
  - Tagging: the Planner's post editor has "What's in this video"; Stats can tag any video, and "Tag untagged videos" steps through the rest. Length, UK posting slot and caption traits are tagged automatically.
  - `marketing-sync` saves each video's length and caption.
  - Docs: `docs/SOCIAL.md` "Stats" and "Tags", `docs/ADMIN.md`, `docs/EDGE-FUNCTIONS.md`.
- **Design ideas canvas (15 boards):** https://claude.ai/artifact/JfMc9vrkvFAUQswsJdZfMG

## Carry on from another machine

```sh
git fetch origin
git checkout feat/social-stats-index
npm install                 # also turns on the commit hooks
# copy .env.local from the desktop (it is git-ignored, never commit it)
npx supabase login          # once per machine
npx supabase link --project-ref owaxopwpktmffqsxavsz   # needed for `db query --linked`
npm run dev                 # sign in, MFA, open http://localhost:3000/admin/marketing
```

- **Never `supabase db push`** (see `supabase/migrations/README.md`). Apply a migration with `npx supabase db query --linked -f <file>` or the SQL editor.
- **Pushing:** run `gh auth switch -u mattval1 && gh auth setup-git` right before every push; `mvaletsky` has no access to the org.
- **Lewis also merges to `main`.** Fetch and read `origin/main` before building on it.
- **Tests on Windows:** `tests/blog-content.test.ts` fails locally because of CRLF line endings. Unrelated; everything else passes.
- **Deno check:** run it on a copy of `supabase/functions/` outside the repo, or it trips on `node_modules`.

## Live state (checked 16 Nov, late)

1. **054 is applied:** `marketing_video_age_points` exists.
2. **`marketing-sync` was redeployed after 054 and has run:** `duration_seconds` and `caption` are filling in (all Facebook, nearly all TikTok and YouTube; Instagram gives no length).
3. **TikTok secrets** `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` were set again on 16 Nov (the sandbox app's). The client secret was pasted into a chat, so consider generating a new one in the TikTok developer portal and setting it again.
4. Still open from PR #296, not checked: the 5-minute `marketing-publish` Cron job and the 1 GB Storage upload limit.

## Done on the laptop: more Stats pages, under a Stats dropdown

The direction changed: instead of reworking the Stats page, the user asked for a separate sidebar section with different stats, split into subsections, "as much data and analytics as possible". Built on this branch, not yet committed when written:

- **Stats is now a dropdown in Social** (`children` in `lib/admin/modules.ts`, rendered by `AdminNavList` in `components/admin/AdminSidebar.tsx`): Overview (the existing Stats page, unchanged), then Totals, Posts, Compare, Timing, Engagement, Growth and Lifecycle, under `/admin/marketing/insights`. They first went in as a separate "Social insights" group; the user asked for them inside Social with Stats as the dropdown instead. Planner and Experiments are unchanged.
- **One loader** `lib/social/load.ts`; arithmetic in `lib/social/insights.ts` and `lib/social/compare.ts`, tested in `tests/social-insights.test.ts`. No migration.
- **Charts** in `components/admin/insights/charts.tsx` (stacked columns that also go negative, lines with a crosshair, dot strips, heatmap, columns round 1.0x, segmented bar), drawn at the container's width, on the `--viz-*` and `--admin-chart-*` variables. Platforms keep fixed slots: YouTube 1, Instagram 2, TikTok 3, Facebook 4 (validated for colour blindness in both themes).
- **`permutationP`** now draws only the smaller side when it samples (partial Fisher-Yates), so Compare can test dozens of groups quickly. Same test; sampled p-values on Experiments can move by sampling noise.
- Checked with screenshots in light and dark and at phone width, from a temporary ungated route fed a read-only snapshot of the live tables (deleted afterwards, never committed).
- Docs: `docs/SOCIAL.md` "Stats pages", `docs/ADMIN.md` modules table and the dropdown note under "Routing & layout".

Ideas not built: start an experiment from a Compare finding; a calendar of posts; a "fatigue" view (does a topic decline the more often we post it).

## Decisions already made

- **The index:** a video's views at 24 hours or 7 days divided by the median of its platform's 30 most recent measured videos at the same age, leaving itself out, with at least 3 others needed. 1.0x is typical. It cancels the age of a video, each platform's way of counting views (YouTube counts every Shorts replay since 31 Mar 2025) and good or bad months. Details in `docs/SOCIAL.md` "Stats".
- **Tags** are stored as the label text. A planner post's tags live on `social_posts.tags`; any other video keeps its own on `marketing_videos.tags`. Both are written only through `admin_set_social_tags()`, which is audited. Automatic tags are worked out on the page, never stored.
- **TikTok direct posting** waits on a TikTok API for Business app ("SaleLinx Marketing", TikTok Accounts scope), pending review since 16 Nov. When approved: publish with `/business/video/publish/`, then check `/business/publish/status/`. The `video_url` must be on a verified domain or URL prefix, which Supabase signed URLs are not as they stand.
