"use client";

// A miniature of the extension, to see a message where users will: the panel
// with the banner under its page header, the popup over the panel, the card
// above the launcher on a marketplace page, or the login screen that people
// signed out see. Drawn at the extension's own
// sizes with its panel colours, dark or light (salelinx-app
// src/panel/css/base.css and announcements.css), so it does not follow the
// console's theme. Admin text is only ever rendered as React text.

import { useState, type CSSProperties } from "react";
import {
  ANNOUNCEMENT_BUTTONS_MAX,
  ANNOUNCEMENT_LOCALES,
  ANNOUNCEMENT_THEME_COLOR,
  localizedAnnouncementText,
  type AnnouncementIcon,
  type AnnouncementLocale,
  type AnnouncementPlacement,
  type AnnouncementPriority,
  type AnnouncementTextInput,
  type AnnouncementTheme,
} from "@/lib/announcements/types";
import { Glyph, KICKER, PLACE_SHORT, Segmented, alpha, hasGlyph } from "./parts";

export type PreviewPlace = "banner" | "popup" | "launcher" | "login";
const PREVIEW_PLACES: readonly PreviewPlace[] = ["banner", "popup", "launcher", "login"];

// The panel's main button (--primary-strong and --primary-fg in base.css).
const PRIMARY: Record<PanelTheme, { bg: string; fg: string }> = {
  dark: { bg: "#10b981", fg: "#052e1c" },
  light: { bg: "#047857", fg: "#ffffff" },
};

// What the preview needs of the editor's form.
export type PreviewMessage = {
  theme: AnnouncementTheme;
  icon: AnnouncementIcon;
  emoji: string;
  priority: AnnouncementPriority;
  title: AnnouncementTextInput;
  body: AnnouncementTextInput;
  // Each button's label.
  buttons: AnnouncementTextInput[];
  hasImage: boolean;
  // Null while a stored image loads.
  imageSrc: string | null;
  // "Always" has no close button.
  closable: boolean;
  placements: AnnouncementPlacement[];
};

type PanelTheme = "dark" | "light";

// The extension's accents on its dark panel; the light panel (and a launcher
// card on a light page) uses the strong colours the console lists.
const DARK_ACCENT: Record<AnnouncementTheme, string> = {
  blue: "#5b9bff",
  green: "#34c48b",
  purple: "#a78bfa",
  amber: "#f59e0b",
  red: "#ef4444",
  grey: "#a1a1aa",
};

type Palette = {
  canvas: string;
  side: string;
  surface: string;
  border: string;
  text: string;
  secondary: string;
  muted: string;
  skeleton: string;
  tile: string;
  tileInk: string;
};

const PANEL: Record<PanelTheme, Palette> = {
  dark: {
    canvas: "#09090b",
    side: "#111114",
    surface: "#18181b",
    border: "rgba(255, 255, 255, 0.1)",
    text: "#fafafa",
    secondary: "#d4d4d8",
    muted: "#71717a",
    skeleton: "rgba(255, 255, 255, 0.07)",
    tile: "#171717",
    tileInk: "#faf8f3",
  },
  light: {
    canvas: "#ffffff",
    side: "#fafafa",
    surface: "#ffffff",
    border: "rgba(0, 0, 0, 0.1)",
    text: "#18181b",
    secondary: "#3f3f46",
    muted: "#71717a",
    skeleton: "rgba(0, 0, 0, 0.06)",
    tile: "#faf8f3",
    tileInk: "#171717",
  },
};

const FONT: CSSProperties = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// The words, in the chosen language with the extension's English fallback.
type Words = { title: string; body: string; buttons: string[] };

