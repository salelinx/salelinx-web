# Social

The admin console's Social group: SaleLinx's own YouTube, Instagram, TikTok and Facebook Page. Its pages sit under `/admin/marketing` for URL history:

| Page | Route | What it does |
| --- | --- | --- |
| Stats > Overview | `/admin/marketing` | Every recent post against our typical one (the index), the period's health, each platform, and every video with its tags (see "Stats" and "Tags" below, and `docs/ADMIN.md` "Marketing"). Each title opens the video's own page. |
| Video | `/admin/marketing/videos/<platform>/<id>` | Every lifetime figure the platform gives, views at 1h / 6h / 24h / 3d / 7d against our typical video there, the first-week curve and views gained per day. |
| Planner | `/admin/marketing/planner` | The plan as a week, a month or a list, with failures and TikTok inbox items at the top and drafts beside it. Upload a video, write one caption (or one per platform), pick a time, and `marketing-publish` posts it. See "Planner" below. |
| Experiments | `/admin/marketing/experiments` | Tests that run themselves: each tag's two most posted options head to head at 24 hours. |
| Stats > Totals, Posts, Compare, Timing, Engagement, Growth, Lifecycle | `/admin/marketing/insights/*` | The rest of the Stats dropdown: the deeper read of the same snapshots, one page per question. See "Stats pages" below. |

It is company data about our own channels, like `042_marketing.sql`: no `user_id`, nothing for the ROPA or the deletion runbook. Who did what is in `admin_audit_log`.

It lives in this repo, not its own, because it leans on everything the console already has: admin login, MFA (AAL2), the audit log, the stored platform logins, the stats tables and the Edge Function gate. A separate app would have to copy all of that. The boundary is kept tight so it could still be lifted out: `lib/social/`, `components/admin/social/`, `components/admin/insights/`, `app/admin/marketing/`, the `marketing-*` functions and migrations 042, 052, 053 and 054.

## One-time setup

1. **Apply `052_social.sql`** (SQL editor or `supabase db query --linked -f`, never `db push`; see `supabase/migrations/README.md`). It is numbered 052 because `feat/shopify-link` carries a 050 that is renumbered when it merges.
2. **Raise the Storage upload limit.** The `social-media` bucket allows 1 GB a file, but the project's global limit (Storage settings) caps it; the default is 50 MB.
3. **YouTube login (new).** In a Google Cloud project we control. Ours is a new one, since the project behind the original `YOUTUBE_API_KEY` belongs to an account we cannot open; a fresh API key from the same project can replace that key, so everything YouTube lives in one place:
   - Enable YouTube Data API v3 and YouTube Analytics API.
   - Create an OAuth client (Web application) with the redirect URI `https://<project>.supabase.co/functions/v1/marketing-oauth`.
   - Set the OAuth consent screen's publishing status to **In production**. In Testing, Google's refresh tokens expire after 7 days and posting stops. An unverified app in production shows a warning on the consent screen, which is fine for our own login.
   - `supabase secrets set YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=...`
4. **Instagram is set up with Facebook (step 6).** Meta stopped offering Instagram Login to new apps in 2026 ("API setup with Instagram login is not available for newer apps"; the dashboard offers "Unified login" instead), so Instagram is reached through the SaleLinx Facebook Page it is linked to, with that Page's token. Link the Instagram professional account to the Page first (the Page's Linked accounts, or Meta Business Suite). `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` are no longer read.
5. **TikTok.** Add the Content Posting API product to the TikTok for Developers app and the `video.upload` scope (Upload to inbox), for stats and the inbox fallback. To post publicly, also (see "TikTok" below):
   - In the TikTok API for Business app, set the TikTok account holder redirect URL to the `marketing-oauth` URL.
   - `supabase secrets set TIKTOK_BUSINESS_APP_ID=... TIKTOK_BUSINESS_SECRET=...` (My Apps > App Detail).
   - Apply `060_social_tiktok_posting.sql`, deploy `marketing-oauth` and `marketing-publish`, then press TikTok in the Planner header and log in as the SaleLinx TikTok.
