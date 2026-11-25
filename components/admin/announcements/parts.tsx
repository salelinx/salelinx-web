"use client";

// Small pieces the announcements console shares between its list, its editor
// and its preview: the message's glyph, the little diagrams of where a
// message shows, a few line icons the planner's set does not have, and the
// chip, segmented and section controls as this page draws them.
//
// Colours are the console's zinc utilities (mirrored for the dark console in
// app/admin/admin.css), so everything here follows the admin's theme. The one
// exception is a message's own colour, which is passed in as a hex value.

import type { ReactNode } from "react";
import {
  ANNOUNCEMENT_ERROR_MESSAGE,
  ANNOUNCEMENT_ICON_SVG,
  trimText,
  type AnnouncementIcon,
  type AnnouncementPlacement,
  type AnnouncementPriority,
} from "@/lib/announcements/types";

// Short names for the places, for the list rows and the preview switch.
export const PLACE_SHORT: Record<AnnouncementPlacement, string> = {
  banner: "Banner",
  popup: "Popup",
  launcher: "Launcher card",
  badge: "Badge",
  toolbar: "Toolbar popup",
};

// The small heading the popup and the launcher card start with. The extension
// writes it in the user's language; the preview shows the English.
export const KICKER: Record<AnnouncementPriority, string> = {
  normal: "Notice",
  high: "Heads up",
  urgent: "Important",
};

export function errorText(code: string | undefined): string {
  if (!code) return "Something went wrong.";
  if (code === "not authorized") {
    return "This session is not allowed to change announcements. Sign in again with your authenticator code.";
  }
  return ANNOUNCEMENT_ERROR_MESSAGE[code] ?? code;
}

