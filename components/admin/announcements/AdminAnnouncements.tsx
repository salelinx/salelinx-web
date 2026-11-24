"use client";

// Editor for the messages shown in users' SaleLinx extension (announcements,
// migration 064_announcements.sql). Three lists (live now, scheduled, the most
// recently ended) and a drawer to write one, with a live preview of how the
// extension draws it in each place it shows.
//
// Writes go through server actions that call the is_admin()-gated RPCs, which
// are the security boundary and write their own audit entries (each records
// the whole old row, so an edit or a delete is reversible from the log). As on
// the roadmap, that is why a delete asks for a confirm rather than step-up
// reauth. Every write bumps announcement_signal, which is what pushes the
// change to the extensions that are open.
//
// Copy is plain text, English required; a blank French, Spanish or German
// field shows the English text. The checks in lib/announcements/types.ts mirror
// the RPC's so mistakes show before saving; the RPC still decides. Admin text
// is only ever rendered as React text. The one dangerouslySetInnerHTML is the
// fixed icon markup in ANNOUNCEMENT_ICON_SVG, never anything an admin typed.
//
// Images upload from the browser straight into the public announcement-images
// bucket (only admins may write it) as soon as they are picked. An upload that
// is replaced, removed or left behind by Cancel before saving is deleted again
// (discardUploadedImage), and a saved image a message stops using is deleted
// by the save action. The console's CSP has no Storage host in img-src, so the
// thumbnails are blob URLs: the picked file itself, or the stored file
// downloaded with the admin's session.

import { useEffect, useRef, useState, useTransition } from "react";
import { AdminRefreshButton } from "@/components/admin/AdminRefreshButton";
import { AdminSection } from "@/components/admin/AdminSection";
import { LocalTime } from "@/components/admin/social/LocalTime";
import { useClientNow } from "@/lib/admin/use-client-now";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_BUTTON_LABEL_MAX,
  ANNOUNCEMENT_BUTTON_URL_MAX,
  ANNOUNCEMENT_BUTTONS_MAX,
  ANNOUNCEMENT_EMOJI_MAX,
  ANNOUNCEMENT_ERROR_MESSAGE,
  ANNOUNCEMENT_FREQUENCIES,
  ANNOUNCEMENT_FREQUENCY_HINT,
  ANNOUNCEMENT_FREQUENCY_LABEL,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_ICON_LABEL,
  ANNOUNCEMENT_ICON_SVG,
  ANNOUNCEMENT_IMAGE_BUCKET,
  ANNOUNCEMENT_IMAGE_MAX_BYTES,
  ANNOUNCEMENT_IMAGE_TYPES,
  ANNOUNCEMENT_LOCALES,
  ANNOUNCEMENT_LOCALE_LABEL,
  ANNOUNCEMENT_EDITOR_PLACEMENTS,
  ANNOUNCEMENT_PANEL_PLACEMENTS,
  ANNOUNCEMENT_PLACEMENT_HINT,
  ANNOUNCEMENT_PLACEMENT_LABEL,
  ANNOUNCEMENT_PLATFORMS,
  ANNOUNCEMENT_PLATFORM_LABEL,
  ANNOUNCEMENT_PRESETS,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_PRIORITY_LABEL,
  ANNOUNCEMENT_RECIPIENTS_MAX,
  ANNOUNCEMENT_TABS,
  ANNOUNCEMENT_TAB_LABEL,
  ANNOUNCEMENT_THEMES,
  ANNOUNCEMENT_THEME_COLOR,
  ANNOUNCEMENT_THEME_LABEL,
  ANNOUNCEMENT_TIERS,
  ANNOUNCEMENT_TIER_LABEL,
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENTS_ENDED_SHOWN,
  announcementImagePath,
  announcementImageUrl,
  audienceSummary,
  charCount,
  ctaUrlOk,
  emailLooksOk,
  emojiOk,
  fromLocalInput,
  groupAnnouncements,
  localizedAnnouncementText,
  missingAnnouncementLocales,
  parseRecipientEmails,
  placementsForTabs,
  toLocalInput,
  editorPlacements,
  togglePlacement,
  trimText,
  validateAnnouncementDraft,
  versionOk,
  type AnnouncementDraft,
  type AnnouncementFrequency,
  type AnnouncementIcon,
  type AnnouncementLocale,
  type AnnouncementPhase,
  type AnnouncementPlacement,
  type AnnouncementPlatform,
  type AnnouncementPreset,
  type AnnouncementPriority,
  type AnnouncementRow,
  type AnnouncementTab,
  type AnnouncementText,
  type AnnouncementTextInput,
  type AnnouncementTheme,
  type AnnouncementTier,
} from "@/lib/announcements/types";
import {
  deleteAnnouncement,
  discardUploadedImage,
  endAnnouncement,
  saveAnnouncement,
  sendTestAnnouncement,
  type AnnouncementResult,
} from "@/app/admin/(configuration)/announcements/actions";
import type { TestOptions } from "@/lib/announcements/test-messages";

// Short names for the places, for the list rows and the preview switch.
const PLACE_SHORT: Record<AnnouncementPlacement, string> = {
  banner: "Banner",
  popup: "Popup",
  launcher: "Launcher card",
  badge: "Badge",
  toolbar: "Toolbar popup",
};

// The places the preview can draw: the ones the editor offers.
const PREVIEW_PLACES = ["banner", "popup", "launcher"] as const;
type PreviewPlace = (typeof PREVIEW_PLACES)[number];

// The small heading the popup and the launcher card start with. The extension
// writes it in the user's language; the preview shows the English.
const KICKER: Record<AnnouncementPriority, string> = {
  normal: "Notice",
  high: "Heads up",
  urgent: "Important",
};

const PRIORITY_CHIP: Record<AnnouncementPriority, string> = {
  normal: "",
  high: "border-amber-200 bg-amber-50 text-amber-800",
  urgent: "border-red-200 bg-red-50 text-red-800",
};

function errorText(code: string | undefined): string {
  if (!code) return "Something went wrong.";
  if (code === "not authorized") {
    return "This session is not allowed to change announcements. Sign in again with your authenticator code.";
  }
  return ANNOUNCEMENT_ERROR_MESSAGE[code] ?? code;
}

