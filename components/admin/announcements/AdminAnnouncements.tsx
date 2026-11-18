"use client";

// Editor for the messages shown in users' SaleLinx extension (announcements,
// migration 060_announcements.sql). Three lists (live now, scheduled, the most
// recently ended) and a drawer to write one, with a preview of the banner the
// extension draws.
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
// the RPC's so mistakes show before saving; the RPC still decides.

import { useState, useTransition } from "react";
import { AdminRefreshButton } from "@/components/admin/AdminRefreshButton";
import { AdminSection } from "@/components/admin/AdminSection";
import { LocalTime } from "@/components/admin/social/LocalTime";
import { useClientNow } from "@/lib/admin/use-client-now";
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_CTA_LABEL_MAX,
  ANNOUNCEMENT_CTA_URL_MAX,
  ANNOUNCEMENT_LOCALES,
  ANNOUNCEMENT_PLATFORMS,
  ANNOUNCEMENT_PLATFORM_LABEL,
  ANNOUNCEMENT_SEVERITIES,
  ANNOUNCEMENT_TIERS,
  ANNOUNCEMENT_TIER_LABEL,
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENTS_ENDED_SHOWN,
  audienceSummary,
  charCount,
  ctaUrlOk,
  fromLocalInput,
  groupAnnouncements,
  localizedAnnouncementText,
  missingAnnouncementLocales,
  toLocalInput,
  trimText,
  validateAnnouncementDraft,
  versionOk,
  type Announcement,
  type AnnouncementDraft,
  type AnnouncementLocale,
  type AnnouncementPhase,
  type AnnouncementPlatform,
  type AnnouncementSeverity,
  type AnnouncementTextInput,
  type AnnouncementTier,
} from "@/lib/announcements/types";
import {
  deleteAnnouncement,
  endAnnouncement,
  saveAnnouncement,
  type AnnouncementResult,
} from "@/app/admin/(configuration)/announcements/actions";

const SEVERITY_LABEL: Record<AnnouncementSeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

const SEVERITY_HINT: Record<AnnouncementSeverity, string> = {
  info: "A banner in the panel.",
  warning:
    "A banner in the panel, plus a small card by the launcher tile while the panel is closed.",
  critical:
    'Shown once as a popup, then as a red banner. Also a card by the launcher tile and a red "!" on the toolbar icon.',
};

const SEVERITY_CHIP: Record<AnnouncementSeverity, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  critical: "border-red-200 bg-red-50 text-red-800",
};

// The extension's banner tints: info blue, warning amber, critical red.
const SEVERITY_BANNER: Record<AnnouncementSeverity, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-red-200 bg-red-50 text-red-900",
};

const SEVERITY_BUTTON: Record<AnnouncementSeverity, string> = {
  info: "bg-blue-600",
  warning: "bg-amber-600",
  critical: "bg-red-600",
};

const LOCALE_NAME: Record<AnnouncementLocale, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
};

// RPC error codes from 060_announcements.sql (plus the editor's own two), in
// words.
const ERROR_TEXT: Record<string, string> = {
  invalid_severity: "Pick a severity.",
  invalid_title: `The English title is required, and titles are capped at ${ANNOUNCEMENT_TITLE_MAX} characters in every language.`,
  invalid_body: `The English message is required, and messages are capped at ${ANNOUNCEMENT_BODY_MAX} characters in every language.`,
  invalid_cta: `A button needs both an English label (${ANNOUNCEMENT_CTA_LABEL_MAX} characters at most) and a URL. Leave both blank for no button.`,
  invalid_cta_url:
    "Button links must be https links to salelinx.com, the Chrome Web Store, Depop, Vinted or eBay, with no login details, port, spaces or backslashes.",
  invalid_audience: "The audience has a plan or marketplace this page does not know.",
  invalid_version:
    "Versions are up to four numbers separated by dots, like 1.6.2, and the lowest version cannot be above the highest.",
  invalid_schedule: "The end time must be after the start time.",
  missing_start: "Pick a start time, or start it now.",
  missing_end: "Pick an end time, or let it run until you end it.",
  not_found: "That announcement no longer exists. Refresh to see the current list.",
  id_taken: "An announcement with that id already exists. Refresh and try again.",
  "not authorized":
    "This session is not allowed to change announcements. Sign in again with your authenticator code.",
};

