"use client";

// A rough look at the post on a phone: the video full screen, the account and
// the caption over the bottom, as vertical video apps show it. Generic on
// purpose (no app's own screen copied); it is for catching a caption that is
// too long to read over the video, or a frame that crops badly.

import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import { PLATFORM_NAMES, type SocialPlatform } from "@/lib/social/types";

// How much caption shows before "more", roughly, on each app.
const CLAMP: Record<SocialPlatform, string> = {
  youtube: "line-clamp-1",
  instagram: "line-clamp-2",
  tiktok: "line-clamp-2",
  facebook: "line-clamp-2",
};

function Bubble({ d }: { d: string }) {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    </span>
  );
}

export function PostPreview({
  platforms,
  platform,
  onPlatform,
  videoUrl,
  handle,
  title,
  caption,
  onMeta,
}: {
  platforms: SocialPlatform[];
  platform: SocialPlatform | null;
  onPlatform: (p: SocialPlatform) => void;
  videoUrl: string | null;
  handle: string | null;
  title: string;
  caption: string;
  onMeta?: (video: HTMLVideoElement) => void;
}) {
  const shown =
    platform && platforms.includes(platform)
      ? platform
      : (platforms[0] ?? null);
  const text = shown === "youtube" ? title || caption : caption;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Preview
        </span>
        {platforms.length > 1 && (
          <div
            className="flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5"
            role="group"
            aria-label="Preview platform"
          >
            {platforms.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={p === shown}
                title={PLATFORM_NAMES[p]}
                onClick={() => onPlatform(p)}
                className={`rounded-md p-1 transition ${p === shown ? "bg-white shadow-sm" : "opacity-50 hover:opacity-100"}`}
              >
                <PlatformLogo platform={p} size={14} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative mx-auto aspect-[9/16] w-full max-w-[250px] overflow-hidden rounded-[26px] border-[5px] border-[#0b0b0c] bg-[#0b0b0c] shadow-xl shadow-black/20 ring-1 ring-white/10">
        {videoUrl ? (
          <video
            key={videoUrl}
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            onLoadedMetadata={(e) => onMeta?.(e.currentTarget)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-white/40">
            Your video shows here
          </div>
        )}
        {shown && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/40 px-1.5 py-1 backdrop-blur-sm">
            <PlatformLogo platform={shown} size={12} />
          </span>
        )}
        <div className="absolute bottom-16 right-2 flex flex-col gap-2.5">
          <Bubble d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
          <Bubble d="M5 18.5V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v8a1.5 1.5 0 0 1-1.5 1.5H8l-3 2.5Z" />
          <Bubble d="M13 5l6 6-6 6M19 11H9a4 4 0 0 0-4 4v3" />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-12 text-white">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="h-5 w-5 rounded-full bg-white/25" />
            {handle ? `@${handle.replace(/^@/, "")}` : "salelinx"}
          </p>
          <p
            className={`mt-1 whitespace-pre-line break-words pr-9 text-[11px] leading-snug text-white/90 ${shown ? CLAMP[shown] : "line-clamp-2"}`}
          >
            {text || <span className="text-white/40">Caption</span>}
          </p>
        </div>
      </div>
      <p className="text-center text-[11px] leading-snug text-zinc-400">
        Roughly how it looks. Each app crops the edges and cuts captions short
        in its own way.
      </p>
    </div>
  );
}
