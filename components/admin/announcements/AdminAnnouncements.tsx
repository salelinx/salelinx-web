"use client";

// /admin/announcements: the messages shown in users' SaleLinx extension
// (announcements, migration 064_announcements.sql). Three lists (live now,
// scheduled, the most recently ended), a strip to send yourself a test, and
// the editor sheet (AnnouncementEditor.tsx) with its live preview.
//
// Each row reads like the message itself: its colour, icon, title and the
// start of its text, then where it shows, who sees it and when.
//
// Writes go through server actions that call the is_admin()-gated RPCs, which
// are the security boundary and write their own audit entries (each records
// the whole old row, so an edit or a delete is reversible from the log). As on
// the roadmap, that is why a delete asks for a confirm rather than step-up
// reauth. Every write bumps announcement_signal, which is what pushes the
// change to the extensions that are open.

import { useState, useTransition } from "react";
import { AdminRefreshButton } from "@/components/admin/AdminRefreshButton";
import { AdminSection } from "@/components/admin/AdminSection";
import { LocalTime } from "@/components/admin/social/LocalTime";
import { IconClock, IconPencil, IconPlus, IconTrash, IconX } from "@/components/admin/social/icons";
import { useClientNow } from "@/lib/admin/use-client-now";
import {
  ANNOUNCEMENT_EDITOR_PLACEMENTS,
  ANNOUNCEMENT_FREQUENCIES,
  ANNOUNCEMENT_FREQUENCY_LABEL,
  ANNOUNCEMENT_LOCALES,
  ANNOUNCEMENT_LOCALE_LABEL,
  ANNOUNCEMENT_PLACEMENT_LABEL,
  ANNOUNCEMENT_PRESETS,
  ANNOUNCEMENT_PRIORITY_LABEL,
  ANNOUNCEMENT_THEME_COLOR,
  ANNOUNCEMENTS_ENDED_SHOWN,
  audienceSummary,
  editorPlacements,
  groupAnnouncements,
  missingAnnouncementLocales,
  togglePlacement,
  type AnnouncementFrequency,
  type AnnouncementPhase,
  type AnnouncementPlacement,
  type AnnouncementPreset,
  type AnnouncementRow,
} from "@/lib/announcements/types";
import {
  deleteAnnouncement,
  endAnnouncement,
  sendTestAnnouncement,
  type AnnouncementResult,
} from "@/app/admin/(configuration)/announcements/actions";
import type { TestOptions } from "@/lib/announcements/test-messages";
import { Editor } from "./AnnouncementEditor";
import {
  ChipToggle,
  Glyph,
  GlyphTile,
  IconGlobe,
  IconLayout,
  IconRepeat,
  IconSend,
  IconStop,
  IconUsers,
  PLACE_SHORT,
  alpha,
  errorText,
  ghostButton,
  listSentence,
  primaryButton,
  secondaryButton,
} from "./parts";