6. **Facebook and Instagram (migration `053_social_facebook.sql` first).** One Meta app with the **Manage everything on your Page** and **Manage messaging & content on Instagram** use cases, between them granting `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `read_insights`, `instagram_basic`, `instagram_content_publish` and `instagram_manage_insights`. Add the `marketing-oauth` URL to Facebook Login for Business's valid OAuth redirect URIs (the Instagram use case's Unified login page has the same field). Then `supabase secrets set FACEBOOK_APP_ID=... FACEBOOK_APP_SECRET=...`, the app's ID and secret from App settings > Basic. A Business-type app logs in through a Facebook Login for Business configuration rather than a scope list: create one with those permissions and both asset types (Pages and Instagram accounts) and set `FACEBOOK_LOGIN_CONFIG_ID`. A user access token is the expected type; a system-user one also works, since the code keeps it as it is when it cannot be swapped for a long-lived one. The configuration also grants `instagram_manage_comments`, `instagram_manage_messages`, `ads_read` and `ads_management`, by choice, for features to come; nothing reads them today. That makes the stored Page token more powerful than posting needs (it could read DMs and change ads), which is one more reason it stays in `marketing_accounts` with no RLS policies. Whoever connects must manage the SaleLinx Page; if their login manages several Pages and none is clearly SaleLinx, set `FACEBOOK_PAGE_ID`.
7. **Deploy** `marketing-oauth`, `marketing-sync` and `marketing-publish` (all `--no-verify-jwt`).
8. **Reconnect all of them**, on the Stats tab or with the platform buttons in the Planner header. Older logins lack the posting scopes; their button reads "Reconnect to post" (Stats) or "Reconnect" (Planner). The login returns to the page it started from, including a local dev server: `marketing-oauth` signs the return address into its state and only accepts our site or `http://localhost:<port>`, under `/admin/marketing`. The platform's own redirect address stays the deployed function's URL, so connecting from localhost still needs `marketing-oauth` deployed.
9. **Cron job.** A dashboard Cron job every 5 minutes (`*/5 * * * *`) POSTs to `marketing-publish` with the `x-marketing-cron-secret` header, the same `MARKETING_SECRET` as `marketing-sync`'s hourly job.
10. **Apply `054_social_tags.sql`, then redeploy `marketing-sync`.** In that order: the function writes 054's `duration_seconds` and `caption` columns, so deployed first it fails every platform's sync. Until 054 runs, Stats shows no index and tags can't be saved.
11. **Apply `061_social_auto.sql`** for automatic tags and the brief. Until it runs, the brief isn't saved and `npm run social:tag` writes nothing.

## How posting works

`marketing-publish` runs every 5 minutes, and on Post now / Check now. Each run calls `social_claim_targets()`, which picks what is due and locks it for 10 minutes, so two runs never take the same platform. A run starts no new upload after 60 seconds, so it finishes inside the function's time limit; the rest waits for the next run.

Each post has one row per platform in `social_post_targets`, with its own caption, options and progress:

| Status | Meaning |
| --- | --- |
| `pending` | Waiting for its time |
| `sending` | An irreversible call is in flight (upload, publish) |
| `processing` | The platform has the file and is working on it; the next run checks again |
| `inbox` | TikTok without its posting login: in the app's inbox, waiting for someone to tap Post |
| `published` | Live. `external_id` is the video's id on the platform |
| `failed` | See `error`. Retry puts it back to `pending`. A Facebook failure that may have posted is still looked for on the Page for 7 days (see Facebook) |

**Never posting twice is the rule everything else bends to.** A run that dies in `sending` is not retried: the next claim fails it with "Check the platform before retrying: it may have posted". Network errors and 5xx before anything irreversible are retried 3 times (2, 4, 8 minutes). Once a platform has started, the post can no longer be edited, only copied or deleted. Deleting removes our plan, never the live video. Failed is final for posting, not for looking: a read-only check may still find a failed post live and mark it published, since that can never post anything.

When a platform goes live, `marketing-publish` adds the video to `marketing_videos` straight away, so it shows on Stats without waiting for the next sync.

### YouTube