// "a, b and c".
export function listSentence(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// A hex colour with an alpha, e.g. a border at 45%.
export function alpha(hex: string, amount: number): string {
  return `${hex}${Math.round(amount * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

export function hasGlyph(icon: AnnouncementIcon, emoji: string | null): boolean {
  return Boolean(emoji && trimText(emoji)) || icon !== "none";
}

// The message's icon, or its emoji when it has one. The SVG markup is the
// fixed set in ANNOUNCEMENT_ICON_SVG (an unknown icon draws as info, as the
// extension does), never admin input.
export function Glyph({
  icon,
  emoji,
  size,
}: {
  icon: AnnouncementIcon;
  emoji: string | null;
  size: number;
}) {
  const e = emoji ? trimText(emoji) : "";
  if (e) {
    return (
      <span
        aria-hidden="true"
        className="inline-block leading-none"
        style={{ fontSize: Math.round(size * 0.95) }}
      >
        {e}
      </span>
    );
  }
  if (icon === "none") return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="block shrink-0"
      dangerouslySetInnerHTML={{ __html: ANNOUNCEMENT_ICON_SVG[icon] ?? ANNOUNCEMENT_ICON_SVG.info }}
    />
  );
}

// The message's glyph in a tinted square of its colour; a dot when it has none.
export function GlyphTile({
  icon,
  emoji,
  accent,
  size = 32,
  faded = false,
}: {
  icon: AnnouncementIcon;
  emoji: string | null;
  accent: string;
  size?: number;
  faded?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{
        width: size,
        height: size,
        color: accent,
        backgroundColor: alpha(accent, faded ? 0.08 : 0.14),
        boxShadow: `inset 0 0 0 1px ${alpha(accent, faded ? 0.18 : 0.3)}`,
      }}
    >
      {hasGlyph(icon, emoji) ? (
        <Glyph icon={icon} emoji={emoji} size={Math.round(size * 0.5)} />
      ) : (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
      )}
    </span>
  );
}

// A sketch of where a place sits: the panel with a banner under its header, a
// popup over the panel, or a card above the launcher on the marketplace page.
// Outlines take the text colour; the message itself is drawn in its colour.
export function PlaceDiagram({
  place,
  accent,
  className = "",
}: {
  place: AnnouncementPlacement;
  accent: string;
  className?: string;
}) {
  const line = { stroke: "currentColor", strokeOpacity: 0.35, strokeWidth: 1.25 };
  const faint = { fill: "currentColor", fillOpacity: 0.12 };
  return (
    <svg
      viewBox="0 0 72 48"
      aria-hidden="true"
      className={`block ${className}`}
      fill="none"
      strokeLinecap="round"
    >
      <rect x="1" y="1" width="70" height="46" rx="5" {...line} />
      {place === "launcher" ? (
        <>
          <rect x="9" y="8" width="54" height="4" rx="2" {...faint} />
          <rect x="9" y="16" width="16" height="10" rx="2" {...faint} />
          <rect x="28" y="16" width="16" height="10" rx="2" {...faint} />
          <rect x="47" y="16" width="16" height="10" rx="2" {...faint} />
          <rect x="6" y="18" width="30" height="13" rx="3" fill={accent} fillOpacity={0.16} />
          <rect x="6" y="18" width="2" height="13" rx="1" fill={accent} />
          <rect x="11" y="22" width="18" height="2" rx="1" fill={accent} fillOpacity={0.8} />
          <rect x="11" y="26" width="13" height="2" rx="1" fill="currentColor" fillOpacity={0.3} />
          <rect x="6" y="35" width="8" height="8" rx="2.5" fill="currentColor" fillOpacity={0.55} />
        </>
      ) : (
        <>
          <path d="M1 11h70" {...line} />
          <rect x="7" y="4.5" width="18" height="3" rx="1.5" {...faint} />
          {place === "banner" ? (
            <>
              <rect x="7" y="15" width="58" height="9" rx="2.5" fill={accent} fillOpacity={0.18} />
              <rect x="7" y="15" width="58" height="9" rx="2.5" stroke={accent} strokeOpacity={0.7} />
              <rect x="11" y="18.5" width="24" height="2" rx="1" fill={accent} />
              <rect x="7" y="29" width="58" height="4" rx="2" {...faint} />
              <rect x="7" y="37" width="40" height="4" rx="2" {...faint} />
            </>
          ) : (
            <>
              <rect x="7" y="16" width="58" height="4" rx="2" {...faint} />
              <rect x="7" y="25" width="58" height="4" rx="2" {...faint} />
              <rect x="7" y="34" width="40" height="4" rx="2" {...faint} />
              <rect x="1.6" y="11.6" width="68.8" height="34.8" rx="4" fill="currentColor" fillOpacity={0.18} />
              <rect x="20" y="15" width="32" height="26" rx="3.5" style={{ fill: "var(--admin-surface)" }} />
              <rect x="20" y="15" width="32" height="26" rx="3.5" stroke="currentColor" strokeOpacity={0.3} />
              <path d="M23.5 15h25" stroke={accent} strokeWidth={2.5} />
              <rect x="24" y="22" width="18" height="2" rx="1" fill={accent} />
              <rect x="24" y="27" width="22" height="2" rx="1" fill="currentColor" fillOpacity={0.3} />
              <rect x="39" y="34" width="9" height="3.5" rx="1.75" fill="currentColor" fillOpacity={0.45} />
            </>
          )}
        </>
      )}
    </svg>
  );
}

// Line icons in the planner's style (components/admin/social/icons.tsx) that
// it has no copy of.
type IconProps = { size?: number; className?: string };

function Svg({ size = 16, className = "", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

export const IconRepeat = (p: IconProps) => (
  <Svg {...p}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </Svg>
);

export const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </Svg>
);

export const IconSend = (p: IconProps) => (
  <Svg {...p}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </Svg>
);

export const IconLayout = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </Svg>
);

export const IconStop = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
  </Svg>
);

// Buttons, as the console draws them.
export const primaryButton =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-default disabled:opacity-50";
export const secondaryButton =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-default disabled:opacity-50";
export const ghostButton =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-default disabled:opacity-50";

// Fields.
export const inputClass =
  "w-full rounded-md border border-[var(--admin-border)] bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors hover:border-zinc-300 focus:border-zinc-500 focus:outline-none disabled:bg-zinc-50";
export const hintClass = "mt-1.5 block text-xs leading-relaxed text-zinc-500";
export const errorClass = "mt-1.5 block text-xs text-red-600";

// A native checkbox or radio, hidden but still the thing that is focused and
// read out; the drawn control shows its keyboard focus.
export const focusRing =
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-500";

// An on/off pill, for lists where any number can be picked.
export function ChipToggle({
  checked,
  onChange,
  disabled = false,
  title,
  children,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <label
      title={title}
      className={`relative inline-flex ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${focusRing} ${
          checked
            ? "border-zinc-900 bg-zinc-900 font-medium text-white"
            : "border-[var(--admin-border)] text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
        }`}
      >
        {children}
      </span>
    </label>
  );
}

// One of a few, side by side.
export function Segmented<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap rounded-lg border border-[var(--admin-border)] bg-zinc-50 p-0.5"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label key={o.value} title={o.title} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              className="peer sr-only"
              checked={on}
              onChange={() => onChange(o.value)}
            />
            <span
              className={`block whitespace-nowrap rounded-md px-3 py-1 text-xs transition-colors ${focusRing} ${
                on
                  ? "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-[var(--admin-border)]"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {o.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// A part of the editor: a heading, an optional line under it, and its fields.
// Parts are split by a hairline rather than boxed, so the page reads as one
// form and the preview beside it stays the loudest thing on screen.
export function EditorSection({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-t border-[var(--admin-border)] px-5 py-6 first:border-t-0 sm:px-7"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 id={id} className="text-[13px] font-semibold text-zinc-900">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

// A label over a field, with an optional counter or note on the right.
export function FieldLabel({
  htmlFor,
  end,
  children,
}: {
  htmlFor?: string;
  end?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-zinc-700">
          {children}
        </label>
      ) : (
        <span className="text-xs font-medium text-zinc-700">{children}</span>
      )}
      {end && <span className="text-[11px] tabular-nums text-zinc-400">{end}</span>}
    </div>
  );
}

// A row of the audience form: what it filters on the left, the choices right.
export function FilterRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-[128px_minmax(0,1fr)]">
      <span className="pt-1 text-xs font-medium text-zinc-700">{label}</span>
      <div className="min-w-0">
        {children}
        {hint && <span className={hintClass}>{hint}</span>}
      </div>
    </div>
  );
}