// A hex colour with an alpha, e.g. the banner's border at 45%.
function alpha(hex: string, amount: number): string {
  return `${hex}${Math.round(amount * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

function hasGlyph(icon: AnnouncementIcon, emoji: string | null): boolean {
  return Boolean(emoji && trimText(emoji)) || icon !== "none";
}

// The message's icon, or its emoji when it has one. The SVG markup is the
// fixed set in ANNOUNCEMENT_ICON_SVG (an unknown icon draws as info, as the
// extension does), never admin input.
function Glyph({
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
      className="block"
      dangerouslySetInnerHTML={{ __html: ANNOUNCEMENT_ICON_SVG[icon] ?? ANNOUNCEMENT_ICON_SVG.info }}
    />
  );
}

type Message = { ok: boolean; text: string };

export function AdminAnnouncements({
  announcements,
  now,
  error,
}: {
  announcements: AnnouncementRow[];
  // The server's clock when it read the rows (ISO). Groups the first render,
  // so the server and the client agree, until the client's clock takes over.
  now: string;
  error: string | null;
}) {
  // undefined: closed. null: a new announcement.
  const [editing, setEditing] = useState<AnnouncementRow | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);
  const [testing, setTesting] = useState(false);
  const clientNow = useClientNow();
  const groups = groupAnnouncements(announcements, clientNow ?? Date.parse(now));

  function act(work: () => Promise<AnnouncementResult>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await work();
      setMessage(
        res.ok ? { ok: true, text: success } : { ok: false, text: errorText(res.error) },
      );
    });
  }

  function end(a: AnnouncementRow) {
    act(
      () => endAnnouncement(a.id),
      `Ended "${a.title.en}". Open extensions drop it within about 15 seconds.`,
    );
  }

  function remove(a: AnnouncementRow) {
    setConfirmDelete(null);
    act(
      () => deleteAnnouncement(a.id),
      `Deleted "${a.title.en}". The audit log keeps a copy.`,
    );
  }

  function sendTest(options: TestOptions) {
    act(
      () => sendTestAnnouncement(options),
      "Test sent to you only. Your extension shows it within about 15 seconds, or on a page reload. It ends by itself in an hour.",
    );
  }

  function open(a: AnnouncementRow | null) {
    setMessage(null);
    setConfirmDelete(null);
    setEditing(a);
  }

  const sections: { phase: AnnouncementPhase; title: string; empty: string }[] = [
    {
      phase: "live",
      title: "Live now",
      empty: "Nothing live. Users see no announcement.",
    },
    {
      phase: "scheduled",
      title: "Scheduled",
      empty: "Nothing scheduled.",
    },
    {
      phase: "ended",
      title: "Ended",
      empty: "Nothing has ended yet.",
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">
          Announcements
          <span className="ml-2 font-normal text-zinc-400">
            {groups.live.length} live
            {groups.scheduled.length > 0 ? `, ${groups.scheduled.length} scheduled` : ""}
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-expanded={testing}
            onClick={() => setTesting((t) => !t)}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              testing
                ? "border-zinc-900 text-zinc-900"
                : "border-[var(--admin-border)] text-zinc-700 hover:border-zinc-400"
            }`}
          >
            Quick test
          </button>
          <button
            type="button"
            onClick={() => open(null)}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700"
          >
            New announcement
          </button>
          <AdminRefreshButton />
        </div>
      </header>

      {testing && <QuickTest disabled={pending || !!error} onSend={sendTest} />}

      {(error || message) && (
        <div
          className={
            "shrink-0 border-b border-[var(--admin-border)] px-4 py-2 text-xs " +
            (error || !message?.ok
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700")
          }
        >
          {error
            ? `Could not load announcements: ${error}. Has migration 064 been applied?`
            : message?.text}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="border-b border-[var(--admin-border)] px-4 py-3 text-xs leading-relaxed text-zinc-600">
          <p>
            Messages reach users who have the SaleLinx extension open within
            about 15 seconds (each install waits a random moment so they do not
            all refetch at once), and everyone else on their next marketplace
            page load.
          </p>
          <p className="mt-1.5">
            Each message picks its own look, where it shows (a banner or a
            popup in the panel, or a card by the launcher while the panel is
            closed), how often it comes back and who sees it, down to specific
            users. Plain text only; up to two
            buttons can link to salelinx.com, the Chrome Web Store, Depop,
            Vinted or eBay.
          </p>
        </div>

        {sections.map((s) => {
          const rows = groups[s.phase];
          return (
            <AdminSection
              key={s.phase}
              storageKey={`announcements-${s.phase}`}
              title={s.title}
              summary={
                s.phase === "ended"
                  ? `${rows.length}, most recent ${ANNOUNCEMENTS_ENDED_SHOWN} kept here`
                  : `${rows.length}`
              }
            >
              {rows.length === 0 ? (
                <p className="mx-4 mb-3 rounded-md border border-dashed border-[var(--admin-border)] px-3 py-5 text-center text-xs text-zinc-400">
                  {s.empty}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--admin-border)] border-t border-[var(--admin-border)]">
                  {rows.map((a) => (
                    <Row
                      key={a.id}
                      a={a}
                      phase={s.phase}
                      disabled={pending}
                      confirming={confirmDelete === a.id}
                      onEdit={() => open(a)}
                      onEnd={() => end(a)}
                      onAskDelete={() => setConfirmDelete(a.id)}
                      onKeep={() => setConfirmDelete(null)}
                      onDelete={() => remove(a)}
                    />
                  ))}
                </ul>
              )}
            </AdminSection>
          );
        })}
      </div>

      {editing !== undefined && (
        <Editor
          key={editing?.id ?? "new"}
          initial={editing}
          onClose={() => setEditing(undefined)}
          onDone={(text) => {
            setEditing(undefined);
            setMessage({ ok: true, text });
          }}
        />
      )}
    </div>
  );
}

