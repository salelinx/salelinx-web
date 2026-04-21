import type { ReactNode } from 'react';

export function Figure({
  src,
  alt,
  caption,
  children,
}: {
  src?: string;
  alt?: string;
  caption?: string;
  children?: ReactNode;
}) {
  return (
    <figure className="my-6">
      <div className="overflow-hidden rounded-lg border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? ''} className="block w-full" />
        ) : (
          children
        )}
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