function errorText(code: string | undefined): string {
  if (!code) return "Something went wrong.";
  return ERROR_TEXT[code] ?? code;
}

type Message = { ok: boolean; text: string };

export function AdminAnnouncements({
  announcements,
  now,
  error,
}: {
  announcements: Announcement[];
  // The server's clock when it read the rows (ISO). Groups the first render,
  // so the server and the client agree, until the client's clock takes over.
  now: string;
  error: string | null;
}) {
  // undefined: closed. null: a new announcement.
  const [editing, setEditing] = useState<Announcement | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);
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

  function end(a: Announcement) {
    act(
      () => endAnnouncement(a.id),
      `Ended "${a.title.en}". Open extensions drop it within about 15 seconds.`,
    );
  }

  function remove(a: Announcement) {
    setConfirmDelete(null);
    act(
      () => deleteAnnouncement(a.id),
      `Deleted "${a.title.en}". The audit log keeps a copy.`,
    );
  }

  function open(a: Announcement | null) {
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
            onClick={() => open(null)}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700"
          >
            New announcement
          </button>
          <AdminRefreshButton />
        </div>
      </header>

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
            ? `Could not load announcements: ${error}. Has migration 060 been applied?`
            : message?.text}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="border-b border-[var(--admin-border)] px-4 py-3 text-xs leading-relaxed text-zinc-600">
          <p>
            Messages reach users who have the SaleLinx extension open within
            about 15 seconds (each install waits a random moment so they do not
            all refetch at once), and everyone else on their next marketplace
            page load. Plain text only; one optional button can link to
            salelinx.com, the Chrome Web Store, Depop, Vinted or eBay.
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            <li>Info and warning: a banner in the panel.</li>
            <li>
              Critical: shown once as a popup, then as a red banner, and a red
              &quot;!&quot; on the toolbar icon.
            </li>
            <li>
              Warning and critical: also a small card by the launcher tile while
              the panel is closed.
            </li>
          </ul>
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
  a: Announcement;
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
  const tag =
    "rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500";
  const textBtn =
    "rounded px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50";

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${SEVERITY_CHIP[a.severity]}`}
          >
            {SEVERITY_LABEL[a.severity]}
          </span>
          {!a.dismissible && <span className={tag}>Not dismissible</span>}
          {a.cta_url && <span className={tag}>Button</span>}
          {a.revision > 1 && (
            <span
              className={tag}
              title={`Shown again to people who dismissed it ${a.revision - 1} ${a.revision === 2 ? "time" : "times"}`}
            >
              Revision {a.revision}
            </span>
          )}
        </div>
        <p className="mt-1 break-words text-sm font-semibold">{a.title.en}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{audienceSummary(a)}</p>
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

// The editor's working copy. Times are datetime-local strings in the admin's
// own time zone until saving turns them into ISO.
type Form = {
  severity: AnnouncementSeverity;
  title: AnnouncementTextInput;
  body: AnnouncementTextInput;
  ctaLabel: AnnouncementTextInput;
  ctaUrl: string;
  dismissible: boolean;
  tiers: AnnouncementTier[];
  platforms: AnnouncementPlatform[];
  minVersion: string;
  maxVersion: string;
  signedInOnly: boolean;
  startMode: "now" | "at";
  startAt: string;
  endMode: "never" | "at";
  endAt: string;
  showAgain: boolean;
};

function formFrom(a: Announcement | null): Form {
  if (!a) {
    return {
      severity: "info",
      title: { en: "" },
      body: { en: "" },
      ctaLabel: { en: "" },
      ctaUrl: "",
      dismissible: true,
      tiers: [],
      platforms: [],
      minVersion: "",
      maxVersion: "",
      signedInOnly: false,
      startMode: "now",
      startAt: "",
      endMode: "never",
      endAt: "",
      showAgain: false,
    };
  }
  return {
    severity: a.severity,
    title: { ...a.title },
    body: { ...a.body },
    ctaLabel: a.cta_label ? { ...a.cta_label } : { en: "" },
    ctaUrl: a.cta_url ?? "",
    dismissible: a.dismissible,
    tiers: [...a.audience_tiers],
    platforms: [...a.audience_platforms],
    minVersion: a.min_version ?? "",
    maxVersion: a.max_version ?? "",
    signedInOnly: a.signed_in_only,
    // An existing one keeps its own start time unless "Now" is picked.
    startMode: "at",
    startAt: toLocalInput(a.starts_at),
    endMode: a.ends_at ? "at" : "never",
    endAt: a.ends_at ? toLocalInput(a.ends_at) : "",
    showAgain: false,
  };
}

// The draft the RPC takes, or the editor's own error code when a time that was
// asked for is missing.
function draftFrom(form: Form, id: string | null): AnnouncementDraft | "missing_start" | "missing_end" {
  const startsAt = form.startMode === "now" ? null : fromLocalInput(form.startAt);
  if (form.startMode === "at" && !startsAt) return "missing_start";
  const endsAt = form.endMode === "never" ? null : fromLocalInput(form.endAt);
  if (form.endMode === "at" && !endsAt) return "missing_end";

  const labelBlank = ANNOUNCEMENT_LOCALES.every((l) => !trimText(form.ctaLabel[l] ?? ""));
  return {
    id,
    severity: form.severity,
    title: form.title,
    body: form.body,
    cta_label: labelBlank ? null : form.ctaLabel,
    cta_url: trimText(form.ctaUrl) || null,
    dismissible: form.dismissible,
    audience_tiers: form.tiers,
    audience_platforms: form.platforms,
    min_version: trimText(form.minVersion) || null,
    max_version: trimText(form.maxVersion) || null,
    signed_in_only: form.signedInOnly,
    starts_at: startsAt,
    ends_at: endsAt,
  };
}

function toggle<T>(list: T[], value: T, on: boolean): T[] {
  return on ? [...list.filter((v) => v !== value), value] : list.filter((v) => v !== value);
}

function Editor({
  initial,
  onClose,
  onDone,
}: {
  initial: Announcement | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const isNew = initial === null;
  const [form, setForm] = useState<Form>(() => formFrom(initial));
  const [locale, setLocale] = useState<AnnouncementLocale>("en");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setText(field: "title" | "body" | "ctaLabel", value: string) {
    setForm((f) => ({ ...f, [field]: { ...f[field], [locale]: value } }));
  }

  function save() {
    setError(null);
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
      const res = await saveAnnouncement(draft, isNew, form.showAgain);
      if (!res.ok) {
        setError(errorText(res.error));
        return;
      }
      const title = trimText(form.title.en ?? "");
      onDone(
        isNew
          ? `Created "${title}". Open extensions pick it up within about 15 seconds.`
          : `Saved "${title}".${form.showAgain ? " People who dismissed it will see it again." : ""}`,
      );
    });
  }

  const url = trimText(form.ctaUrl);
  const urlError = url && !ctaUrlOk(url) ? ERROR_TEXT.invalid_cta_url : null;
  const min = trimText(form.minVersion);
  const max = trimText(form.maxVersion);
  const versionError =
    (min && !versionOk(min)) || (max && !versionOk(max)) ? ERROR_TEXT.invalid_version : null;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const audience = audienceSummary({
    audience_tiers: form.tiers,
    audience_platforms: form.platforms,
    min_version: min,
    max_version: max,
    signed_in_only: form.signedInOnly,
  });

  const input =
    "w-full rounded-md border border-[var(--admin-border)] px-2 py-1 text-sm disabled:bg-zinc-50";
  const label = "mb-1 block text-xs font-medium text-zinc-600";
  const hint = "mt-1 block text-[11px] text-zinc-400";
  const fieldset = "rounded-md border border-[var(--admin-border)] p-3";
  const legend = "px-1 text-xs font-medium text-zinc-600";
  const en = locale === "en";

  function counter(value: string | undefined, maxChars: number) {
    const n = charCount(trimText(value ?? ""));
    return (
      <span className={n > maxChars ? "text-red-600" : "text-zinc-400"}>
        {n}/{maxChars}
      </span>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "New announcement" : "Edit announcement"}
      className="fixed inset-y-0 right-0 z-20 flex w-full max-w-xl flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-4">
        <span className="min-w-0 truncate text-sm font-semibold">
          {initial ? initial.title.en : "New announcement"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 shrink-0 rounded p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Close editor"
        >
          x
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <div>
          <span className={label}>Severity</span>
          <div className="flex gap-1">
            {ANNOUNCEMENT_SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("severity", s)}
                className={
                  form.severity === s
                    ? "rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white"
                    : "rounded-md px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
                }
              >
                {SEVERITY_LABEL[s]}
              </button>
            ))}
          </div>
          <span className={hint}>{SEVERITY_HINT[form.severity]}</span>
        </div>

        <fieldset className={fieldset}>
          <legend className={legend}>Text</legend>
          <div className="mb-3 flex gap-1 border-b border-[var(--admin-border)]">
            {ANNOUNCEMENT_LOCALES.map((l) => {
              const filled = Boolean(trimText(form.title[l] ?? "") || trimText(form.body[l] ?? ""));
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
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
              : `${LOCALE_NAME[locale]} is optional. Any field left blank shows the English text.`}
          </p>

          <div className="space-y-3">
            <label className="block">
              <span className={`${label} flex justify-between`}>
                <span>Title ({LOCALE_NAME[locale]})</span>
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
                <span>Message ({LOCALE_NAME[locale]})</span>
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
            <label className="block">
              <span className={`${label} flex justify-between`}>
                <span>Button label ({LOCALE_NAME[locale]}, optional)</span>
                {counter(form.ctaLabel[locale], ANNOUNCEMENT_CTA_LABEL_MAX)}
              </span>
              <input
                type="text"
                value={form.ctaLabel[locale] ?? ""}
                maxLength={ANNOUNCEMENT_CTA_LABEL_MAX}
                placeholder={en ? "Update now" : form.ctaLabel.en || "Button label"}
                onChange={(e) => setText("ctaLabel", e.target.value)}
                className={input}
              />
            </label>
          </div>
        </fieldset>

        <label className="block">
          <span className={label}>Button link</span>
          <input
            type="url"
            inputMode="url"
            value={form.ctaUrl}
            maxLength={ANNOUNCEMENT_CTA_URL_MAX}
            placeholder="https://salelinx.com/docs/status"
            onChange={(e) => set("ctaUrl", e.target.value)}
            className={`${input} font-mono text-xs`}
            aria-invalid={urlError ? true : undefined}
          />
          {urlError ? (
            <span className="mt-1 block text-[11px] text-red-600">{urlError}</span>
          ) : (
            <span className={hint}>
              One link for every language. Fill in both the label and the link for a
              button, or leave both blank for none.
            </span>
          )}
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.dismissible}
            onChange={(e) => set("dismissible", e.target.checked)}
          />
          <span>
            Users can dismiss it
            <span className="block text-[11px] text-zinc-400">
              Turn off for an ongoing outage, so the notice stays up until you end it.
            </span>
          </span>
        </label>

        <fieldset className={fieldset}>
          <legend className={legend}>Audience</legend>
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
                  set("startAt", e.target.value);
                  set("startMode", "at");
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
                  set("endAt", e.target.value);
                  set("endMode", "at");
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

        <div>
          <span className={label}>
            Preview ({LOCALE_NAME[locale]}
            {en ? "" : ", English where blank"})
          </span>
          <Preview form={form} locale={locale} />
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--admin-border)] px-4 py-3 text-xs">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving..." : isNew ? "Create" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded px-2 py-1.5 text-zinc-600 hover:bg-zinc-100"
        >
          Cancel
        </button>
        {error && <span className="text-red-600">{error}</span>}
      </footer>
    </div>
  );
}

// The banner as the extension draws it, in the chosen language with the
// extension's English fallback.
function Preview({ form, locale }: { form: Form; locale: AnnouncementLocale }) {
  const title = localizedAnnouncementText(form.title, locale);
  const body = localizedAnnouncementText(form.body, locale);
  const buttonLabel = localizedAnnouncementText(form.ctaLabel, locale);
  const showButton = Boolean(buttonLabel && trimText(form.ctaUrl));

  return (
    <div
      className={`relative rounded-md border p-3 ${form.dismissible ? "pr-9" : ""} ${SEVERITY_BANNER[form.severity]}`}
    >
      <p className={`break-words text-sm font-semibold ${title ? "" : "opacity-50"}`}>
        {title || "Title"}
      </p>
      <p
        className={`mt-1 whitespace-pre-line break-words text-xs leading-relaxed ${body ? "" : "opacity-50"}`}
      >
        {body || "Message"}
      </p>
      {showButton && (
        <span
          className={`mt-2 inline-block rounded px-2.5 py-1 text-xs font-medium text-white ${SEVERITY_BUTTON[form.severity]}`}
        >
          {buttonLabel}
        </span>
      )}
      {form.dismissible && (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-xs leading-none opacity-60"
        >
          x
        </span>
      )}
    </div>
  );
}
