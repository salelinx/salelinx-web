import { SOCIALS } from "@/components/home/SocialLinks";

// Signup sources (lib/signup-source.ts) as the console shows them: a brand
// mark where we have one, a tidied label otherwise. Shared by the Users roster
// and the Funnel page so a source reads the same in both. No hooks, so it
// renders in server and client components alike.

const socialPath = (name: string) => SOCIALS.find((s) => s.name === name)!.path;

// Brand marks for signup sources; anything else falls back to its label.
const SOURCE_ICONS: Record<string, { path: string; color: string; name: string }> = {
  google: {
    name: "Google",
    color: "text-[#4285F4]",
    path: "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
  },
  facebook: {
    name: "Facebook",
    color: "text-[#0866FF]",
    path: "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  },
  x: {
    name: "X",
    color: "text-zinc-950",
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
  tiktok: { name: "TikTok", color: "text-zinc-950", path: socialPath("TikTok") },
  youtube: { name: "YouTube", color: "text-[#FF0000]", path: socialPath("YouTube") },
  instagram: { name: "Instagram", color: "text-[#FF0069]", path: socialPath("Instagram") },
  chrome_web_store: {
    name: "Chrome Web Store",
    color: "text-[#4285F4]",
    path: "M0 1.637v19.09c0 .9.736 1.636 1.636 1.636h.131a10.4 10.4 0 0 1-.13-1.636 10.3 10.3 0 0 1 1.667-5.64l4.202 7.276h1.128A3.77 3.77 0 0 1 12 16.958a3.77 3.77 0 0 1 3.366 5.406h1.048a4.7 4.7 0 0 0-1.587-5.406h6.83a10.34 10.34 0 0 1 .577 5.406h.13c.9 0 1.636-.737 1.636-1.637V1.637Zm9.273 2.181h5.454a1.09 1.09 0 1 1 0 2.182H9.273a1.09 1.09 0 1 1 0-2.182M12 10.364a10.36 10.36 0 0 1 9.233 5.652H12a4.71 4.71 0 0 0-4.677 4.149L3.91 14.25A10.34 10.34 0 0 1 12 10.364",
  },
  yahoo: {
    name: "Yahoo",
    color: "text-[#6001D2]",
    path: "M18.86 1.56L14.27 11.87H19.4L24 1.56H18.86M0 6.71L5.15 18.27L3.3 22.44H7.83L14.69 6.71H10.19L7.39 13.44L4.62 6.71H0M15.62 12.87C13.95 12.87 12.71 14.12 12.71 15.58C12.71 17 13.91 18.19 15.5 18.19C17.18 18.19 18.43 16.96 18.43 15.5C18.43 14.03 17.23 12.87 15.62 12.87Z",
  },
};
// Other spellings of the same source, as recorded in user metadata: Instagram
// tags its own in-app links utm_source=ig, and signups before signup-source.ts
// mapped Yahoo kept the raw host. Anything that counts or filters by source
// goes through canonicalSource(), or one source shows up as two rows.
const SOURCE_ALIASES: Record<string, string> = {
  ig: "instagram",
  "search.yahoo.com": "yahoo",
};

export function canonicalSource(source: string): string {
  return SOURCE_ALIASES[source] ?? source;
}

for (const [alias, source] of Object.entries(SOURCE_ALIASES))
  SOURCE_ICONS[alias] = SOURCE_ICONS[source];
SOURCE_ICONS.meta = { ...SOURCE_ICONS.facebook, name: "Meta" };
SOURCE_ICONS["chatgpt.com"] = {
  name: "ChatGPT",
  color: "text-zinc-950",
  path: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z",
};

// "google_ads" -> the Google mark plus "Ads"; utm values are free text, so
// unknown ones are just tidied up.
function sourceParts(source: string) {
  const ads = source.endsWith("_ads");
  const icon = SOURCE_ICONS[ads ? source.slice(0, -4) : source];
  return { icon, ads };
}

export function sourceLabel(source: string) {
  const { icon, ads } = sourceParts(source);
  if (icon) return ads ? `${icon.name} Ads` : icon.name;
  if (source === "social") return "Social media";
  const words = source.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Phone signups with no referrer, set by hand: in-app browsers hide which app it was.
const SOURCE_GROUPS: Record<string, string[]> = { social: ["instagram", "tiktok", "youtube"] };

export function SourceCell({ source }: { source: string }) {
  const { icon, ads } = sourceParts(source);
  const icons = SOURCE_GROUPS[source]?.map((s) => SOURCE_ICONS[s]) ?? (icon ? [icon] : []);
  if (!icons.length) return <>{sourceLabel(source)}</>;
  return (
    <span className="inline-flex items-center gap-1.5" title={sourceLabel(source)}>
      {icons.map((i) => (
        <svg key={i.name} viewBox="0 0 24 24" className={`h-4 w-4 fill-current ${i.color}`} aria-label={i.name}>
          <path d={i.path} />
        </svg>
      ))}
      {ads && <span className="text-xs text-zinc-500">Ads</span>}
    </span>
  );
}

// Brand marks and the full label side by side, where there is room for both.
export function SourceName({ source }: { source: string }) {
  const { icon } = sourceParts(source);
  const icons = SOURCE_GROUPS[source]?.map((s) => SOURCE_ICONS[s]) ?? (icon ? [icon] : []);
  return (
    <span className="inline-flex items-center gap-1.5">
      {icons.map((i) => (
        <svg key={i.name} viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 fill-current ${i.color}`} aria-hidden>
          <path d={i.path} />
        </svg>
      ))}
      {sourceLabel(source)}
    </span>
  );
}