const PRIORITY_BADGE: Record<string, string> = {
  high: "border-amber-200 bg-amber-50 text-amber-800",
  urgent: "border-red-200 bg-red-50 text-red-700",
};

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
    act(() => deleteAnnouncement(a.id), `Deleted "${a.title.en}". The audit log keeps a copy.`);
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

  const sections: {
    phase: AnnouncementPhase;
    title: string;
    empty: string;
    defaultOpen: boolean;
  }[] = [
    {
      phase: "live",
      title: "Live now",
      empty: "Nothing is live. Users see no announcements right now.",
      defaultOpen: true,
    },
    { phase: "scheduled", title: "Scheduled", empty: "Nothing scheduled.", defaultOpen: true },
    { phase: "ended", title: "Ended", empty: "Nothing has ended yet.", defaultOpen: false },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold">Announcements</h1>
          <p className="text-xs text-zinc-500">
            Messages in users&apos; SaleLinx extension. Open extensions update within about 15
            seconds, the rest on their next marketplace page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={testing}
            onClick={() => setTesting((t) => !t)}
            className={`${secondaryButton} ${testing ? "border-zinc-400 bg-zinc-50" : ""}`}
          >
            <IconSend size={13} />
            Send me a test
          </button>
          <button type="button" onClick={() => open(null)} className={primaryButton}>
            <IconPlus size={14} />
            New announcement
          </button>
          <AdminRefreshButton />
        </div>
      </header>

      {testing && (
        <QuickTest
          disabled={pending || !!error}
          onSend={sendTest}
          onClose={() => setTesting(false)}
        />
      )}

      {(error || message) && (
        <div
          role="status"
          className={`flex shrink-0 items-start gap-2 border-b border-[var(--admin-border)] px-4 py-2 text-xs ${
            error || !message?.ok ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          <span className="min-w-0 flex-1">
            {error
              ? `Could not load announcements: ${error}. Has migration 064 been applied?`
              : message?.text}
          </span>
          {!error && (
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setMessage(null)}
              className="-my-0.5 rounded p-0.5 opacity-70 hover:opacity-100"
            >
              <IconX size={14} />
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {sections.map((s) => {
          const rows = groups[s.phase];
          return (
            <AdminSection
              key={s.phase}
              storageKey={`announcements-${s.phase}`}
              title={s.title}
              defaultOpen={s.defaultOpen}
              summary={
                s.phase === "ended" && rows.length >= ANNOUNCEMENTS_ENDED_SHOWN
                  ? `Latest ${ANNOUNCEMENTS_ENDED_SHOWN}`
                  : `${rows.length}`
              }
            >
              {rows.length === 0 ? (
                <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--admin-border)] px-4 py-4 text-xs text-zinc-500">
                  <span>{s.empty}</span>
                  {s.phase === "live" && !error && (
                    <button type="button" onClick={() => open(null)} className={secondaryButton}>
                      <IconPlus size={13} />
                      New announcement
                    </button>
                  )}
                </div>
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

// Send yourself a real message in a few clicks, to see each template, place
// and frequency in your own extension. A template fills in its usual places
// and frequency, which can then be changed.
function QuickTest({
  disabled,
  onSend,
  onClose,
}: {
  disabled: boolean;
  onSend: (options: TestOptions) => void;
  onClose: () => void;
}) {
  const first = ANNOUNCEMENT_PRESETS[0];
  const [preset, setPreset] = useState<AnnouncementPreset>(first);
  const [places, setPlaces] = useState<AnnouncementPlacement[]>(editorPlacements(first.placements));
  const [frequency, setFrequency] = useState<AnnouncementFrequency>(first.frequency);

  function pick(p: AnnouncementPreset) {
    setPreset(p);
    setPlaces(editorPlacements(p.placements));
    setFrequency(p.frequency);
  }

  return (
    <section
      aria-labelledby="announcement-test-title"
      className="slx-fade shrink-0 border-b border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="announcement-test-title" className="text-[13px] font-semibold">
            Send yourself a test
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            A real message to your account only, with sample text in English and French. It ends
            by itself after an hour and shows below with a &quot;Test:&quot; title.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close the test"
          onClick={onClose}
          className="-mr-1 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-700">Template</span>
          <div role="group" aria-label="Template" className="flex flex-wrap gap-1.5">
            {ANNOUNCEMENT_PRESETS.map((p) => {
              const on = preset.key === p.key;
              const color = ANNOUNCEMENT_THEME_COLOR[p.theme];
              return (
                <button
                  key={p.key}
                  type="button"
                  title={p.hint}
                  aria-pressed={on}
                  onClick={() => pick(p)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                    on ? "font-medium text-zinc-900" : "border-[var(--admin-border)] text-zinc-600 hover:border-zinc-400"
                  }`}
                  style={on ? { borderColor: color, backgroundColor: alpha(color, 0.1) } : undefined}
                >
                  <span style={{ color }}>
                    <Glyph icon={p.icon} emoji={null} size={13} />
                  </span>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-700">Where it shows</span>
          <div className="flex flex-wrap gap-1.5">
            {ANNOUNCEMENT_EDITOR_PLACEMENTS.map((p) => (
              <ChipToggle
                key={p}
                checked={places.includes(p)}
                title={ANNOUNCEMENT_PLACEMENT_LABEL[p]}
                onChange={(on) => setPlaces(togglePlacement(places, p, on, []))}
              >
                {PLACE_SHORT[p]}
              </ChipToggle>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-700">How often</span>
          <select
            className="rounded-md border border-[var(--admin-border)] bg-white px-2 py-1.5 text-xs text-zinc-800"
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
          className={primaryButton}
        >
          <IconSend size={13} />
          Send to me
        </button>
      </div>
    </section>
  );
}

// One fact about a message, with its icon.
function Fact({ icon, children, tone = "" }: { icon: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${tone}`}>
      <span className="shrink-0 text-zinc-400">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </span>
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
  const ended = phase === "ended";
  const missing = ended ? [] : missingAnnouncementLocales(a);
  const color = ANNOUNCEMENT_THEME_COLOR[a.theme] ?? ANNOUNCEMENT_THEME_COLOR.blue;
  const places = a.placements
    .filter((p) => (ANNOUNCEMENT_EDITOR_PLACEMENTS as readonly string[]).includes(p))
    .map((p, i) => (i === 0 ? PLACE_SHORT[p] : PLACE_SHORT[p].toLowerCase()));

  return (
    <li className="group relative flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-start">
      <span
        aria-hidden="true"
        className="absolute inset-y-3 left-0 w-[3px] rounded-r"
        style={{ backgroundColor: ended ? alpha(color, 0.35) : color }}
      />
      <div className={`flex min-w-0 flex-1 gap-3 ${ended ? "opacity-70" : ""}`}>
        <GlyphTile icon={a.icon} emoji={a.emoji} accent={color} size={34} faded={ended} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={onEdit}
              className="min-w-0 break-words text-left text-sm font-semibold text-zinc-900 hover:underline"
            >
              {a.title.en}
            </button>
            {a.priority !== "normal" && (
              <span
                className={`rounded-full border px-2 py-px text-[11px] font-medium ${PRIORITY_BADGE[a.priority]}`}
              >
                {ANNOUNCEMENT_PRIORITY_LABEL[a.priority]}
              </span>
            )}
            {a.revision > 1 && (
              <span
                className="rounded-full border border-[var(--admin-border)] px-2 py-px text-[11px] text-zinc-500"
                title={`Shown again to people who closed it ${a.revision - 1} ${a.revision === 2 ? "time" : "times"}`}
              >
                Revision {a.revision}
              </span>
            )}
          </div>
          {a.body.en && <p className="mt-0.5 line-clamp-1 text-[13px] text-zinc-500">{a.body.en}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-zinc-600">
            <Fact icon={<IconLayout size={13} />}>{listSentence(places)}</Fact>
            <Fact icon={<IconUsers size={13} />}>{audienceSummary(a)}</Fact>
            <Fact icon={<IconRepeat size={13} />}>
              {ANNOUNCEMENT_FREQUENCY_LABEL[a.frequency] ?? a.frequency}
            </Fact>
            <Fact icon={<IconClock size={13} />}>
              {ended ? (
                <>
                  Ended <LocalTime iso={a.ends_at ?? a.updated_at} />
                </>
              ) : phase === "scheduled" ? (
                <>
                  Starts <LocalTime iso={a.starts_at} />
                  {a.ends_at && (
                    <>
                      , ends <LocalTime iso={a.ends_at} />
                    </>
                  )}
                </>
              ) : a.ends_at ? (
                <>
                  Ends <LocalTime iso={a.ends_at} />
                </>
              ) : (
                "Until you end it"
              )}
            </Fact>
            {missing.length > 0 && (
              <Fact icon={<IconGlobe size={13} />} tone="text-zinc-500">
                {missing.length === ANNOUNCEMENT_LOCALES.length - 1
                  ? "English only"
                  : `Not in ${listSentence(missing.map((l) => ANNOUNCEMENT_LOCALE_LABEL[l]))}`}
              </Fact>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 pl-[46px] sm:pl-0">
        {confirming ? (
          <>
            <span className="mr-1 text-xs text-zinc-600">
              {ended ? "Delete for good?" : "Delete for good? End now takes it down instead."}
            </span>
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
            <button type="button" onClick={onKeep} disabled={disabled} className={ghostButton}>
              Keep
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEdit} disabled={disabled} className={secondaryButton}>
              <IconPencil size={13} />
              Edit
            </button>
            {!ended && (
              <button
                type="button"
                onClick={onEnd}
                disabled={disabled}
                title={phase === "live" ? "Take it down now" : "Cancel it: it will never start"}
                className={ghostButton}
              >
                <IconStop size={13} />
                End now
              </button>
            )}
            <button
              type="button"
              onClick={onAskDelete}
              disabled={disabled}
              aria-label={`Delete "${a.title.en}"`}
              title="Delete"
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <IconTrash size={14} />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
