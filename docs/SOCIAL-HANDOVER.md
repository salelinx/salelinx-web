# Social Stats work: handover (temporary)

**Delete this file before `feat/social-stats-index` merges.** It is a working note for carrying on from another machine; the lasting documentation is `docs/SOCIAL.md`.

Written 16 Nov 2026.

## Where things are

- **Branch:** `feat/social-stats-index`, cut from `main` at `0f6f976` (the PR #296 merge). No PR yet.
- **What is on it (built, all checks passed):**
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

## Live state, not confirmed

1. **Is 054 applied?** In the SQL editor: `select to_regclass('public.marketing_video_age_points');` returns the name if it is. Until it is, Stats shows a notice and tags cannot save.
2. **Was `marketing-sync` redeployed after 054?** `npx supabase functions deploy marketing-sync --no-verify-jwt --project-ref owaxopwpktmffqsxavsz`. **Order matters:** deployed before 054, it fails for every platform because it writes 054's columns.
3. **TikTok secrets** `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` were set again on 16 Nov (the sandbox app's). The client secret was pasted into a chat, so consider generating a new one in the TikTok developer portal and setting it again.
4. Still open from PR #296: the 5-minute `marketing-publish` Cron job and the 1 GB Storage upload limit.

## Next task: rework the Stats page (not started)

The user looked at the new Stats page and said, in short: it is hard to understand; clean it up, no fluff; good-looking stats and figures; split it into separate sidebar sections if needed; detailed, useful information; be able to compare things and A/B test.

Proposed plan (agreed direction, not yet shown to the user):

**Sidebar, Social group** (`lib/admin/modules.ts`): Overview, Posts, Compare, Timing, Experiments, Planner, Accounts. Each is its own route under `/admin/marketing/`.

1. **Overview** (`/admin/marketing`): a row of figure tiles (views gained, posts, typical post index, watched %, shares per 1k, followers gained), each with the change against the previous period and a sparkline. One chart of views gained per day, stacked by platform. The period's top 5 posts with thumbnails. No explanatory paragraphs: definitions go in tooltips.
2. **Posts** (`/admin/marketing/posts`): the full table. Every column sortable by its header; filters for platform, tag and date; search. Raw views at 24 hours and 7 days next to the index badge.
3. **Compare** (`/admin/marketing/compare`): the "why it works" page. Pick a "group by" (platform, length, day, time slot, caption length, question, hashtags, call to action, opening, style, topic, sound, face, hook text, collab) and a measure (index at 24h or 7d, views, watched %, shares, saves or subscribers per 1k). One row per group: number of posts, median, a dot per post, the median bar, the lift against everything else, and a verdict from `permutationP` in `lib/social/experiments.ts` ("real difference", "leaning", "too few posts"; it cannot reach p < 0.05 with fewer than 4 a side). Also a direct A against B pick. Never pool raw views across platforms; the index can pool.
4. **Timing** (`/admin/marketing/timing`): day by time-slot heatmap of the median index, with the post count in each cell and cells under 3 posts greyed.
5. **Experiments:** keep the logic; restyle the results to match (big figures, lift, verdict badge, a dot per video, the curves). Nice to have: start an experiment from a Compare finding.
6. **Accounts** (`/admin/marketing/accounts`): connect and reconnect, sync status, followers over time per platform (`marketing_account_stats`), lifetime views. This moves out of the Stats page.

**How to build it:**
- Move the loading in `app/admin/marketing/page.tsx` into a shared server loader (for example `lib/social/load.ts`) so each route reads the same data through `assembleVideos()`.
- Put the grouping maths in a pure `lib/social/compare.ts` with tests, next to `tests/social-overview.test.ts`.
- Charts follow the admin chart variables (`--admin-chart-*`, `--viz-*`), since hard-coded hex does not follow the light/dark switch. Keep the blue/orange index scale in `components/admin/social/IndexBadge.tsx`.
- Show screenshots in light and dark before calling it done. The admin pages need a signed-in MFA admin, so the last session used a temporary ungated preview route with made-up data (and deleted it afterwards).

## Decisions already made

- **The index:** a video's views at 24 hours or 7 days divided by the median of its platform's 30 most recent measured videos at the same age, leaving itself out, with at least 3 others needed. 1.0x is typical. It cancels the age of a video, each platform's way of counting views (YouTube counts every Shorts replay since 31 Mar 2025) and good or bad months. Details in `docs/SOCIAL.md` "Stats".
- **Tags** are stored as the label text. A planner post's tags live on `social_posts.tags`; any other video keeps its own on `marketing_videos.tags`. Both are written only through `admin_set_social_tags()`, which is audited. Automatic tags are worked out on the page, never stored.
- **TikTok direct posting** waits on a TikTok API for Business app ("SaleLinx Marketing", TikTok Accounts scope), pending review since 16 Nov. When approved: publish with `/business/video/publish/`, then check `/business/publish/status/`. The `video_url` must be on a verified domain or URL prefix, which Supabase signed URLs are not as they stand.