export function Preview({
  message,
  locale,
  onLocale,
}: {
  message: PreviewMessage;
  locale: AnnouncementLocale;
  onLocale: (locale: AnnouncementLocale) => void;
}) {
  const [place, setPlace] = useState<PreviewPlace>("banner");
  const [theme, setTheme] = useState<PanelTheme>("dark");
  const ticked = PREVIEW_PLACES.filter((p) => message.placements.includes(p));
  const shown: PreviewPlace | undefined = ticked.includes(place) ? place : ticked[0];
  const accent =
    theme === "dark" ? DARK_ACCENT[message.theme] : ANNOUNCEMENT_THEME_COLOR[message.theme];
  const words: Words = {
    title: localizedAnnouncementText(message.title, locale),
    body: localizedAnnouncementText(message.body, locale),
    // A button with no label is dropped on save, so it is not drawn.
    buttons: message.buttons
      .map((label) => localizedAnnouncementText(label, locale))
      .filter(Boolean)
      .slice(0, ANNOUNCEMENT_BUTTONS_MAX),
  };
  const c = PANEL[theme];

  return (
    <div>
      <div role="group" aria-label="Place to preview" className="mb-2.5 flex flex-wrap gap-1">
        {PREVIEW_PLACES.map((p) => {
          const can = ticked.includes(p);
          const on = shown === p;
          return (
            <button
              key={p}
              type="button"
              disabled={!can}
              aria-pressed={on}
              title={can ? undefined : "Not ticked under Where it shows"}
              onClick={() => setPlace(p)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                on
                  ? "bg-zinc-900 font-medium text-white"
                  : can
                    ? "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    : "cursor-not-allowed text-zinc-400"
              }`}
            >
              {PLACE_SHORT[p]}
            </button>
          );
        })}
      </div>

      <div
        className="relative overflow-hidden rounded-xl border border-[var(--admin-border)] shadow-sm"
        style={{ ...FONT, backgroundColor: "#f4f4f5" }}
      >
        <MarketplacePage tiles={shown === "launcher" || shown === undefined} />
        {shown === undefined ? (
          <div className="relative flex min-h-[440px] items-center justify-center bg-[#ffffffbf] p-6 text-center text-xs text-[#52525b]">
            Tick at least one place under Where it shows to see it here.
          </div>
        ) : shown === "launcher" ? (
          <LauncherScene m={message} w={words} accent={accent} c={c} />
        ) : shown === "login" ? (
          <LoginScene m={message} w={words} accent={accent} c={c} primary={PRIMARY[theme]} />
        ) : (
          <PanelScene m={message} w={words} accent={accent} c={c} popup={shown === "popup"} />
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <Segmented
          name="announcement-preview-locale"
          label="Preview language"
          value={locale}
          onChange={onLocale}
          options={ANNOUNCEMENT_LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))}
        />
        <Segmented
          name="announcement-preview-theme"
          label="Panel theme"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "dark", label: "Dark panel" },
            { value: "light", label: "Light panel" },
          ]}
        />
      </div>
    </div>
  );
}

// The marketplace page behind it all: a header, a search bar and, where the
// page shows, item tiles. Fixed light colours (marketplaces are light sites),
// so not the console's mirrored zinc.
function MarketplacePage({ tiles }: { tiles: boolean }) {
  const block = "rounded bg-[#e4e4e7]";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      <div className="flex h-9 items-center gap-3 border-b border-[#e4e4e7] bg-[#ffffff] px-3">
        <span className="h-3 w-12 rounded bg-[#d4d4d8]" />
        <span className="h-4 flex-1 rounded-full bg-[#f4f4f5]" />
        <span className="h-3 w-8 rounded bg-[#f4f4f5]" />
      </div>
      <div className={`grid grid-cols-4 gap-2.5 p-3 ${tiles ? "" : "hidden"}`}>
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i}>
            <div className={`aspect-[4/5] ${block}`} />
            <div className={`mt-1.5 h-1.5 w-3/4 ${block}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// The panel window over the page: its nav on the left, the page header, the
// banner under it, the page itself, and the popup over everything.
function PanelScene({
  m,
  w,
  accent,
  c,
  popup,
}: {
  m: PreviewMessage;
  w: Words;
  accent: string;
  c: Palette;
  popup: boolean;
}) {
  const bar = (width: string, height = 6): CSSProperties => ({
    width,
    height,
    borderRadius: 3,
    backgroundColor: c.skeleton,
  });
  return (
    <div className="relative px-3 pb-3 pt-12">
      <div
        className="grid min-h-[400px] overflow-hidden rounded-[10px] shadow-xl"
        style={{ backgroundColor: c.canvas, border: `1px solid ${c.border}` }}
      >
        <div className="flex min-h-0 [grid-area:1/1]">
          <div
            aria-hidden="true"
            className="flex w-10 shrink-0 flex-col items-center gap-2.5 pt-3"
            style={{ backgroundColor: c.side, borderRight: `1px solid ${c.border}` }}
          >
            <span className="h-5 w-5 rounded-md" style={{ backgroundColor: c.text, opacity: 0.9 }} />
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="h-4 w-4 rounded"
                style={{ backgroundColor: i === 0 ? c.border : c.skeleton }}
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="flex h-10 items-center justify-between px-4"
              style={{ borderBottom: `1px solid ${c.border}` }}
            >
              <span style={{ color: c.text, fontSize: 13, fontWeight: 600 }}>My Listings</span>
              <span aria-hidden="true" className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-4 w-4 rounded-full" style={{ backgroundColor: c.skeleton }} />
                ))}
              </span>
            </div>
            {!popup && (
              <div className="px-4 pt-3">
                <Banner m={m} w={w} accent={accent} c={c} />
              </div>
            )}
            <div aria-hidden="true" className="space-y-3 px-4 pt-4">
              <div className="flex gap-2">
                <span style={bar("72px", 14)} />
                <span style={bar("56px", 14)} />
                <span style={bar("40px", 14)} />
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="h-7 w-7 shrink-0 rounded" style={{ backgroundColor: c.skeleton }} />
                  <span className="flex-1 space-y-1.5">
                    <span className="block" style={bar(`${70 - i * 9}%`)} />
                    <span className="block" style={bar(`${38 + i * 5}%`, 5)} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {popup && (
          <div
            className="flex items-center justify-center p-3 [grid-area:1/1]"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          >
            <Popup m={m} w={w} accent={accent} c={c} />
          </div>
        )}
      </div>
    </div>
  );
}

// The login screen, which covers the panel while signed out: the brand, the
// banner above the sign-in form, and the form itself (login-screen.ts and
// login.css in the extension).
function LoginScene({
  m,
  w,
  accent,
  c,
  primary,
}: {
  m: PreviewMessage;
  w: Words;
  accent: string;
  c: Palette;
  primary: { bg: string; fg: string };
}) {
  const field: CSSProperties = {
    height: 32,
    borderRadius: 8,
    border: `1px solid ${c.border}`,
    backgroundColor: c.canvas,
  };
  const label: CSSProperties = { fontSize: 11, fontWeight: 500, color: c.secondary, marginBottom: 5 };
  return (
    <div className="relative px-3 pb-3 pt-12">
      <div
        className="flex min-h-[400px] items-center justify-center overflow-hidden rounded-[10px] p-4 shadow-xl"
        style={{ backgroundColor: c.canvas, border: `1px solid ${c.border}` }}
      >
        <div
          className="w-full max-w-[300px] space-y-3.5 rounded-xl px-6 pb-6 pt-7"
          style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}
        >
          <div aria-hidden="true" className="flex items-center justify-center gap-2">
            <span className="h-6 w-6 rounded-md" style={{ backgroundColor: c.text, opacity: 0.9 }} />
            <span style={{ color: c.text, fontSize: 18, fontWeight: 700 }}>SaleLinx</span>
          </div>
          <Banner m={m} w={w} accent={accent} c={c} />
          <div aria-hidden="true" className="space-y-3">
            <div>
              <div style={label}>Email</div>
              <div style={field} />
            </div>
            <div>
              <div style={label}>Password</div>
              <div style={field} />
            </div>
            <div
              className="flex items-center justify-center"
              style={{
                height: 36,
                borderRadius: 8,
                backgroundColor: primary.bg,
                color: primary.fg,
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              Log In
            </div>
            <div className="text-center" style={{ fontSize: 11, color: c.muted }}>
              Don&apos;t have an account? <span style={{ color: primary.bg }}>Sign up</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// The page without the panel: the launcher tile bottom left, the card above it.
function LauncherScene({
  m,
  w,
  accent,
  c,
}: {
  m: PreviewMessage;
  w: Words;
  accent: string;
  c: Palette;
}) {
  return (
    <div className="relative flex min-h-[452px] flex-col justify-end gap-2.5 p-3.5">
      <LauncherCard m={m} w={w} accent={accent} c={c} />
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg"
        style={{ backgroundColor: c.tile, color: c.tileInk, border: `1px solid ${c.border}` }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M9 15 15 9" />
          <path d="M11 6.5 13 4.5a4.2 4.2 0 0 1 6 6l-2 2" />
          <path d="m13 17.5-2 2a4.2 4.2 0 0 1-6-6l2-2" />
        </svg>
      </span>
    </div>
  );
}

function Placeholder({ text, value }: { text: string; value: string }) {
  return value ? <>{value}</> : <span style={{ opacity: 0.4 }}>{text}</span>;
}

function PreviewImage({ m, style }: { m: PreviewMessage; style: CSSProperties }) {
  if (!m.hasImage) return null;
  if (!m.imageSrc) {
    return (
      <div
        style={{ ...style, height: 80, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(127,127,127,0.15)", fontSize: 11, opacity: 0.7 }}
      >
        Image
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a blob URL of the picked or stored file; next/image adds nothing here
    <img src={m.imageSrc} alt="" style={{ ...style, display: "block", width: "100%", objectFit: "cover" }} />
  );
}

function MessageButton({
  label,
  accent,
  main,
  c,
  big = false,
}: {
  label: string;
  accent: string;
  main: boolean;
  c: Palette;
  big?: boolean;
}) {
  return (
    <span
      className="inline-block max-w-[180px] truncate"
      style={{
        padding: big ? "8px 16px" : "6px 14px",
        borderRadius: 8,
        border: `1px solid ${main ? accent : alpha(accent, 0.45)}`,
        backgroundColor: main ? accent : c.surface,
        color: main ? "#ffffff" : accent,
        fontSize: big ? 13 : 12,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function Banner({ m, w, accent, c }: { m: PreviewMessage; w: Words; accent: string; c: Palette }) {
  const dark = c === PANEL.dark;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 8,
        border: `1px solid ${alpha(accent, 0.45)}`,
        background: dark
          ? `linear-gradient(180deg, ${alpha(accent, 0.11)} 0%, ${alpha(accent, 0.04)} 100%)`
          : alpha(accent, 0.04),
        color: c.text,
      }}
    >
      {hasGlyph(m.icon, m.emoji) && (
        <span style={{ color: accent, marginTop: 1 }}>
          <Glyph icon={m.icon} emoji={m.emoji} size={18} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <PreviewImage m={m} style={{ maxHeight: 140, borderRadius: 6, marginBottom: 10 }} />
        <div className="break-words" style={{ fontSize: 13, fontWeight: 600 }}>
          <Placeholder text="Title" value={w.title} />
        </div>
        <div
          className="break-words"
          style={{ marginTop: 2, fontSize: 12.5, lineHeight: 1.45, color: c.secondary, whiteSpace: "pre-line" }}
        >
          <Placeholder text="Your message" value={w.body} />
        </div>
        {w.buttons.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {w.buttons.map((b, i) => (
              <MessageButton key={i} label={b} accent={accent} main={i === 0} c={c} />
            ))}
          </div>
        )}
      </div>
      {m.closable && (
        <span aria-hidden="true" style={{ color: c.muted, fontSize: 20, lineHeight: 1, marginTop: -3 }}>
          {"×"}
        </span>
      )}
    </div>
  );
}

function Kicker({ m, accent, size }: { m: PreviewMessage; accent: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size > 10 ? 8 : 5,
        color: accent,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {hasGlyph(m.icon, m.emoji) && <Glyph icon={m.icon} emoji={m.emoji} size={size + 4} />}
      {KICKER[m.priority]}
    </div>
  );
}

function Popup({ m, w, accent, c }: { m: PreviewMessage; w: Words; accent: string; c: Palette }) {
  return (
    <div
      style={{
        width: "min(380px, 100%)",
        padding: "22px 24px 18px",
        borderTop: `4px solid ${accent}`,
        borderRadius: 16,
        backgroundColor: c.surface,
        color: c.text,
        boxShadow: "0 24px 48px -12px rgba(0,0,0,0.45)",
      }}
    >
      <Kicker m={m} accent={accent} size={11} />
      <PreviewImage m={m} style={{ maxHeight: 180, borderRadius: 12, marginTop: 14 }} />
      <div className="break-words" style={{ margin: "10px 0 8px", fontSize: 16, fontWeight: 650, lineHeight: 1.3 }}>
        <Placeholder text="Title" value={w.title} />
      </div>
      <div
        className="break-words"
        style={{ fontSize: 13, lineHeight: 1.55, color: c.secondary, whiteSpace: "pre-line", maxHeight: 180, overflow: "hidden" }}
      >
        <Placeholder text="Your message" value={w.body} />
      </div>
      <div
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 20 }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10 }}>
          {w.buttons.map((b, i) => (
            <MessageButton key={i} label={b} accent={accent} main={i === 0} c={c} big />
          ))}
        </div>
        <span
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            backgroundColor: "#52525b",
            color: "#fafafa",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Got it
        </span>
      </div>
    </div>
  );
}

function LauncherCard({ m, w, accent, c }: { m: PreviewMessage; w: Words; accent: string; c: Palette }) {
  return (
    <div
      className="relative"
      style={{
        width: "min(290px, 100%)",
        padding: "11px 34px 12px 14px",
        borderRadius: 14,
        borderLeft: `3px solid ${accent}`,
        backgroundColor: c.tile,
        color: c.tileInk,
        boxShadow: "0 6px 14px -4px rgba(0,0,0,0.28), 0 14px 32px -10px rgba(0,0,0,0.22)",
      }}
    >
      <Kicker m={m} accent={accent} size={10} />
      <div className="break-words" style={{ marginTop: 3, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
        <Placeholder text="Title" value={w.title} />
      </div>
      <div
        className="line-clamp-3 break-words"
        style={{ marginTop: 3, fontSize: 12, lineHeight: 1.4, opacity: 0.75, whiteSpace: "pre-line" }}
      >
        <Placeholder text="Your message" value={w.body} />
      </div>
      {m.closable && (
        <span
          aria-hidden="true"
          style={{ position: "absolute", top: 6, right: 10, fontSize: 18, lineHeight: 1, opacity: 0.55 }}
        >
          {"×"}
        </span>
      )}
    </div>
  );
}