- Claimed an **hour early** and uploaded private with `publishAt` set to the scheduled time, so YouTube processes it and flips it public on time itself. A public post less than 10 minutes off, or Post now, goes up public at once. Unlisted and private go up as they are.
- One resumable upload in 8 MiB pieces, read from the bucket by byte range. The video only exists once the last piece lands, so a failure before that is retried; a lost answer to the last piece is not.
- The cover image becomes the thumbnail, which needs a verified channel (a failure is a note, not a failure of the post).
- **Audit:** Google has locked uploads from unaudited API projects (created after 28 July 2020) to private, though its own pages disagreed on this in late 2026. If a public upload comes back private, the post's note says so; the fix is the YouTube API Services audit form in Google Cloud. Uploads cost quota (1,600 units each on the old pricing, against 10,000 a day).

### Instagram

- Reached through the SaleLinx Facebook Page: `marketing-oauth`'s Facebook login reads the Page's `instagram_business_account` and saves an Instagram row with the Page's token and the Instagram account id. Pressing Instagram or Facebook connects both; if the Page has no Instagram account linked, Facebook is still saved and Instagram reports `no_instagram`. The calls go to `graph.facebook.com/{ig-user-id}` with the same container, publish and insights endpoints as before, and the token never needs renewing.

- Instagram has no publish time of its own, so it runs at the scheduled time: a Reels container with `video_url` set to a 2-hour signed URL of the bucket file, which Meta fetches; `media_publish` once the container is `FINISHED`. Short Reels are often ready within the run; otherwise the next run checks.
- **Trial Reels** (`trial_params`, Meta's API since late 2025) are shown to non-followers first: "Trial, I share it to followers" graduates from the app, "Trial, Instagram shares it if it does well" lets Instagram decide. This is the closest thing to a built-in A/B test on any of the three.
- Limits checked in the planner: 2,200-character caption, 30 hashtags, 20 mentions; a warning over 300 MB. Meta allows 100 API posts per account per 24 hours.

### Facebook

- A Reel on our Page through the Reels Publishing API: `upload_phase=start`, then Meta fetches the file itself from a 2-hour signed URL (`file_url` on `rupload.facebook.com`), then `upload_phase=finish` with `video_state=PUBLISHED` and the caption as its description. The next runs check the video's `status` until `publishing_phase` is complete.
- **Facebook often won't show a new Reel to the Page token** ("Object with ID ... does not exist, cannot be loaded due to missing permissions", seen on every Reel in November 2026), though the publish went through. When that read fails, the check looks for the video id in the Page's own `/video_reels` list instead (what `marketing-sync` reads, with the same token) and takes the link and time from there. Not listed after an hour, it fails with "check the Page". Once `finish` has answered, no read may fail or throw the post: a failure offers Retry and a throw sends the target back to `pending`, and either would post the Reel twice.
- **Failed posts are looked for, too.** At the end of each run, `recheckFailedFacebook` (in `index.ts`) takes Facebook targets that failed in the last 7 days with an error saying they may have posted (a lost `finish` answer, a run that died in `sending`, the hour limit above, or a refused read quoting the Reel's id). It reads the Page's Reels list once and matches each by id (from `job` or the quoted error), or else by an identical caption posted within 3 hours of the failure, and only if exactly one Reel fits and no other post has it (`findFailedReel` in `plan.ts`, tested). A match turns the target `published`, only while it is still `failed`, so a Retry in the meantime wins. Nothing is ever posted by this; Retry stays a person's decision.
- Posted at the scheduled time, like Instagram. Meta's reference lists `SCHEDULED` with `scheduled_publish_time` for Reels, but third-party guides say it does not work, so it is not relied on.
- Publishing has no idempotency key, so `finish` is the irreversible step: a lost answer fails the post with "check the Page", never a blind retry.
- The login keeps only the Page's own token, which does not expire (it comes from a long-lived user token), so `_shared/marketing-login.ts` never renews it. It stops if the person who connected loses the Page or changes their password; Reconnect fixes it.
- Reels must be vertical and 3 to 90 seconds; the planner warns. Captions up to 5,000 characters here (Facebook allows more; the database caps captions at 5,000).
- Stats come from `/video_reels` (likes and comments as summaries) and each Reel's `video_insights`: plays (`fb_reels_total_plays`, or the older `blue_reels_play_count`), reach (`post_impressions_unique`) and watch time. Facebook gives no share count for Reels here, and its insight metric names change between API versions, so a Reel whose insights are refused is still listed with its likes and comments.

### TikTok

TikTok has **two logins**, two rows in `marketing_accounts`:

| Login | App | Does |
| --- | --- | --- |
| `tiktok` | TikTok for Developers (Login Kit, Display API), `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | Reads stats; the inbox fallback below. Connected from Stats. |
| `tiktok_business` (migration 060) | TikTok API for Business, "SaleLinx Marketing" (approved 18 Nov 2026), `TIKTOK_BUSINESS_APP_ID` / `TIKTOK_BUSINESS_SECRET` | Posts publicly. Connected with the TikTok button in the Planner header. |

Stats stays on the first because the Business API reports views, likes and shares 24 to 48 hours late, and Stats needs each video's views at 24 hours.

**Posting publicly (the posting login).** At the scheduled time `marketing-publish` copies the video, inside Storage, into the public `social-public` bucket as `tiktok/<post id>.<ext>`, and sends that address to `/business/video/publish/` with the caption and the post's labels (promotional content, AI-generated; the editor's TikTok settings). TikTok fetches the file itself, so nothing passes through the function. The next runs check `/business/publish/status/` until `PUBLISH_COMPLETE` gives the post id (up to 3 minutes later), then delete the copy. Publishing has no idempotency key: a refusal with a TikTok error code fails the post safely, but a lost answer fails it with "check TikTok", never a blind retry. TikTok allows 15 API posts a day per account, 3 seconds to 10 minutes, up to 1 GB; the planner warns on length.

**Why a public bucket.** TikTok only fetches a `video_url` under an address the app has proved it owns. Supabase signed URLs cannot be proved (the proof file would need a token as well), so `social-public` exists for this alone: no policies, so nothing lists it; paths are the post's UUID; each copy lives only until TikTok has it. Connecting the posting login proves it, through `_shared/tiktok-business.ts`: it adds the bucket's URL prefix as a URL property (`/business/property/add/`, with the app's ID and secret, no login), writes the proof file TikTok names at the bucket's root, and asks TikTok to check (`/business/property/verify/`). Already proved, it stops at the list. If it fails, the Planner says so after connecting, and pressing the button again retries.

**The posting login must be our account.** `marketing-oauth` reads the login's username (`/business/get/`) and refuses one that differs from the stats login's handle (or `TIKTOK_HANDLE`, before there is one), since posts go wherever it points. It asks for only `user.info.basic`, `user.info.username` and `video.publish`, though the app was approved for more (comments among them); a feature that reads comments needs its `docs/GDPR.md` entry first. If TikTok's login page answers "correct the following: scope" (`invalid_scope`) while `user.info.basic` alone works, TikTok has not switched on the app's TikTok accounts permissions (the warning triangle on them in the portal): its API for Business support syncs them on request, as it did in Nov 2026.

**Without the posting login: the inbox.** The old way still runs for anything already started that way, and for new posts while the posting login is not connected. At the scheduled time the video is uploaded to the TikTok app's inbox with the stats login (`video.upload`); TikTok notifies the account, and someone opens it, pastes the caption (the planner has Copy caption) and posts. The inbox API takes no caption. The status check follows it: `inbox` until posted, then `published` once TikTok gives the public post id; 7 days in the inbox without a post fails it. (That app can't post publicly: TikTok for Developers only lets audited apps Direct Post, and its guidelines rule out auditing "a utility tool to help upload contents to the account(s) you or your team manages".)

**Studio scheduling.** `Marketing/tiktok/studio-scheduler/schedule.js` runs on Lewis's Mac every morning at 8, or at once from the planner's Schedule in Studio button. Both open a `salelinx-tiktok://schedule` link handled by `TikTok Studio Scheduler.app` (built by `install-launcher.sh` there), because macOS blocks a bare launchd job from `~/Documents`. It uploads each pending TikTok post due in the next 10 days into TikTok Studio's own scheduler through a signed-in Chrome, then sets the target to `processing` with `job.studio_at`. TikTok then posts it on time. `stepTikTok` skips the inbox for those and looks for the live video in `video/list` by caption, failing it 6 hours after its time if none appears. Anything the script missed goes out with the posting login when it is connected, or to the inbox when it is not. With the posting login connected, the script takes posts up to 10 days ahead before `marketing-publish` does, so those never use the API; and a run that half-finishes (the video in Studio, the target failed, as on 24 Nov 2026) is posted a second time by Retry, which clears the target's job.

## Planner

A content calendar in the style of Buffer, Later and Metricool, all on `lib/social/calendar.ts` (pure, tested in `tests/social-calendar.test.ts`).

- **Views.** Week (day columns, the default), Month and List (by day, upcoming first, earlier posts folded away). The view and a platform filter are remembered in this browser (localStorage `slx-planner`, never a cookie). Times and days are the viewer's own time zone; the calendar renders only once the browser has a clock, so it never disagrees with the server's render.
- **A post's state** comes from its platforms: draft, scheduled (nothing started), posting (some platform has started), needs you (a failure or a TikTok in the inbox, listed in the panel at the top with Retry and Copy caption) and live (every platform published). Each card's platform marks stay grey until that copy is live and are ringed red or amber when it needs a person.
- **Click** a post nobody has started on to edit it. Once a platform has started, the post can't be edited (052's save refuses it), so clicking opens a side panel instead: each platform's status, note, caption, link out, Stats link, Retry, and Copy as new post.
- **Drag** a scheduled post to another day to move it there at the same time (saved straight away, with Undo); drag a draft onto a day to open it at that day. Past days take no drops. Posts that have started can't be dragged.
- **The editor** is a two-column dialog with a phone preview. One caption is shared by every platform unless a platform is given its own ("Write one just for TikTok"); each platform tab shows its own limit. The YouTube title, visibility, tags and Instagram's Trial Reel option sit under it. "When" offers the next free slot and our usual times, which are any clock time two or more scheduled posts use (09:00, 13:00, 18:00 until there are), and lists what else is on that day. The checklist under the preview shows live what still stops it being scheduled; Post now asks for a second click instead of a browser dialog. The video's length and frame are read in the browser, so the Facebook (3 to 90 seconds, vertical) and YouTube Short (3 minutes) warnings name the actual problem. The preview's Volume slider (0 to 200%) bakes into the file: platforms fetch the stored file, so saving at anything but 100% re-encodes the sound in the browser (mediabunny, WebCodecs; the picture is copied as is) and uploads that copy as an MP4 in place of the old file.
- **Card pictures:** a live copy's platform thumbnail from `marketing_videos` (vertical platforms first), else the uploaded file itself as a paused video from a 6-hour signed link, loaded only as it scrolls into view. Storage is in the CSP's `media-src` but not `img-src`, which is why the file is shown as a video and a saved cover is fetched into a blob URL.
- **Keys:** N new post, T today, left and right arrows step a week or month.

## Stats

The overview at `/admin/marketing` leads with the **index**: a video's views at 24 hours or 7 days divided by our typical video on the same platform at the same age. 1.0x is typical, 2x twice as good. Raw views mislead three ways: older videos have had longer, each platform counts a view its own way (YouTube changed how it counts Shorts views in March 2025), and a good month lifts everything. The index cancels all three, so a TikTok and a Facebook post can sit on one chart.

- **Typical** is the median of the platform's 30 most recent videos with a number at that age, not counting the video being scored, and needs at least 3 of them. Medians throughout, so one viral post can't move it.
- **Views at an age** come from the `marketing_video_age_points` view (054): per video and age, the snapshot just before and just after it, from the hourly rows (first 8 days) and the daily rows (a finished day's row is taken as 23:00 UTC, its last sync; today's is skipped). `valueAtAge()` interpolates with the experiments' gap rule, so a video from before hourly rows existed has a 7-day number but no 24-hour one. The view returns about five rows per video, where reading the hourly rows directly would be tens of thousands.
- **Top to bottom:** a sentence for the period and every post as a dot on a line per platform; **Health**, the middle post on five measures against the period before (typical post, watched, shares, saves and subscribers per 1,000 views; saves are Instagram's and subscribers YouTube's, since the others don't report them per video); **By platform**; **Posts**, one row per planner post with its platforms side by side, or per lone video, with tags; and **Accounts** (followers, Connect, views per day) at the bottom, since totals only go up.
- The period (7, 30 or 90 days) and the age (24 hours or 7 days) are switches. Everything is worked out in the browser from what the page loads: 60 days of daily stats and every video's age points.
- Arithmetic: `lib/social/overview.ts`, tested in `tests/social-overview.test.ts`.

## Tags

What is in each video, so we can later say why one beat another.

- **Picked:** one made-with, format, opening, style and sound, up to five topics, and three flags (face on screen, words on the first frame, made with a seller). Short fixed lists plus New for our own values, stored as the labels themselves (`lib/social/tags.ts`). A planner post keeps its tags on `social_posts.tags`, covering all its platforms; a video that never went through the planner keeps its own on `marketing_videos.tags`. Both are written only by `admin_set_social_tags()`, which is audited, works at any stage, posted or not, and leaves `updated_at` alone so tagging doesn't reorder the planner.
- **Where:** the planner's editor ("What's in this video", saved straight after the post), or Stats (Add tags or Edit tags on a row, and "Tag untagged videos" to step through the rest). A post that has started posting can't be saved in the planner any more, so tag it from Stats.
- **Read automatically**, never stored: the length (the planner file's, read by the browser into `social_posts.media_seconds`, or the sync's `marketing_videos.duration_seconds`: YouTube, TikTok and Facebook give it, Instagram doesn't), the posting slot in UK time (morning 6 to 11, midday 11 to 3, afternoon 3 to 6, evening 6 to 10, late), and what the caption does: its size, a question, hashtags, a call to action (the planner caption, or the sync's `marketing_videos.caption`).
- **Automatic:** `npm run social:tag` (Lewis's Mac: needs `supabase login` and the `claude` CLI) shows Claude each untagged posted video's thumbnail, title and caption and writes the tags it picks from `lib/social/tag-lists.json` through `social_set_auto_tags()` (061, service role). Those tags carry `by: "auto"`; the script only ever rewrites auto ones, and any change in the tag editor makes them `by: "you"`. Made-with isn't guessed: a planner file named `*-remix-*` is Trend Remix. Lone copies of one video sharing a title and day are asked about once. `--dry` prints, `--limit N` caps the run (40).

## Stats pages

Stats is a dropdown in the sidebar's Social group (`children` in `lib/admin/modules.ts`). Its Overview, the page described under "Stats" above, answers "is this post better than usual"; the pages under it are the rest: totals, rates, followers, timing, how views arrive and why some posts do better. Their routes sit under `/admin/marketing/insights/` and their code under `components/admin/insights/`, the name they were built under. No new tables or migrations: every page reads the same snapshots as Stats through one loader, `lib/social/load.ts`, and the arithmetic is `lib/social/insights.ts` and `lib/social/compare.ts`, tested in `tests/social-insights.test.ts`.

| Page | Route | What it shows |
| --- | --- | --- |
| Totals | `/admin/marketing/insights` | Ten tiles (views, engagements, engagement rate, likes, comments, shares, saves, watch time, followers gained, videos posted), each against the period before with a daily sparkline; views gained per day stacked by platform; the platform split; where the period's views came from (posts made in it or older ones); the posts that gained most. |
| Posts | `/insights/posts` | Every video, one row per platform copy, with every figure we hold: lifetime counts, gained in the period, views per day, views at 1h/6h/24h/3d/7d, half-life, both index ages, every rate, watch figures, subscribers, gap since the previous post. Column sets (Overview, Early views, Engagement, Watch, Everything), any header sorts, filters for when it was posted, tag and title, and Download CSV with every column. |
| Compare | `/insights/compare` | Group posts by one of 17 things (platform, length, day, time of day, gap since the previous post, caption length, question, hashtags, call to action, opening, style, topic, sound, the three flags, planner or not) and pick one of 13 measures. Each group is a row of dots with its median, lift against every other post and a verdict; then any two groups head to head, and the clearest differences across every dimension at once. |
| Timing | `/insights/timing` | Day by time of day heatmap of the median index (UK time, cells under 3 posts greyed), the best slots, the same by day, by hour and by time since the previous post, then when we actually post and posts per week. |
| Engagement | `/insights/engagement` | Rates per platform from what the period gained, the rolling 7-day engagement rate, the mix of likes, comments, shares and saves, every post on any rate, the top five on each, and watched and average watch by platform and by length. |
| Growth | `/insights/growth` | Followers per platform with the period's change, followers over time (each platform on its own scale, since their sizes differ too much to share an axis), net followers per day, total audience, views per follower won, lifetime views over time, and YouTube subscribers by video. |
| Lifecycle | `/insights/lifecycle` | How much of a first week's views has arrived by each age, the half-life, typical views at each age, how well views at 1h, 6h, 24h and 3 days rank posts the way their first week does (Spearman), views by post age in weeks, new posts against the back catalogue, and older posts still gaining. |
| Original | `/admin/marketing/original` | The Stats page from before the Overview replaced it: a card per platform, the top three videos, what is trending, views gained per day and every video. `components/admin/marketing/OriginalDashboard.tsx`, read straight from the snapshots rather than through the loader. |

The period (7, 30 or 90 days) and platform switches in the header are shared by every one of these pages and remembered in this browser (localStorage `slx-insights`, never a cookie). Compare and Timing use every post, with their own "posted in" filter, rather than the period.

How the figures are worked out:

- **Gains.** Platforms report lifetime counts, so a period's views (and likes, comments, shares, saves, watch time, subscribers) are the sum of each video's day-on-day differences, clamped at zero since a platform sometimes recounts down. A video's first snapshot counts in full only if it went up after daily tracking began; an older video's first row holds views from before we were watching. `HISTORY_DAYS` (181) is loaded, enough for 90 days against the 90 before.
- **Coverage.** Daily tracking began on 25 Oct 2026, so a period reaching back before then is measured from the 26th, and the header says so; a comparison with a period that has no figures shows none rather than a fake change. Followers count from the first figure inside the period when there is none before it.
- **Rates need 100 views,** per post and per platform, as on Stats; that includes watched, so a 4-view video watched to the end doesn't top a list.
- **Never pool raw views across platforms.** Compare refuses a raw-views measure with All platforms selected and offers the index instead; rates and the index can pool.
- **Compare's verdict** reuses the experiments' permutation test (`permutationP`), on a log scale for views and the index: "Real difference" under p 0.05, "Leaning" under 0.2, "No clear difference" otherwise, "Too few posts" under 3 a side. Biggest differences runs every group on every dimension, so some "leaning" results are luck; the page says so. A two-value dimension is listed once, from the winning side.
- **"May be the reason."** When 80% or more of a group share something that half or fewer of the other posts do (all TikTok, all talking head), Compare names it, since then the two effects can't be told apart.
- **Half-life** interpolates between neighbouring measured ages only. A video known only at 7 days has none, rather than the 3.5 days a straight line from zero would always give. The build-up curve plots an age only when at least 3 posts have it and 7 days.

## Detailed stats

`marketing-sync` now also saves, per video per day (`052_social.sql` columns on `marketing_video_stats`):

| Column | Source |
| --- | --- |
| `reach`, `saves` | Instagram insights (`reach`, `saved`) |
| `avg_watch_seconds`, `watch_seconds` | Instagram Reels insights (milliseconds, converted); YouTube Analytics (`averageViewDuration`, `estimatedMinutesWatched`) |
| `avg_view_pct`, `subscribers_gained` | YouTube Analytics |
| `shares` for YouTube | YouTube Analytics (the public API has none, so it used to read n/a) |

YouTube Analytics needs the YouTube login and runs two or three days behind the public counts; without the login, or if it fails, the public numbers still save. TikTok's Display API has none of these.

Every sync also writes a timestamped row to `marketing_video_hourly` for each video under 8 days old. That is what the video page and experiments read for views at an age.

## Experiments

Nothing is set up by hand. For each Compare dimension except platform, source and gap, the page takes the two values with the most posts scored at 24 hours over the last 90 days and puts them head to head on the index at 24 hours (Compare's `compareTwo`, so posts tagged with both are left out). Tags come from `npm run social:tag`, so posting is all a test needs. Worked out in `lib/social/brief.ts`, tested in `tests/social-brief.test.ts`:

- **Winner** when Compare's verdict is real (p under 0.05), **leaning** under 0.2, **no clear difference** once both sides have 8 posts, otherwise **testing**. Leaning and testing say how many more posts each side needs to reach 8.
- **Lift** is the leader's median over the other's.
- The views arithmetic (same age, interpolated between snapshots, a gap too wide to trust gives no number) is in `lib/social/experiments.ts`, tested in `tests/social.test.ts`.

The manual experiments (052's `social_experiments` and `social_experiment_videos`, and 061's rule columns) are no longer read or written. A post's `experiment_id` and `variant` are always saved empty.

### Brief

The "This week" card on Experiments: last week's posts against our usual, up to three real Compare findings on the index at 24 hours over 90 days, and the three UK hours whose posts have done best (at least 3 posts each). Opening the page saves it, with the tests as `experiments`, to `social_brief` (one row, 061). The planner's editor offers those hours as green "best for views" chips, in the viewer's own time, and Trend Remix reads it before writing a script (its `REMIX-PROMPT.md`, Phase 3, using `experiments[].needs` and `working`). It is not emailed: the page and the planner are where it gets used, and an email needs a cron and a sender for one reader.

## Files

| Concern | File |
| --- | --- |
| Schema, RPCs, bucket, queue | `supabase/migrations/052_social.sql` (Facebook added to the platform checks in `053_social_facebook.sql`) |
| Tags, length, caption, age points view | `supabase/migrations/054_social_tags.sql` |
| Automatic tags, experiments, brief | `supabase/migrations/061_social_auto.sql`, `lib/social/brief.ts`, `scripts/social-tag.mjs` |
| TikTok's posting login, the public bucket | `supabase/migrations/060_social_tiktok_posting.sql`, `supabase/functions/_shared/tiktok-business.ts` |
| Index and overview arithmetic | `lib/social/overview.ts` |
| Stats pages arithmetic (gains, windows, rates, lifecycle, formatting) | `lib/social/insights.ts` |
| Compare (dimensions, measures, verdict, "may be the reason") | `lib/social/compare.ts` |
| Loader shared by the Stats pages past Overview | `lib/social/load.ts` |
| Those pages and their charts | `app/admin/marketing/insights/**`, `components/admin/insights/*` |
| Tags, automatic tags | `lib/social/tags.ts` |
| Publisher | `supabase/functions/marketing-publish/` (`index.ts` handler, `platforms.ts` per-platform steps, `plan.ts` pure decisions) |
| Shared login renewal | `supabase/functions/_shared/marketing-login.ts` |
| Logins, scopes, YouTube connect | `supabase/functions/marketing-oauth/index.ts` |
| Deeper stats, hourly rows | `supabase/functions/marketing-sync/` |
| Types (mirror `plan.ts` options by hand) | `lib/social/types.ts` |
| Experiment arithmetic | `lib/social/experiments.ts` |
| Planner limits and warnings | `lib/social/validate.ts` |
| Planner calendar arithmetic (weeks, months, states, usual times, free slots) | `lib/social/calendar.ts` |
| Loaders | `lib/social/data.ts` |
| Server actions | `app/admin/marketing/actions.ts` |
| Pages | `app/admin/marketing/{planner,experiments,videos/[platform]/[id]}/page.tsx` |
| UI | `components/admin/social/*` (planner: `Planner.tsx` shell, `PlannerViews.tsx` week/month/list, `PlannerCard.tsx`, `PostSheet.tsx`, `PostEditor.tsx` with `PostPreview.tsx`) |

## Not done yet

- Dragging to a new time within a day (the calendar moves posts between days and keeps the clock time).
- Resuming a large upload across runs; a run that times out mid-upload fails the post for a manual Retry.
- Recording which TikTok sound or Instagram audio a post used, which is often the real variable.