// Quick test: send yourself a real message in a few clicks, to see each
// starting point, place and frequency in your own extension. The starting
// point fills in its usual place and frequency, which can then be changed.
function QuickTest({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (options: TestOptions) => void;
}) {
  const first = ANNOUNCEMENT_PRESETS[0];
  const [preset, setPreset] = useState<AnnouncementPreset>(first);
  const [places, setPlaces] = useState<AnnouncementPlacement[]>(editorPlacements(first.placements));
  const [frequency, setFrequency] = useState<AnnouncementFrequency>(first.frequency);
  const select =
    "rounded-md border border-[var(--admin-border)] bg-transparent px-2 py-1 text-xs";

  function pick(p: AnnouncementPreset) {
    setPreset(p);
    setPlaces(editorPlacements(p.placements));
    setFrequency(p.frequency);
  }

  return (
    <div className="shrink-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div>
          <span className="mb-1 block text-xs font-medium text-zinc-600">Start from</span>
          <div className="flex flex-wrap gap-1">
            {ANNOUNCEMENT_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                title={p.hint}
                aria-pressed={preset.key === p.key}
                onClick={() => pick(p)}
                className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs text-zinc-700 ${
                  preset.key === p.key
                    ? "border-zinc-900 ring-1 ring-zinc-900"
                    : "border-[var(--admin-border)] hover:border-zinc-400"
                }`}
              >
                <span style={{ color: ANNOUNCEMENT_THEME_COLOR[p.theme] }}>
                  <Glyph icon={p.icon} emoji={null} size={12} />
                </span>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-zinc-600">Where it shows</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1 py-1">
            {ANNOUNCEMENT_EDITOR_PLACEMENTS.map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={places.includes(p)}
                  onChange={(e) => setPlaces(togglePlacement(places, p, e.target.checked, []))}
                />
                {ANNOUNCEMENT_PLACEMENT_LABEL[p]}
              </label>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">How often</span>
          <select
            className={select}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as AnnouncementFrequency)}
          >
            {ANNOUNCEMENT_FREQUENCIES.map((q) => (
              <option key={q} value={q}>
                {ANNOUNCEMENT_FREQUENCY_LABEL[q]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={disabled || places.length === 0}
          title={places.length === 0 ? "Tick at least one place" : undefined}
          onClick={() => onSend({ preset: preset.key, places, frequency })}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          Send to me
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
        Sends a real message to your account only, with sample text in English
        and French (switch the extension to Spanish or German to see the English
        fallback). It ends by itself after an hour and is listed below with a
        &quot;Test:&quot; title, so you can end or delete it sooner.
      </p>
    </div>
  );
}

function Row({
  a,
  phase,
  disabled,
  confirming,
  onEdit,
  onEnd,
  onAskDelete,
  onKeep,
  onDelete,
}: {
  a: AnnouncementRow;
  phase: AnnouncementPhase;
  disabled: boolean;
  confirming: boolean;
  onEdit: () => void;
  onEnd: () => void;
  onAskDelete: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const missing = missingAnnouncementLocales(a);
  const color = ANNOUNCEMENT_THEME_COLOR[a.theme];
  const tag =
    "rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-[10px] text-zinc-500";
  const textBtn =
    "rounded px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50";

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-2.5">
        <span
          title={ANNOUNCEMENT_THEME_LABEL[a.theme]}
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
          style={{ color, borderColor: alpha(color, 0.45), backgroundColor: alpha(color, 0.1) }}
        >
          {hasGlyph(a.icon, a.emoji) ? (
            <Glyph icon={a.icon} emoji={a.emoji} size={14} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          )}
        </span>
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{a.title.en}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {a.priority !== "normal" && (
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${PRIORITY_CHIP[a.priority]}`}
              >
                {ANNOUNCEMENT_PRIORITY_LABEL[a.priority]}
              </span>
            )}
            <span className={tag}>{a.placements.map((p) => PLACE_SHORT[p] ?? p).join(", ")}</span>
            <span className={tag}>{ANNOUNCEMENT_FREQUENCY_LABEL[a.frequency] ?? a.frequency}</span>
            {a.revision > 1 && (
              <span
                className={tag}
                title={`Shown again to people who dismissed it ${a.revision - 1} ${a.revision === 2 ? "time" : "times"}`}
              >
                Revision {a.revision}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">{audienceSummary(a)}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {phase === "ended" ? (
              <>
                Ended <LocalTime iso={a.ends_at ?? a.updated_at} />
              </>
            ) : (
              <>
                {phase === "live" ? "Since " : "Starts "}
                <LocalTime iso={a.starts_at} />
                {a.ends_at ? (
                  <>
                    {" \u00b7 ends "}
                    <LocalTime iso={a.ends_at} />
                  </>
                ) : (
                  " \u00b7 no end set"
                )}
              </>
            )}
          </p>
          {missing.length > 0 && phase !== "ended" && (
            <p className="mt-0.5 text-[11px] text-amber-700">
              English shown for: {missing.map((l) => l.toUpperCase()).join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-0.5 sm:justify-end">
        {confirming ? (
          <>
            <span className="mr-1 text-xs text-zinc-600">
              {phase === "ended" ? "Delete for good?" : "Delete for good? End now takes it down instead."}
            </span>
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
            <button type="button" onClick={onKeep} disabled={disabled} className={textBtn}>
              Keep
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEdit} disabled={disabled} className={textBtn}>
              Edit
            </button>
            {phase !== "ended" && (
              <button
                type="button"
                onClick={onEnd}
                disabled={disabled}
                title={
                  phase === "live"
                    ? "Take it down now"
                    : "Cancel it: it will never start"
                }
                className={textBtn}
              >
                End now
              </button>
            )}
            <button
              type="button"
              onClick={onAskDelete}
              disabled={disabled}
              className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

type ButtonForm = { label: AnnouncementTextInput; url: string };

// The editor's working copy. Times are datetime-local strings in the admin's
// own time zone until saving turns them into ISO; recipients are the
// textarea's text until saving parses it.
type Form = {
  priority: AnnouncementPriority;
  theme: AnnouncementTheme;
  icon: AnnouncementIcon;
  emoji: string;
  title: AnnouncementTextInput;
  body: AnnouncementTextInput;
  imagePath: string | null;
  buttons: ButtonForm[];
  placements: AnnouncementPlacement[];
  frequency: AnnouncementFrequency;
  tiers: AnnouncementTier[];
  platforms: AnnouncementPlatform[];
  locales: AnnouncementLocale[];
  tabs: string[];
  minVersion: string;
  maxVersion: string;
  signedInOnly: boolean;
  recipients: string;
  startMode: "now" | "at";
  startAt: string;
  endMode: "never" | "at";
  endAt: string;
  showAgain: boolean;
};

// A new message starts from the column defaults.
function formFrom(a: AnnouncementRow | null): Form {
  if (!a) {
    return {
      priority: "normal",
      theme: "blue",
      icon: "info",
      emoji: "",
      title: { en: "" },
      body: { en: "" },
      imagePath: null,
      buttons: [],
      placements: ["banner"],
      frequency: "until_closed",
      tiers: [],
      platforms: [],
      locales: [],
      tabs: [],
      minVersion: "",
      maxVersion: "",
      signedInOnly: false,
      recipients: "",
      startMode: "now",
      startAt: "",
      endMode: "never",
      endAt: "",
      showAgain: false,
    };
  }
  return {
    priority: a.priority,
    theme: a.theme,
    icon: a.icon,
    emoji: a.emoji ?? "",
    title: { ...a.title },
    body: { ...a.body },
    imagePath: a.image_path,
    buttons: (a.buttons ?? []).map((b) => ({ label: { ...b.label }, url: b.url })),
    // The offered places it has (the first design's toolbar places are dropped).
    placements: editorPlacements(a.placements),
    frequency: a.frequency,
    tiers: [...a.audience_tiers],
    platforms: [...a.audience_platforms],
    locales: [...a.audience_locales],
    tabs: [...a.audience_tabs],
    minVersion: a.min_version ?? "",
    maxVersion: a.max_version ?? "",
    signedInOnly: a.signed_in_only,
    recipients: a.recipients.join("\n"),
    // An existing one keeps its own start time unless "Now" is picked.
    startMode: "at",
    startAt: toLocalInput(a.starts_at),
    endMode: a.ends_at ? "at" : "never",
    endAt: a.ends_at ? toLocalInput(a.ends_at) : "",
    showAgain: false,
  };
}

function labelBlank(label: AnnouncementTextInput): boolean {
  return ANNOUNCEMENT_LOCALES.every((l) => !trimText(label[l] ?? ""));
}

// The draft the RPC takes, or the editor's own error code when a time that was
// asked for is missing.
function draftFrom(
  form: Form,
  id: string | null,
): AnnouncementDraft | "missing_start" | "missing_end" {
  const startsAt = form.startMode === "now" ? null : fromLocalInput(form.startAt);
  if (form.startMode === "at" && !startsAt) return "missing_start";
  const endsAt = form.endMode === "never" ? null : fromLocalInput(form.endAt);
  if (form.endMode === "at" && !endsAt) return "missing_end";

  return {
    id,
    priority: form.priority,
    theme: form.theme,
    icon: form.icon,
    emoji: trimText(form.emoji) || null,
    title: form.title,
    body: form.body,
    image_path: form.imagePath,
    // A button with no label in any language and no link is no button, as
    // the RPC reads it.
    buttons: form.buttons
      .map((b) => ({ label: b.label, url: trimText(b.url) }))
      .filter((b) => b.url || !labelBlank(b.label)),
    placements: form.placements,
    frequency: form.frequency,
    audience_tiers: form.tiers,
    audience_platforms: form.platforms,
    audience_locales: form.locales,
    audience_tabs: form.tabs,
    min_version: trimText(form.minVersion) || null,
    max_version: trimText(form.maxVersion) || null,
    signed_in_only: form.signedInOnly,
    starts_at: startsAt,
    ends_at: endsAt,
    recipients: parseRecipientEmails(form.recipients),
  };
}

// Copy with every value trimmed and blank ones left out, the shape
// missingAnnouncementLocales reads.
function trimmedText(text: AnnouncementTextInput): AnnouncementText {
  const out: AnnouncementText = { en: trimText(text.en ?? "") };
  for (const l of ANNOUNCEMENT_LOCALES) {
    const value = trimText(text[l] ?? "");
    if (l !== "en" && value) out[l] = value;
  }
  return out;
}

// True when the form has exactly what the preset fills in.
function presetMatches(p: AnnouncementPreset, f: Form): boolean {
  const places = placementsForTabs(p.placements, f.tabs);
  return (
    p.priority === f.priority &&
    p.theme === f.theme &&
    p.icon === f.icon &&
    p.frequency === f.frequency &&
    places.length === f.placements.length &&
    places.every((x) => f.placements.includes(x))
  );
}

function tabLabel(tab: string): string {
  return (ANNOUNCEMENT_TABS as readonly string[]).includes(tab)
    ? ANNOUNCEMENT_TAB_LABEL[tab as AnnouncementTab]
    : `${tab} (not listed)`;
}

function toggle<T>(list: T[], value: T, on: boolean): T[] {
  return on ? [...list.filter((v) => v !== value), value] : list.filter((v) => v !== value);
}

// A displayable address for the message's image: the picked file's own blob
// URL for a fresh upload, otherwise the stored file downloaded with the
// admin's session (the console's CSP blocks Storage URLs in <img>). Null while
// it loads, or when there is no image.
function useImageSrc(path: string | null, local: Record<string, string>): string | null {
  const [fetched, setFetched] = useState<{ path: string; src: string } | null>(null);
  const localSrc = path ? local[path] : undefined;
  useEffect(() => {
    if (!path || localSrc) return;
    let live = true;
    createBrowserClient()
      .storage.from(ANNOUNCEMENT_IMAGE_BUCKET)
      .download(path)
      .then(({ data }) => {
        if (live && data) setFetched({ path, src: URL.createObjectURL(data) });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [path, localSrc]);
  if (!path) return null;
  return localSrc ?? (fetched?.path === path ? fetched.src : null);
}

function Editor({
  initial,
  onClose,
  onDone,
}: {
  initial: AnnouncementRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const isNew = initial === null;
  const [startForm] = useState<Form>(() => formFrom(initial));
  const [form, setForm] = useState<Form>(startForm);
  const [locale, setLocale] = useState<AnnouncementLocale>("en");
  const [previewLocale, setPreviewLocale] = useState<AnnouncementLocale>("en");
  const [previewPlace, setPreviewPlace] = useState<PreviewPlace>("banner");
  const [error, setError] = useState<string | null>(null);
  const [unknownEmails, setUnknownEmails] = useState<string[]>([]);
  const [meNote, setMeNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  // Blob URLs of the files picked in this editor, by bucket path.
  const [localImages, setLocalImages] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  // Paths uploaded in this editor and not yet saved, deleted if they never are.
  const fresh = useRef<string[]>([]);
  const clientNow = useClientNow();
  const imageSrc = useImageSrc(form.imagePath, localImages);
  const busy = pending || uploading;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setError(null);
    setForm((f) => ({ ...f, [key]: value }));
  }

  function update(change: (f: Form) => Partial<Form>) {
    setError(null);
    setForm((f) => ({ ...f, ...change(f) }));
  }

  function setText(field: "title" | "body", value: string) {
    update((f) => ({ [field]: { ...f[field], [locale]: value } }));
  }

  function setButton(index: number, change: (b: ButtonForm) => ButtonForm) {
    update((f) => ({ buttons: f.buttons.map((b, i) => (i === index ? change(b) : b)) }));
  }

  // A starting point sets the icon, so it clears an emoji that would hide it.
  function applyPreset(p: AnnouncementPreset) {
    update((f) => ({
      priority: p.priority,
      theme: p.theme,
      icon: p.icon,
      emoji: "",
      placements: placementsForTabs(p.placements, f.tabs),
      frequency: p.frequency,
    }));
  }

  function setTab(tab: string, on: boolean) {
    update((f) => {
      const tabs = toggle(f.tabs, tab, on);
      return { tabs, placements: placementsForTabs(f.placements, tabs) };
    });
  }

  function pickLocale(l: AnnouncementLocale) {
    setLocale(l);
    setPreviewLocale(l);
  }

  // Deletes this editor's unsaved uploads, all but `keep`.
  function discardFresh(keep: string | null) {
    const leftovers = fresh.current.filter((p) => p !== keep);
    fresh.current = [];
    for (const p of leftovers) void discardUploadedImage(p);
  }

  // An unsaved upload that is being let go of is deleted straight away. A
  // saved image stays until the save goes through without it.
  function dropIfFresh(path: string | null) {
    if (!path || !fresh.current.includes(path)) return;
    fresh.current = fresh.current.filter((p) => p !== path);
    void discardUploadedImage(path);
  }

  function close() {
    if (busy) return;
    discardFresh(null);
    onClose();
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    if (!(ANNOUNCEMENT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setImageError("Use a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if (file.size > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
      setImageError(
        `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Images can be at most ${ANNOUNCEMENT_IMAGE_MAX_BYTES / 1024 / 1024} MB.`,
      );
      return;
    }
    const previous = form.imagePath;
    const path = announcementImagePath(file.type);
    setUploading(true);
    const { error: uploadError } = await createBrowserClient()
      .storage.from(ANNOUNCEMENT_IMAGE_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type })
      .catch((err: Error) => ({ error: err }));
    setUploading(false);
    if (uploadError) {
      setImageError(`Upload failed: ${uploadError.message}`);
      return;
    }
    dropIfFresh(previous);
    fresh.current.push(path);
    setLocalImages((m) => ({ ...m, [path]: URL.createObjectURL(file) }));
    set("imagePath", path);
  }

  function removeImage() {
    dropIfFresh(form.imagePath);
    setImageError(null);
    set("imagePath", null);
  }

  async function justMe() {
    setMeNote(null);
    const { data } = await createBrowserClient()
      .auth.getUser()
      .catch(() => ({ data: { user: null } }));
    const email = data.user?.email;
    if (!email) {
      setMeNote("Could not read your own email. Type it in instead.");
      return;
    }
    set("recipients", email.toLowerCase());
  }

  function save() {
    setError(null);
    setUnknownEmails([]);
    const draft = draftFrom(form, initial?.id ?? null);
    if (typeof draft === "string") {
      setError(errorText(draft));
      return;
    }
    const code = validateAnnouncementDraft(draft, Date.now());
    if (code) {
      setError(errorText(code));
      return;
    }
    startTransition(async () => {
      const res = await saveAnnouncement(
        draft,
        isNew,
        form.showAgain,
        initial?.image_path ?? null,
      );
      if (!res.ok) {
        if (res.error === "unknown_recipients") setUnknownEmails(res.emails ?? []);
        setError(errorText(res.error));
        return;
      }
      discardFresh(draft.image_path);
      const title = trimText(form.title.en ?? "");
      onDone(
        isNew
          ? `Created "${title}". Open extensions pick it up within about 15 seconds.`
          : `Saved "${title}".${form.showAgain ? " People who dismissed it will see it again." : ""}`,
      );
    });
  }

  // Live checks. The editor only opens after hydration, so the clock is set.
  const draft = draftFrom(form, initial?.id ?? null);
  const liveCode =
    typeof draft === "string" ? draft : validateAnnouncementDraft(draft, clientNow ?? 0);
  const recipients = parseRecipientEmails(form.recipients);
  const badEmails = recipients.filter((e) => !emailLooksOk(e));
  const unknownShown = unknownEmails.filter((e) => recipients.includes(e));
  const min = trimText(form.minVersion);
  const max = trimText(form.maxVersion);
  const versionError =
    (min && !versionOk(min)) || (max && !versionOk(max)) ? ANNOUNCEMENT_ERROR_MESSAGE.invalid_version : null;
  const emojiError =
    trimText(form.emoji) && !emojiOk(form.emoji)
      ? `An emoji is at most ${ANNOUNCEMENT_EMOJI_MAX} characters, with no spaces.`
      : null;
  const copyTitle = trimmedText(form.title);
  const copyBody = trimmedText(form.body);
  // Only once there is English to fall back to.
  const missing =
    copyTitle.en || copyBody.en
      ? missingAnnouncementLocales({
          title: copyTitle,
          body: copyBody,
          audience_locales: form.locales,
        })
      : [];
  const tabsChosen = form.tabs.length > 0;
  const extraTabs = [...new Set([...(initial?.audience_tabs ?? []), ...form.tabs])].filter(
    (t) => !(ANNOUNCEMENT_TABS as readonly string[]).includes(t),
  );
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const audience = audienceSummary({
    audience_tiers: form.tiers,
    audience_platforms: form.platforms,
    audience_locales: form.locales,
    audience_tabs: form.tabs,
    min_version: min,
    max_version: max,
    signed_in_only: form.signedInOnly,
    recipients,
  });

  const input =
    "w-full rounded-md border border-[var(--admin-border)] px-2 py-1 text-sm disabled:bg-zinc-50";
  const label = "mb-1 block text-xs font-medium text-zinc-600";
  const hint = "mt-1 block text-[11px] text-zinc-400";
  const bad = "mt-1 block text-[11px] text-red-600";
  const fieldset = "rounded-md border border-[var(--admin-border)] p-3";
  const legend = "px-1 text-xs font-medium text-zinc-600";
  const smallBtn =
    "rounded border border-[var(--admin-border)] px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50";
  const choice = (on: boolean) =>
    on
      ? "border-zinc-900 ring-1 ring-zinc-900"
      : "border-[var(--admin-border)] hover:border-zinc-400";
  const en = locale === "en";

  function counter(value: string | undefined, maxChars: number) {
    const n = charCount(trimText(value ?? ""));
    return (
      <span className={n > maxChars ? "text-red-600" : "text-zinc-400"}>
        {n}/{maxChars}
      </span>
    );
  }

  const fileInput = (
    <input
      type="file"
      accept={ANNOUNCEMENT_IMAGE_TYPES.join(",")}
      className="hidden"
      disabled={busy}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        void pickImage(file);
      }}
    />
  );

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-20 bg-black/30" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "New announcement" : "Edit announcement"}
        className="fixed inset-y-0 right-0 z-20 flex w-full max-w-xl flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl lg:max-w-5xl"
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-4">
          <span className="min-w-0 truncate text-sm font-semibold">
            {initial ? initial.title.en : "New announcement"}
          </span>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="-mr-2 shrink-0 rounded p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
            aria-label="Close editor"
          >
            x
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto lg:flex lg:overflow-hidden">
          <div className="space-y-4 p-4 lg:min-h-0 lg:flex-1 lg:overflow-auto">
            {isNew ? (
              <fieldset className={fieldset}>
                <legend className={legend}>Start from</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ANNOUNCEMENT_PRESETS.map((p) => {
                    const on = presetMatches(p, form);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => applyPreset(p)}
                        className={`flex flex-col justify-start rounded-md border px-2.5 py-2 text-left ${choice(on)}`}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <span style={{ color: ANNOUNCEMENT_THEME_COLOR[p.theme] }}>
                            <Glyph icon={p.icon} emoji={null} size={14} />
                          </span>
                          {p.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                          {p.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <span className={hint}>
                  Fills in the look, where it shows, how often and the priority.
                  Any of them can still be changed below.
                </span>
              </fieldset>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-xs text-zinc-500">Start from:</span>
                {ANNOUNCEMENT_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    title={p.hint}
                    aria-pressed={presetMatches(p, form)}
                    onClick={() => applyPreset(p)}
                    className={`rounded border px-2 py-0.5 text-xs text-zinc-700 ${choice(presetMatches(p, form))}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            <fieldset className={fieldset}>
              <legend className={legend}>Look</legend>
              <div className="space-y-3">
                <div>
                  <span className={label}>Colour</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ANNOUNCEMENT_THEMES.map((t) => {
                      const on = form.theme === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set("theme", t)}
                          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${choice(on)} ${on ? "font-medium text-zinc-900" : "text-zinc-600"}`}
                        >
                          <span
                            aria-hidden="true"
                            className="h-3.5 w-3.5 rounded-full"
                            style={{ backgroundColor: ANNOUNCEMENT_THEME_COLOR[t] }}
                          />
                          {ANNOUNCEMENT_THEME_LABEL[t]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <span className={label}>Icon</span>
                  <div
                    className={`grid grid-cols-6 gap-1 sm:grid-cols-12 ${trimText(form.emoji) ? "opacity-50" : ""}`}
                  >
                    {ANNOUNCEMENT_ICONS.map((i) => {
                      const on = form.icon === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-pressed={on}
                          aria-label={ANNOUNCEMENT_ICON_LABEL[i]}
                          title={ANNOUNCEMENT_ICON_LABEL[i]}
                          onClick={() => set("icon", i)}
                          className={`flex h-9 items-center justify-center rounded-md border ${choice(on)} ${on ? "" : "text-zinc-500"}`}
                          style={on ? { color: ANNOUNCEMENT_THEME_COLOR[form.theme] } : undefined}
                        >
                          {i === "none" ? (
                            <span className="text-[10px]">None</span>
                          ) : (
                            <Glyph icon={i} emoji={null} size={18} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {trimText(form.emoji) !== "" && (
                    <span className={hint}>The emoji below is shown instead of the icon.</span>
                  )}
                </div>
                <label className="block">
                  <span className={label}>Emoji instead of the icon (optional)</span>
                  <input
                    type="text"
                    value={form.emoji}
                    placeholder="One emoji"
                    onChange={(e) => set("emoji", e.target.value)}
                    className="w-32 rounded-md border border-[var(--admin-border)] px-2 py-1 text-sm"
                    aria-invalid={emojiError ? true : undefined}
                  />
                  {emojiError ? (
                    <span className={bad}>{emojiError}</span>
                  ) : (
                    <span className={hint}>Leave empty to use the icon.</span>
                  )}
                </label>
              </div>
            </fieldset>

            <fieldset className={fieldset}>
              <legend className={legend}>Content</legend>
              <div className="mb-3 flex gap-1 border-b border-[var(--admin-border)]">
                {ANNOUNCEMENT_LOCALES.map((l) => {
                  const filled = Boolean(
                    trimText(form.title[l] ?? "") || trimText(form.body[l] ?? ""),
                  );
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => pickLocale(l)}
                      className={`-mb-px border-b-2 px-2.5 pb-1.5 text-xs ${
                        locale === l
                          ? "border-zinc-900 font-semibold text-zinc-900"
                          : "border-transparent text-zinc-500 hover:text-zinc-900"
                      }`}
                    >
                      {l.toUpperCase()}
                      {l === "en" ? " *" : filled ? " \u2713" : ""}
                    </button>
                  );
                })}
              </div>
              <p className="mb-3 text-[11px] text-zinc-500">
                {en
                  ? "English is required. French, Spanish and German are optional: a blank field shows the English text."
                  : `${ANNOUNCEMENT_LOCALE_LABEL[locale]} is optional. Any field left blank shows the English text.`}
                {missing.length > 0 && (
                  <span className="block text-amber-700">
                    English shown for:{" "}
                    {missing.map((l) => ANNOUNCEMENT_LOCALE_LABEL[l]).join(", ")}
                  </span>
                )}
              </p>

              <div className="space-y-4">
                <label className="block">
                  <span className={`${label} flex justify-between`}>
                    <span>Title ({ANNOUNCEMENT_LOCALE_LABEL[locale]})</span>
                    {counter(form.title[locale], ANNOUNCEMENT_TITLE_MAX)}
                  </span>
                  <input
                    type="text"
                    value={form.title[locale] ?? ""}
                    maxLength={ANNOUNCEMENT_TITLE_MAX}
                    placeholder={en ? "Vinted crosslisting is down" : form.title.en || "Title"}
                    onChange={(e) => setText("title", e.target.value)}
                    className={input}
                  />
                </label>
                <label className="block">
                  <span className={`${label} flex justify-between`}>
                    <span>Message ({ANNOUNCEMENT_LOCALE_LABEL[locale]})</span>
                    {counter(form.body[locale], ANNOUNCEMENT_BODY_MAX)}
                  </span>
                  <textarea
                    value={form.body[locale] ?? ""}
                    maxLength={ANNOUNCEMENT_BODY_MAX}
                    rows={4}
                    placeholder={
                      en ? "We're on it. Your listings are safe." : form.body.en || "Message"
                    }
                    onChange={(e) => setText("body", e.target.value)}
                    className={input}
                  />
                  <span className={hint}>Plain text. Line breaks are kept.</span>
                </label>

                <div>
                  <span className={label}>Image (optional, every language)</span>
                  {form.imagePath ? (
                    <div className="flex items-start gap-3">
                      {imageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element -- a blob URL of the picked or stored file; next/image adds nothing here
                        <img
                          src={imageSrc}
                          alt=""
                          className="h-16 w-28 shrink-0 rounded border border-[var(--admin-border)] object-cover"
                        />
                      ) : (
                        <span className="flex h-16 w-28 shrink-0 items-center justify-center rounded border border-dashed border-[var(--admin-border)] text-[11px] text-zinc-400">
                          Loading
                        </span>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <label className={`${smallBtn} cursor-pointer`}>
                          {uploading ? "Uploading..." : "Replace"}
                          {fileInput}
                        </label>
                        <button
                          type="button"
                          onClick={removeImage}
                          disabled={busy}
                          className="text-xs text-zinc-500 hover:text-red-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                        <a
                          href={announcementImageUrl(
                            form.imagePath,
                            process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-zinc-500 underline hover:text-zinc-800"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                  ) : (
                    <label className={`${smallBtn} inline-block cursor-pointer`}>
                      {uploading ? "Uploading..." : "Upload an image"}
                      {fileInput}
                    </label>
                  )}
                  {imageError ? (
                    <span className={bad}>{imageError}</span>
                  ) : (
                    <span className={hint}>
                      PNG, JPEG, WebP or GIF, up to{" "}
                      {ANNOUNCEMENT_IMAGE_MAX_BYTES / 1024 / 1024} MB. Shown above the
                      text. It uploads straight away.
                    </span>
                  )}
                </div>

                <div>
                  <span className={label}>Buttons (optional)</span>
                  <div className="space-y-2">
                    {form.buttons.map((b, i) => {
                      const url = trimText(b.url);
                      const urlBad = url !== "" && !ctaUrlOk(url);
                      return (
                        <div
                          key={i}
                          className="space-y-2 rounded-md border border-[var(--admin-border)] p-2"
                        >
                          <div className="flex items-center justify-between text-[11px] text-zinc-500">
                            <span>{i === 0 ? "Main button" : "Second button"}</span>
                            <button
                              type="button"
                              onClick={() =>
                                update((f) => ({ buttons: f.buttons.filter((_, j) => j !== i) }))
                              }
                              className="hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                          <label className="block">
                            <span className={`${label} flex justify-between`}>
                              <span>Label ({ANNOUNCEMENT_LOCALE_LABEL[locale]})</span>
                              {counter(b.label[locale], ANNOUNCEMENT_BUTTON_LABEL_MAX)}
                            </span>
                            <input
                              type="text"
                              value={b.label[locale] ?? ""}
                              maxLength={ANNOUNCEMENT_BUTTON_LABEL_MAX}
                              placeholder={
                                en ? (i === 0 ? "Update now" : "Learn more") : b.label.en || "Label"
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                setButton(i, (x) => ({
                                  ...x,
                                  label: { ...x.label, [locale]: value },
                                }));
                              }}
                              className={input}
                            />
                          </label>
                          <label className="block">
                            <span className={label}>Link (every language)</span>
                            <input
                              type="url"
                              inputMode="url"
                              value={b.url}
                              maxLength={ANNOUNCEMENT_BUTTON_URL_MAX}
                              placeholder="https://salelinx.com/docs/status"
                              onChange={(e) => {
                                const value = e.target.value;
                                setButton(i, (x) => ({ ...x, url: value }));
                              }}
                              className={`${input} font-mono text-xs`}
                              aria-invalid={urlBad ? true : undefined}
                            />
                            {urlBad && (
                              <span className={bad}>
                                {ANNOUNCEMENT_ERROR_MESSAGE.invalid_button_url}
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  {form.buttons.length < ANNOUNCEMENT_BUTTONS_MAX && (
                    <button
                      type="button"
                      onClick={() =>
                        update((f) => ({ buttons: [...f.buttons, { label: { en: "" }, url: "" }] }))
                      }
                      className={`${smallBtn} ${form.buttons.length ? "mt-2" : ""}`}
                    >
                      {form.buttons.length ? "Add a second button" : "Add a button"}
                    </button>
                  )}
                  <span className={hint}>
                    Up to {ANNOUNCEMENT_BUTTONS_MAX}; the first is the main one. Links
                    can only go to salelinx.com, the Chrome Web Store, Depop, Vinted or
                    eBay, over https.
                  </span>
                </div>
              </div>
            </fieldset>

            <fieldset className={fieldset}>
              <legend className={legend}>Where it shows</legend>
              <div className="space-y-1.5">
                {ANNOUNCEMENT_EDITOR_PLACEMENTS.map((p) => {
                  const blocked = tabsChosen && !ANNOUNCEMENT_PANEL_PLACEMENTS.includes(p);
                  return (
                    <label
                      key={p}
                      className={`flex items-start gap-2 text-sm ${blocked ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={form.placements.includes(p)}
                        disabled={blocked}
                        onChange={(e) => {
                          const on = e.target.checked;
                          update((f) => ({
                            placements: togglePlacement(f.placements, p, on, f.tabs),
                          }));
                        }}
                      />
                      <span>
                        {ANNOUNCEMENT_PLACEMENT_LABEL[p]}
                        <span className="block text-[11px] text-zinc-400">
                          {ANNOUNCEMENT_PLACEMENT_HINT[p]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {form.placements.length === 0 && (
                <p className="mt-2 text-[11px] text-red-600">Tick at least one place.</p>
              )}
              {tabsChosen && (
                <p className="mt-2 text-[11px] text-amber-700">
                  It is for certain panel tabs (under Who sees it), so it can only
                  show inside the panel: as a banner or popup.
                </p>
              )}
            </fieldset>

            <fieldset className={fieldset}>
              <legend className={legend}>How often</legend>
              <div className="space-y-1.5">
                {ANNOUNCEMENT_FREQUENCIES.map((q) => (
                  <label key={q} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      name="announcement-frequency"
                      checked={form.frequency === q}
                      onChange={() => set("frequency", q)}
                    />
                    <span>
                      {ANNOUNCEMENT_FREQUENCY_LABEL[q]}
                      <span className="block text-[11px] text-zinc-400">
                        {ANNOUNCEMENT_FREQUENCY_HINT[q]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={fieldset}>
              <legend className={legend}>Priority</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {ANNOUNCEMENT_PRIORITIES.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="announcement-priority"
                      checked={form.priority === p}
                      onChange={() => set("priority", p)}
                    />
                    {ANNOUNCEMENT_PRIORITY_LABEL[p]}
                  </label>
                ))}
              </div>
              <span className={hint}>
                Decides the order when several messages show. Urgent is read out
                by screen readers at once.
              </span>
            </fieldset>

            <fieldset className={fieldset}>
              <legend className={legend}>Who sees it</legend>
              <div className="space-y-3">
                <div>
                  <span className={label}>Plans (none ticked: everyone)</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {ANNOUNCEMENT_TIERS.map((t) => (
                      <label key={t} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={form.tiers.includes(t)}
                          onChange={(e) => set("tiers", toggle(form.tiers, t, e.target.checked))}
                        />
                        {ANNOUNCEMENT_TIER_LABEL[t]}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <span className={label}>Marketplaces (none ticked: everyone)</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {ANNOUNCEMENT_PLATFORMS.map((p) => (
                      <label key={p} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={form.platforms.includes(p)}
                          onChange={(e) =>
                            set("platforms", toggle(form.platforms, p, e.target.checked))
                          }
                        />
                        {ANNOUNCEMENT_PLATFORM_LABEL[p]}
                      </label>
                    ))}
                  </div>
                  <span className={hint}>
                    Matches anyone with at least one of the ticked marketplaces switched on.
                  </span>
                </div>
                <div>
                  <span className={label}>Languages (none ticked: everyone)</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {ANNOUNCEMENT_LOCALES.map((l) => (
                      <label key={l} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={form.locales.includes(l)}
                          onChange={(e) => set("locales", toggle(form.locales, l, e.target.checked))}
                        />
                        {ANNOUNCEMENT_LOCALE_LABEL[l]}
                      </label>
                    ))}
                  </div>
                  <span className={hint}>The language the extension is set to.</span>
                </div>
                <div>
                  <span className={label}>Panel tabs (none ticked: every tab)</span>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                    {[...ANNOUNCEMENT_TABS, ...extraTabs].map((t) => (
                      <label key={t} className="flex min-w-0 items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={form.tabs.includes(t)}
                          onChange={(e) => setTab(t, e.target.checked)}
                        />
                        <span className="truncate">{tabLabel(t)}</span>
                      </label>
                    ))}
                  </div>
                  <span className={hint}>
                    Shows only while one of these tabs is open, so only as a banner or
                    popup.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={label}>Lowest version</span>
                    <input
                      type="text"
                      value={form.minVersion}
                      placeholder="Any"
                      onChange={(e) => set("minVersion", e.target.value)}
                      className={`${input} font-mono text-xs`}
                    />
                  </label>
                  <label className="block">
                    <span className={label}>Highest version</span>
                    <input
                      type="text"
                      value={form.maxVersion}
                      placeholder="Any"
                      onChange={(e) => set("maxVersion", e.target.value)}
                      className={`${input} font-mono text-xs`}
                    />
                  </label>
                </div>
                {versionError ? (
                  <p className="-mt-2 text-[11px] text-red-600">{versionError}</p>
                ) : (
                  <p className="-mt-2 text-[11px] text-zinc-400">
                    Both included. For &quot;please update&quot;, set the highest to the
                    version before the new one.
                  </p>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.signedInOnly}
                    onChange={(e) => set("signedInOnly", e.target.checked)}
                  />
                  Signed-in users only
                </label>
                <div>
                  <span className={`${label} flex justify-between`}>
                    <span>Specific users (optional)</span>
                    {recipients.length > 0 && (
                      <span
                        className={
                          recipients.length > ANNOUNCEMENT_RECIPIENTS_MAX
                            ? "text-red-600"
                            : "text-zinc-400"
                        }
                      >
                        {recipients.length === 1 ? "1 person" : `${recipients.length} people`}
                      </span>
                    )}
                  </span>
                  <textarea
                    value={form.recipients}
                    rows={3}
                    placeholder="Emails, one per line or separated by commas"
                    onChange={(e) => set("recipients", e.target.value)}
                    className={`${input} font-mono text-xs`}
                    aria-invalid={badEmails.length || unknownShown.length ? true : undefined}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void justMe()} className={smallBtn}>
                      Just me
                    </button>
                    {meNote && <span className="text-[11px] text-red-600">{meNote}</span>}
                  </div>
                  {badEmails.length > 0 && (
                    <span className={bad}>Not an email address: {badEmails.join(", ")}</span>
                  )}
                  {recipients.length > ANNOUNCEMENT_RECIPIENTS_MAX && (
                    <span className={bad}>{ANNOUNCEMENT_ERROR_MESSAGE.too_many_recipients}</span>
                  )}
                  {unknownShown.length > 0 && (
                    <span className={bad}>No account has: {unknownShown.join(", ")}</span>
                  )}
                  <span className={hint}>
                    Only these people see it, and only while signed in. Leave empty for
                    everyone.
                  </span>
                </div>
                <p className="text-xs text-zinc-600">
                  <span className="font-medium">Shown to:</span> {audience}
                </p>
              </div>
            </fieldset>

            <fieldset className={fieldset}>
              <legend className={legend}>Schedule</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className={label}>Start</span>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="announcement-start"
                      checked={form.startMode === "now"}
                      onChange={() => set("startMode", "now")}
                    />
                    {isNew ? "Now" : "Now (restart it)"}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="announcement-start"
                      checked={form.startMode === "at"}
                      onChange={() => set("startMode", "at")}
                    />
                    At
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(e) => {
                      const value = e.target.value;
                      update(() => ({ startAt: value, startMode: "at" }));
                    }}
                    className={input}
                  />
                </div>
                <div className="space-y-1">
                  <span className={label}>End</span>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="announcement-end"
                      checked={form.endMode === "never"}
                      onChange={() => set("endMode", "never")}
                    />
                    When I end it
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="announcement-end"
                      checked={form.endMode === "at"}
                      onChange={() => set("endMode", "at")}
                    />
                    At
                  </label>
                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(e) => {
                      const value = e.target.value;
                      update(() => ({ endAt: value, endMode: "at" }));
                    }}
                    className={input}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                Times are in your time zone ({timeZone}).
              </p>
            </fieldset>

            {!isNew && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.showAgain}
                  onChange={(e) => set("showAgain", e.target.checked)}
                />
                <span>
                  Show again to people who dismissed it
                  <span className="block text-[11px] text-zinc-400">
                    Counts as a new revision. Leave it off for a typo fix.
                  </span>
                </span>
              </label>
            )}
          </div>

          <aside
            aria-label="Preview"
            className="border-t border-[var(--admin-border)] bg-zinc-50 p-4 lg:min-h-0 lg:w-[420px] lg:shrink-0 lg:overflow-auto lg:border-l lg:border-t-0"
          >
            <Preview
              form={form}
              imageSrc={imageSrc}
              place={previewPlace}
              onPlace={setPreviewPlace}
              locale={previewLocale}
              onLocale={setPreviewLocale}
            />
          </aside>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--admin-border)] px-4 py-3 text-xs">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {pending ? "Saving..." : isNew ? "Create" : "Save"}
          </button>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded px-2 py-1.5 text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : liveCode && form !== startForm ? (
            <span className="text-amber-700">{errorText(liveCode)}</span>
          ) : null}
        </footer>
      </div>
    </>
  );
}

// What every preview surface draws, already in the chosen language.
type Shown = {
  accent: string;
  icon: AnnouncementIcon;
  emoji: string;
  glyph: boolean;
  priority: AnnouncementPriority;
  title: string;
  body: string;
  buttons: string[];
  hasImage: boolean;
  imageSrc: string | null;
  closable: boolean;
};

// A rough copy of how the extension draws the message in each place, in the
// chosen language with the extension's English fallback. Only the places
// ticked under "Where it shows" can be picked.
function Preview({
  form,
  imageSrc,
  place,
  onPlace,
  locale,
  onLocale,
}: {
  form: Form;
  imageSrc: string | null;
  place: PreviewPlace;
  onPlace: (place: PreviewPlace) => void;
  locale: AnnouncementLocale;
  onLocale: (locale: AnnouncementLocale) => void;
}) {
  const ticked = PREVIEW_PLACES.filter((p) => form.placements.includes(p));
  const shown: PreviewPlace | undefined = ticked.includes(place) ? place : ticked[0];
  const s: Shown = {
    accent: ANNOUNCEMENT_THEME_COLOR[form.theme] ?? ANNOUNCEMENT_THEME_COLOR.blue,
    icon: form.icon,
    emoji: form.emoji,
    glyph: hasGlyph(form.icon, form.emoji),
    priority: form.priority,
    title: localizedAnnouncementText(form.title, locale),
    body: localizedAnnouncementText(form.body, locale),
    // A button with no label is dropped on save, so it is not drawn.
    buttons: form.buttons
      .map((b) => localizedAnnouncementText(b.label, locale))
      .filter(Boolean)
      .slice(0, ANNOUNCEMENT_BUTTONS_MAX),
    hasImage: form.imagePath !== null,
    imageSrc,
    closable: form.frequency !== "always",
  };
  const pill = (on: boolean, can = true) =>
    `rounded-md px-2 py-0.5 text-xs ${
      on
        ? "bg-zinc-900 font-medium text-white"
        : can
          ? "text-zinc-600 hover:bg-zinc-200"
          : "cursor-not-allowed text-zinc-300"
    }`;

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-zinc-600">Preview</p>
      <div role="group" aria-label="Place" className="mb-1.5 flex flex-wrap gap-1">
        {PREVIEW_PLACES.map((p) => {
          const can = ticked.includes(p);
          return (
            <button
              key={p}
              type="button"
              disabled={!can}
              aria-pressed={shown === p}
              title={can ? undefined : "Not ticked under Where it shows"}
              onClick={() => onPlace(p)}
              className={pill(shown === p, can)}
            >
              {PLACE_SHORT[p]}
            </button>
          );
        })}
      </div>
      <div role="group" aria-label="Language" className="mb-3 flex flex-wrap items-center gap-1">
        {ANNOUNCEMENT_LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={locale === l}
            title={ANNOUNCEMENT_LOCALE_LABEL[l]}
            onClick={() => onLocale(l)}
            className={pill(locale === l)}
          >
            {l.toUpperCase()}
          </button>
        ))}
        {locale !== "en" && (
          <span className="ml-1 text-[11px] text-zinc-400">English where blank</span>
        )}
      </div>

      {shown === undefined ? (
        <p className="rounded-md border border-dashed border-[var(--admin-border)] px-3 py-6 text-center text-xs text-zinc-400">
          Pick where it shows to preview it.
        </p>
      ) : shown === "banner" ? (
        <BannerPreview s={s} />
      ) : shown === "popup" ? (
        <PopupPreview s={s} />
      ) : (
        <LauncherPreview s={s} />
      )}

      <p className="mt-3 text-[11px] text-zinc-400">
        An approximation. The extension draws it in the user&apos;s own theme and
        language, and writes its own labels (like &quot;Got it&quot;) in that
        language too.
      </p>
    </div>
  );
}

function PreviewTitle({ text, className }: { text: string; className: string }) {
  return (
    <p className={`break-words font-semibold text-zinc-900 ${text ? "" : "opacity-50"} ${className}`}>
      {text || "Title"}
    </p>
  );
}

function PreviewBody({ text, className }: { text: string; className: string }) {
  return (
    <p
      className={`whitespace-pre-line break-words leading-relaxed text-zinc-700 ${text ? "" : "opacity-50"} ${className}`}
    >
      {text || "Message"}
    </p>
  );
}

function PreviewImage({ src, className }: { src: string | null; className: string }) {
  if (!src) {
    return (
      <div
        className={`flex h-20 items-center justify-center bg-zinc-100 text-[11px] text-zinc-400 ${className}`}
      >
        Image
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a blob URL of the picked or stored file; next/image adds nothing here
    <img
      src={src}
      alt=""
      className={`block max-h-[140px] w-full object-cover ${className}`}
    />
  );
}

// The first button is filled with the accent, the second outlined.
function PreviewButton({ label, accent, main }: { label: string; accent: string; main: boolean }) {
  return (
    <span
      className="inline-block max-w-[160px] truncate rounded-md border px-2.5 py-1 text-center text-xs font-medium"
      style={
        main
          ? { backgroundColor: accent, borderColor: accent, color: "#ffffff" }
          : { borderColor: accent, color: accent }
      }
    >
      {label}
    </span>
  );
}

function CloseX() {
  return (
    <span aria-hidden="true" className="shrink-0 px-1 text-sm leading-none text-zinc-400">
      {"\u00d7"}
    </span>
  );
}

// Icon (or emoji) and the priority's heading, in the accent colour.
function Kicker({ s }: { s: Shown }) {
  return (
    <p
      className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: s.accent }}
    >
      {s.glyph && <Glyph icon={s.icon} emoji={s.emoji} size={14} />}
      {KICKER[s.priority]}
    </p>
  );
}

function BannerPreview({ s }: { s: Shown }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-lg border p-3"
      style={{ borderColor: alpha(s.accent, 0.45), backgroundColor: alpha(s.accent, 0.08) }}
    >
      {s.glyph && (
        <span className="mt-0.5 shrink-0" style={{ color: s.accent }}>
          <Glyph icon={s.icon} emoji={s.emoji} size={18} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {s.hasImage && <PreviewImage src={s.imageSrc} className="mb-2 rounded-md" />}
        <PreviewTitle text={s.title} className="text-[13px]" />
        <PreviewBody text={s.body} className="mt-0.5 text-xs" />
      </div>
      {s.buttons.length > 0 && (
        <div className="flex shrink-0 flex-col items-stretch gap-1.5 self-center">
          {s.buttons.map((b, i) => (
            <PreviewButton key={i} label={b} accent={s.accent} main={i === 0} />
          ))}
        </div>
      )}
      {s.closable && <CloseX />}
    </div>
  );
}

function PopupPreview({ s }: { s: Shown }) {
  return (
    <div className="rounded-lg bg-black/30 p-4">
      <div
        className="mx-auto max-w-[440px] rounded-xl border-t-4 bg-white p-4 shadow-lg"
        style={{ borderTopColor: s.accent }}
      >
        <Kicker s={s} />
        {s.hasImage && <PreviewImage src={s.imageSrc} className="mt-3 rounded-lg" />}
        <PreviewTitle text={s.title} className="mt-2 text-base" />
        <PreviewBody text={s.body} className="mt-1 text-sm" />
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            Got it
          </span>
          {s.buttons.map((b, i) => (
            <PreviewButton key={i} label={b} accent={s.accent} main={i === 0} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LauncherPreview({ s }: { s: Shown }) {
  return (
    <div className="flex flex-col items-end gap-2">
      <div
        className="relative w-[300px] max-w-full rounded-lg border border-zinc-200 bg-white p-3 pr-7 shadow-md"
        style={{ borderLeftWidth: 3, borderLeftColor: s.accent }}
      >
        <Kicker s={s} />
        <PreviewTitle text={s.title} className="mt-1 text-sm" />
        <PreviewBody text={s.body} className="mt-0.5 line-clamp-3 text-xs" />
        <span className="absolute right-2 top-2.5">
          <CloseX />
        </span>
      </div>
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white shadow"
      >
        SL
      </span>
    </div>
  );
}
