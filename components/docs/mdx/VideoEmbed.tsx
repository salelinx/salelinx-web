'use client';

export function VideoEmbed({
  src,
  poster,
  caption,
}: {
  src: string;
  poster?: string;
  caption?: string;
}) {
  return (
    <figure className="my-6">
      <div className="overflow-hidden rounded-lg border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
        <video
          src={src}
          poster={poster}
          className="block w-full"
          controls
          playsInline
          preload="metadata"
        />
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
