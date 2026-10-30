import { Link } from '@/i18n/navigation';
import { categoryTitle, formatPostDate } from '@/lib/blog/posts';
import type { PostMetadata } from '@/lib/blog/types';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export function PostCard({ post, headingLevel = 'h2' }: { post: PostMetadata; headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-black/10 bg-white transition hover:border-black/30 dark:border-white/15 dark:bg-zinc-950 dark:hover:border-white/40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/blog/covers/${post.slug}.svg`}
        alt=""
        width={640}
        height={360}
        loading="lazy"
        className="aspect-[16/9] w-full border-b border-black/10 object-cover dark:border-white/15"
      />
      <div className="flex flex-1 flex-col p-6">
        <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>
          {categoryTitle(post.category)}
        </span>
        <Heading className="mt-3 text-lg font-semibold leading-snug tracking-tight text-balance">
          {post.title}
        </Heading>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {post.description}
        </p>
        <span className={`${MONO} mt-5 text-zinc-500 dark:text-zinc-500`}>
          {formatPostDate(post.published)} &middot; {post.readingMinutes} min read
        </span>
      </div>
    </Link>
  );
}
