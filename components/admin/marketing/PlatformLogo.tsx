import type { MarketingPlatform } from "@/lib/admin/marketing";

// Each platform's mark and colours, for the Marketing page. Inline SVG, so
// nothing loads from the platforms and the CSP needs no extra entry.

export const PLATFORM_THEME: Record<
  MarketingPlatform,
  { name: string; accent: string; tint: string; bar: string }
> = {
  youtube: {
    name: "YouTube",
    accent: "#FF0033",
    tint: "rgba(255, 0, 51, 0.06)",
    bar: "#FF0033",
  },
  instagram: {
    name: "Instagram",
    accent: "#D62976",
    tint: "rgba(214, 41, 118, 0.06)",
    bar: "linear-gradient(90deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)",
  },
  tiktok: {
    name: "TikTok",
    accent: "#FE2C55",
    tint: "rgba(37, 244, 238, 0.07)",
    bar: "linear-gradient(90deg, #25F4EE, #000000, #FE2C55)",
  },
};

export function PlatformLogo({
  platform,
  size = 20,
}: {
  platform: MarketingPlatform;
  size?: number;
}) {
  if (platform === "youtube") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-label="YouTube"
        role="img"
      >
        <path
          fill="#FF0033"
          d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
        />
        <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  if (platform === "instagram") {
    const id = `ig-${size}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-label="Instagram"
        role="img"
      >
        <defs>
          <radialGradient id={id} cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#FDF497" />
            <stop offset="5%" stopColor="#FDF497" />
            <stop offset="45%" stopColor="#FD5949" />
            <stop offset="60%" stopColor="#D6249F" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect x="1" y="1" width="22" height="22" rx="6" fill={`url(#${id})`} />
        <rect
          x="5.5"
          y="5.5"
          width="13"
          height="13"
          rx="4"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.8"
        />
        <circle
          cx="12"
          cy="12"
          r="3.2"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.8"
        />
        <circle cx="16.2" cy="7.8" r="1" fill="#FFFFFF" />
      </svg>
    );
  }
  const note =
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-label="TikTok"
      role="img"
    >
      <rect width="24" height="24" rx="6" fill="#000000" />
      <g transform="translate(4.2 4) scale(0.65)">
        <path fill="#25F4EE" transform="translate(-0.9 -0.9)" d={note} />
        <path fill="#FE2C55" transform="translate(0.9 0.9)" d={note} />
        <path fill="#FFFFFF" d={note} />
      </g>
    </svg>
  );
}
