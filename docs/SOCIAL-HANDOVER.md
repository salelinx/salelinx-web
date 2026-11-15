# Social work: handover (temporary)

**Delete this file before PR #296 merges.** It is a working note for carrying on from another machine; the lasting documentation is `docs/SOCIAL.md`.

Written 15 Nov 2026. The work itself happened on 13 Nov 2026.

## Where things are

- **Branch:** `feat/social-media-admin`, **draft PR #296**. The branch is level with `main` as of 13 Nov (it includes Lewis's dark theme, #295).
- **What it is:** the admin Social group (Stats, Planner, Experiments, video pages) for SaleLinx's YouTube, Instagram, TikTok and Facebook Page, plus a Light / Dark / System theme switch. How it works: `docs/SOCIAL.md`.

## Carry on from another machine

```sh
git fetch origin
git checkout feat/social-media-admin
npm install                 # also turns on the commit hooks
# copy .env.local from the desktop (it is git-ignored, never commit it)
npm run dev                 # then sign in, MFA, and open http://localhost:3000/admin/marketing
```

- **Supabase CLI:** `npx supabase login` once, then add `--project-ref owaxopwpktmffqsxavsz` to commands. Never `supabase db push` (see `supabase/migrations/README.md`).
- **Pushing:** run `gh auth switch -u mattval1 && gh auth setup-git` right before every push; `mvaletsky` has no access to the org.
- **Tests on Windows:** `tests/blog-content.test.ts` fails locally because of CRLF line endings. That is unrelated to this work; everything else passes.

## What is already live

- **Migrations** `052_social.sql` and `053_social_facebook.sql` are applied.
- **Edge Functions** `marketing-oauth`, `marketing-sync` and `marketing-publish` are deployed **from this branch**. After changing any of them, redeploy with `npx supabase functions deploy <name> --no-verify-jwt --project-ref owaxopwpktmffqsxavsz`. Nobody should redeploy them from `main` before this merges.
- **All four platforms are connected** as of 13 Nov.

### Accounts and apps (no secrets here; they are in Supabase)

| Platform | Where it lives | Notes |
| --- | --- | --- |
| YouTube | New Google Cloud project with an OAuth client (consent screen In production) and a new API key | The old API key's project belongs to an account we cannot open |
| Instagram and Facebook | New Meta app "SaleLinx Marketing" (id 2456030948492724) | Facebook Login for Business configuration with a **system-user token**, Page and Instagram assets marked required, 12 permissions. Instagram is reached through the SaleLinx Page, because Meta gives new apps no Instagram Login |
| TikTok | New TikTok app "Salelinx Marketing" (id 7707707236755228693), **Sandbox** | Login Kit and Content Posting API (Direct Post off); the SaleLinx account is a sandbox target user. Production was never submitted for review |

**Secrets in use:** `YOUTUBE_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_LOGIN_CONFIG_ID`, `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` (the sandbox's), `MARKETING_SECRET`, `SITE_URL`. `FACEBOOK_PAGE_ID` is optional and unset. `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` are no longer read and can be removed.

## Still to do

1. **Cron job, not confirmed:** `marketing-publish` every 5 minutes (copy of the `marketing-sync` job; SQL in `docs/SOCIAL.md` setup step 9). Without it, scheduled posts only go out on Check now or Post now.
2. **Storage upload limit, not confirmed:** Dashboard > Storage > Settings, 1 GB (default 50 MB).
3. **A real test post per platform; none has been made yet:**
   - YouTube: unlisted first; check a public upload does not come back private (that would mean Google's API audit).
   - Instagram: a Trial Reel.
   - Facebook: a vertical Reel of 3 to 90 seconds.
   - TikTok: check the inbox upload can be posted **publicly** from the app with a sandbox app. If it is forced private, the options are TikTok's review (likely refused) or a paid posting service.
4. **Before merging:**
   - Tell Lewis the three functions run from this branch, and that his old Meta, TikTok and Google apps no longer power anything.
   - Delete this file.
   - Mark the PR ready.

## Decisions already made

- **Same repo, not a separate one:** reuses admin auth, MFA, the audit log and the stored logins.
- **TikTok uses the inbox, not Direct Post:** TikTok's guidelines rule out audited posting for tools that post to your own accounts. TikTok sounds are added in the app at that step; the posting API takes no sound.
- **Meta login uses a system-user token:** it belongs to the business, not a person. The configuration made from the Instagram "Unified login" page lacked the Page permissions, which is why it first failed with `page_ids=0`.
- **Extra Meta permissions kept on purpose:** DMs, comments and ads, for later. Nothing reads them; CLAUDE.md says what any feature that does must add to `docs/GDPR.md`.
- **X / Twitter skipped:** its API is pay-per-use since February 2026, and reading stats would cost real money.
- **Theme:** dark stays the default from #295; the switch adds Light and System.

## Ideas offered, not started

- A sidebar alert (and optional email) when a post fails or waits in the TikTok inbox.
- A separate video file per platform, plus a Sound field for TikTok.
- A calendar view of the schedule.
- Resuming large uploads across publisher runs.
