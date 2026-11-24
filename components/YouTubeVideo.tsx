'use client';

import { useState } from 'react';

// Nothing loads from YouTube until the click: the iframe alone pulls in about a megabyte of script.
export function YouTubeVideo({
  id,
  label,
  className,
  poster = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
}: { id: string; label: string; className: string; poster?: string }) {
  const [playing, setPlaying] = useState(false);

  return playing ? (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1&cc_load_policy=0`}
      title={label}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      className={`aspect-video w-full ${className}`}
    />
  ) : (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={label}
      className={`group grid aspect-video w-full place-items-center bg-cover bg-center ${className}`}
      style={{ backgroundImage: `url(${poster})` }}
    >
      <span className="grid h-16 w-16 place-items-center rounded-full bg-black/70 text-white transition group-hover:bg-black">
        <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>
    </button>
  );
}
