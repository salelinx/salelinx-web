// Tags posted videos nobody has tagged, from Claude's read of the thumbnail, title and caption.
//
//   npm run social:tag              # up to 40 videos
//   npm run social:tag -- --dry     # print, write nothing
//   npm run social:tag -- --limit 5
//
// Needs the Supabase CLI logged in (for the service key) and the claude CLI.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import lists from '../lib/social/tag-lists.json' with { type: 'json' };

const REF = 'owaxopwpktmffqsxavsz';
const API = `https://${REF}.supabase.co`;
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 40;

const keys = JSON.parse(
  execFileSync('supabase', ['projects', 'api-keys', '--project-ref', REF, '-o', 'json'], { encoding: 'utf8' }),
);
const KEY = keys.find((k) => k.name === 'service_role')?.api_key;
if (!KEY) throw new Error('No service_role key from the Supabase CLI. Run `supabase login`.');

async function db(path, init = {}) {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw new Error(`${path.split('?')[0]}: ${res.status} ${await res.text()}`);
  return res.json();
}

const open = (tags) => !tags || !Object.keys(tags).length || tags.by === 'auto';

const [videos, posts] = await Promise.all([
  db('marketing_videos?select=platform,external_id,title,caption,thumbnail_url,duration_seconds,published_at,tags&order=published_at.desc'),
  db('social_posts?select=id,name,tags,media_seconds,media_path,targets:social_post_targets(platform,external_id,caption)'),
]);

// A planner post is tagged once for all its platforms; a lone video on its own.
const byPost = new Map();
for (const p of posts)
  for (const t of p.targets) if (t.external_id) byPost.set(`${t.platform}:${t.external_id}`, p);

// Lone copies of one video on several platforms share a title and day, so Claude sees them once.
const jobs = new Map();
for (const v of videos) {
  const post = byPost.get(`${v.platform}:${v.external_id}`);
  if (post ? !open(post.tags) : !open(v.tags)) continue;
  const id = post ? post.id : `${(v.title ?? v.external_id).toLowerCase().trim()}|${v.published_at?.slice(0, 10)}`;
  if (jobs.has(id)) jobs.get(id).copies.push(v);
  else jobs.set(id, { label: post?.name ?? v.title ?? v.external_id, post, video: v, copies: [v], tags: post?.tags ?? v.tags });
}
// Untagged first; auto-tagged ones get another go after.
const queue = [...jobs.values()].sort((a, b) => Number(!!a.tags?.by) - Number(!!b.tags?.by));

// Where a video came from can't be seen in it; Trend Remix's files are named *-remix-*.
const guessable = lists.groups.filter((g) => g.key !== 'madeWith');
const groups = guessable
  .map((g) => `- ${g.key} (${g.hint})${g.multi ? ', up to 5' : ''}: ${g.options.join(' | ')}`)
  .join('\n');
const flags = lists.flags.map((f) => `- ${f.key}: ${f.label}`).join('\n');

function clean(raw) {
  const out = {};
  for (const g of guessable) {
    const v = raw[g.key];
    if (g.multi) {
      const picked = (Array.isArray(v) ? v : []).filter((x) => g.options.includes(x)).slice(0, 5);
      if (picked.length) out[g.key] = picked;
    } else if (g.options.includes(v)) out[g.key] = v;
  }
  for (const f of lists.flags) if (typeof raw[f.key] === 'boolean') out[f.key] = raw[f.key];
  return out;
}

const dir = mkdtempSync(join(tmpdir(), 'social-tag-'));
let written = 0;
try {
  for (const job of queue.slice(0, LIMIT)) {
    const v = job.video;
    let image = '';
    if (v.thumbnail_url) {
      const res = await fetch(v.thumbnail_url).catch(() => null);
      if (res?.ok) {
        image = join(dir, `${v.platform}-${v.external_id.replace(/\W/g, '')}.jpg`);
        writeFileSync(image, Buffer.from(await res.arrayBuffer()));
      }
    }
    const prompt = `You tag short marketing videos for SaleLinx, a Chrome extension for resellers.
${image ? `Look at the thumbnail at ${image}.` : 'There is no thumbnail.'}
Title: ${job.label}
Caption: ${(job.post?.targets.find((t) => t.caption)?.caption ?? v.caption ?? '').slice(0, 1500)}
Length: ${job.post?.media_seconds ?? v.duration_seconds ?? 'unknown'} seconds

Pick from these lists only, leaving out any you cannot tell:
${groups}
Yes/no, only if you can tell:
${flags}

Reply with one JSON object and nothing else, e.g. {"format":"POV","topics":["Vinted"],"face":false}.`;
    let tags;
    try {
      const reply = execFileSync('claude', ['-p', prompt, '--allowedTools', 'Read'], {
        encoding: 'utf8',
        timeout: 180_000,
      });
      tags = clean(JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1)));
      if (/-remix-/.test(job.post?.media_path ?? '')) tags.madeWith = 'Trend Remix';
    } catch (e) {
      console.log(`skip  ${job.label}: ${e.message.split('\n')[0]}`);
      continue;
    }
    if (!Object.keys(tags).length) continue;
    console.log(`${DRY ? 'would' : 'tag '}  ${job.label}: ${JSON.stringify(tags)}`);
    if (DRY) continue;
    for (const c of job.post ? [null] : job.copies) {
      const res = await db('rpc/social_set_auto_tags', {
        method: 'POST',
        body: JSON.stringify({
          p_post_id: job.post?.id ?? null,
          p_platform: c?.platform ?? null,
          p_external_id: c?.external_id ?? null,
          p_tags: tags,
        }),
      });
      if (res.written) written++;
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`${written} written, ${Math.max(0, queue.length - LIMIT)} left for next time.`);
