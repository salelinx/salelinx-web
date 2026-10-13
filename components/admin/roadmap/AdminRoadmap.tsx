"use client";

// Board editor for the public roadmap (roadmap_items, migration
// 032_roadmap_items.sql). Three columns mirroring the homepage section; each
// card can be reordered within its column, moved to the next or previous
// column, or opened in the editor drawer.
//
// Writes go through server actions that call the is_admin()-gated RPCs, which
// are the security boundary and write their own audit entries (each one
// records the whole old row, so every edit, including a delete, is
// reversible from the audit log). For that reason nothing here asks for
// step-up reauth: it is reserved for actions the log cannot undo.
//
// Copy is English-first. Translations are optional; a blank locale falls back
// to English on the site, and cards with gaps say which locales are missing.

import { useState, useTransition } from "react";
import { AdminRefreshButton } from "@/components/admin/AdminRefreshButton";
import type { Marketplace } from "@/lib/docs/types";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/locales";
import {
  ROADMAP_MARKETPLACES,
  ROADMAP_STATUSES,
  ROADMAP_TAGS,
  itemsByStatus,
  missingLocales,
  roadmapMeta,
  type LocalizedText,
  type RoadmapItem,
  type RoadmapStatus,
  type RoadmapTagKey,
} from "@/lib/roadmap/types";
import {
  deleteRoadmapItem,
  reorderRoadmapItems,
  saveRoadmapItem,
  type RoadmapDraft,
  type RoadmapResult,
} from "@/app/admin/roadmap/actions";

const STATUS_LABEL: Record<RoadmapStatus, string> = {
  exploring: "Exploring",
  building: "Building",
  shipped: "Shipped",
};

const STATUS_DOT: Record<RoadmapStatus, string> = {
  exploring: "bg-zinc-400",
  building: "bg-amber-500",
  shipped: "bg-emerald-500",
};

// Local copy: lib/docs/status has the same map but also pulls in server-only
// loaders, which a Client Component cannot import.
const MARKETPLACE_LABEL: Record<Marketplace, string> = {
  depop: "Depop",
  vinted: "Vinted",
};

const TAG_LABEL: Record<RoadmapTagKey, string> = {
  inventory: "Inventory",
  automation: "Automation",
  ai: "AI",
  insights: "Insights",
  marketplaces: "Marketplaces",
};

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 400;

// RPC error codes from 032_roadmap_items.sql, in words.
const ERROR_TEXT: Record<string, string> = {
  invalid_id:
    "ID must be lowercase letters and numbers joined by single hyphens, 60 characters at most.",
  id_taken: "A card with that ID already exists.",
  not_found: "That card no longer exists. Refresh to see the current roadmap.",
  stale_order:
    "The roadmap changed since this page loaded. Refresh and try again.",
  title_required: "The English title is required.",
  description_required: "The English description is required.",
  title_too_long: `Titles are capped at ${TITLE_MAX} characters.`,
  description_too_long: `Descriptions are capped at ${DESCRIPTION_MAX} characters.`,
  invalid_target_quarter: "Target quarter is not valid.",
  invalid_shipped_month: "Shipped month is not valid.",
};

function errorText(code: string | undefined): string {
  if (!code) return "Something went wrong.";
  return ERROR_TEXT[code] ?? code;
}

// The card footer as the English site renders it.
function metaLabel(item: Pick<RoadmapItem, "status" | "target_quarter" | "shipped_month">): string {
  const meta = roadmapMeta(item);
  switch (meta.key) {
    case "scoping":
      return "Scoping";
    case "inDevelopment":
      return "In development";
    case "shippedUndated":
      return "Shipped";
    case "target":
      return `Target Q${meta.quarter} ${meta.year}`;
    case "shipped":
      return `Shipped ${meta.month.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })}`;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

const BLANK_DRAFT: RoadmapDraft = {
  id: "",
  status: "exploring",
  tag: null,
  marketplaces: [],
  title: { en: "" },
  description: { en: "" },
  target_quarter: null,
  shipped_month: null,
  // New cards start hidden so translations can be filled in before they go
  // public. Publishing is one checkbox away.
  visible: false,
};

type Editing = { draft: RoadmapDraft; isNew: boolean };

export function AdminRoadmap({
  items,
  error,
}: {
  items: RoadmapItem[];
  error: string | null;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  function act(work: () => Promise<RoadmapResult>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await work();
      setMessage(
        res.ok ? { ok: true, text: success } : { ok: false, text: errorText(res.error) },
      );
    });
  }

  function move(item: RoadmapItem, offset: -1 | 1) {
    const column = itemsByStatus(items, item.status).map((i) => i.id);
    const from = column.indexOf(item.id);
    const to = from + offset;
    if (to < 0 || to >= column.length) return;
    [column[from], column[to]] = [column[to], column[from]];
    act(
      () => reorderRoadmapItems(item.status, column),
      `Moved "${item.title.en}" ${offset < 0 ? "up" : "down"}.`,
    );
  }

  function shift(item: RoadmapItem, offset: -1 | 1) {
    const next = ROADMAP_STATUSES[ROADMAP_STATUSES.indexOf(item.status) + offset];
    if (!next) return;
    act(
      () => saveRoadmapItem({ ...item, status: next }, false),
      `Moved "${item.title.en}" to ${STATUS_LABEL[next]}.`,
    );
  }

  const hiddenCount = items.filter((i) => !i.visible).length;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Roadmap
          <span className="ml-2 font-normal text-zinc-400">
            {items.length} cards
            {hiddenCount > 0 ? `, ${hiddenCount} hidden` : ""}
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-zinc-500 md:block">
            Shown on /roadmap and at the bottom of the homepage. Changes appear
            on the next page load.
          </p>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setEditing({ draft: BLANK_DRAFT, isNew: true });
            }}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700"
          >
            New card
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
            ? `Could not load roadmap_items: ${error}. Has migration 032 been applied?`
            : message?.text}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {ROADMAP_STATUSES.map((status, col) => {
            const column = itemsByStatus(items, status);
            return (
              <section key={status} className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 px-1 text-xs font-semibold text-zinc-700">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                  {STATUS_LABEL[status]}
                  <span className="font-normal text-zinc-400">{column.length}</span>
                </h2>
                {column.length === 0 && (
                  <p className="rounded-md border border-dashed border-[var(--admin-border)] px-3 py-6 text-center text-xs text-zinc-400">
                    No cards. The site shows &quot;Nothing here yet.&quot;
                  </p>
                )}
                {column.map((item, i) => (
                  <Card
                    key={item.id}
                    item={item}
                    disabled={pending}
                    canUp={i > 0}
                    canDown={i < column.length - 1}
                    canLeft={col > 0}
                    canRight={col < ROADMAP_STATUSES.length - 1}
                    onUp={() => move(item, -1)}
                    onDown={() => move(item, 1)}
                    onLeft={() => shift(item, -1)}
                    onRight={() => shift(item, 1)}
                    onEdit={() => {
                      setMessage(null);
                      setEditing({ draft: { ...item }, isNew: false });
                    }}
                  />
                ))}
              </section>
            );
          })}
        </div>
      </div>

      {editing && (
        <Editor
          key={editing.isNew ? "new" : editing.draft.id}
          initial={editing.draft}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onDone={(text) => {
            setEditing(null);
            setMessage({ ok: true, text });
          }}
        />
      )}
    </div>
  );
}

function Card({
  item,
  disabled,
  canUp,
  canDown,
  canLeft,
  canRight,
  onUp,
  onDown,
  onLeft,
  onRight,
  onEdit,
}: {
  item: RoadmapItem;
  disabled: boolean;
  canUp: boolean;
  canDown: boolean;
  canLeft: boolean;
  canRight: boolean;
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
  onEdit: () => void;
}) {
  const missing = missingLocales(item);
  const btn =
    "rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <article
      className={
        "rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 " +
        (item.visible ? "" : "border-dashed opacity-70")
      }
    >
      <div className="flex flex-wrap items-center gap-1">
        {!item.visible && (
          <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            Hidden
          </span>
        )}
        {item.marketplaces.map((m) => (
          <span
            key={m}
            className="rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500"
          >
            {MARKETPLACE_LABEL[m]}
          </span>
        ))}
        {item.tag && (
          <span className="rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
            {TAG_LABEL[item.tag]}
          </span>
        )}
      </div>
      <h3 className="mt-2 text-sm font-semibold">{item.title.en}</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
        {item.description.en}
      </p>
      <p className="mt-2 text-[11px] uppercase tracking-wide text-zinc-400">
        {metaLabel(item)}
      </p>
      {missing.length > 0 && (
        <p className="mt-1 text-[11px] text-amber-700">
          English shown for: {missing.map((l) => l.toUpperCase()).join(", ")}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-[var(--admin-border)] pt-2">
        <div className="flex items-center gap-0.5">
          <button type="button" className={btn} disabled={disabled || !canLeft} onClick={onLeft} title="Move to previous column" aria-label="Move to previous column">
            &larr;
          </button>
          <button type="button" className={btn} disabled={disabled || !canUp} onClick={onUp} title="Move up" aria-label="Move up">
            &uarr;
          </button>
          <button type="button" className={btn} disabled={disabled || !canDown} onClick={onDown} title="Move down" aria-label="Move down">
            &darr;
          </button>
          <button type="button" className={btn} disabled={disabled || !canRight} onClick={onRight} title="Move to next column" aria-label="Move to next column">
            &rarr;
          </button>
        </div>
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="rounded px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
        >
          Edit
        </button>
      </div>
    </article>
  );
}

// Quarter choices: last year through two years out, plus whatever is stored
// if it falls outside that window, so opening an old card never loses its
// value.
function quarterOptions(current: string | null): string[] {
  const year = new Date().getUTCFullYear();
  const out: string[] = [];
  for (let y = year - 1; y <= year + 2; y++) {
    for (let q = 1; q <= 4; q++) out.push(`${y}-Q${q}`);
  }
  if (current && !out.includes(current)) out.unshift(current);
  return out;
}

const TRANSLATED_LOCALES = LOCALES.filter((l) => l !== "en");

function Editor({
  initial,
  isNew,
  onClose,
  onDone,
}: {
  initial: RoadmapDraft;
  isNew: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [draft, setDraft] = useState<RoadmapDraft>(initial);
  // Until the ID is typed by hand, a new card's ID follows its English title.
  const [idTouched, setIdTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof RoadmapDraft>(key: K, value: RoadmapDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setText(
    field: "title" | "description",
    locale: Locale,
    value: string,
  ) {
    setDraft((d) => {
      const next = { ...d, [field]: { ...d[field], [locale]: value } as LocalizedText };
      if (isNew && !idTouched && field === "title" && locale === "en") {
        next.id = slugify(value);
      }
      return next;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveRoadmapItem(draft, isNew);
      if (!res.ok) {
        setError(errorText(res.error));
        return;
      }
      onDone(
        isNew
          ? `Created "${draft.title.en.trim()}"${draft.visible ? "" : " (hidden)"}.`
          : `Saved "${draft.title.en.trim()}".`,
      );
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteRoadmapItem(draft.id);
      if (!res.ok) {
        setError(errorText(res.error));
        return;
      }
      onDone(`Deleted "${initial.title.en}". The audit log keeps a copy.`);
    });
  }

  const input =
    "w-full rounded-md border border-[var(--admin-border)] px-2 py-1 text-sm disabled:bg-zinc-50";
  const label = "mb-1 block text-xs font-medium text-zinc-600";
  const shipped = draft.status === "shipped";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "New roadmap card" : "Edit roadmap card"}
      className="fixed inset-y-0 right-0 z-20 flex w-full max-w-xl flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-4">
        <span className="text-sm font-semibold">
          {isNew ? "New roadmap card" : initial.title.en}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Close editor"
        >
          x
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Column</span>
            <div className="flex gap-1">
              {ROADMAP_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status", s)}
                  className={
                    draft.status === s
                      ? "rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white"
                      : "rounded-md px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
                  }
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-end gap-2 pb-1 text-sm">
            <input
              type="checkbox"
              checked={draft.visible}
              onChange={(e) => set("visible", e.target.checked)}
            />
            Show on the homepage
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Tag</span>
            <select
              value={draft.tag ?? ""}
              onChange={(e) =>
                set("tag", (e.target.value || null) as RoadmapTagKey | null)
              }
              className={input}
            >
              <option value="">None</option>
              {ROADMAP_TAGS.map((t) => (
                <option key={t} value={t}>
                  {TAG_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className={label}>Marketplaces</span>
            <div className="flex gap-3 py-1">
              {ROADMAP_MARKETPLACES.map((m) => (
                <label key={m} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.marketplaces.includes(m)}
                    onChange={(e) =>
                      set(
                        "marketplaces",
                        e.target.checked
                          ? [...draft.marketplaces, m]
                          : draft.marketplaces.filter((x) => x !== m),
                      )
                    }
                  />
                  {MARKETPLACE_LABEL[m]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {shipped ? (
            <label className="block">
              <span className={label}>Shipped month</span>
              <input
                type="month"
                value={draft.shipped_month ?? ""}
                onChange={(e) => set("shipped_month", e.target.value || null)}
                className={input}
              />
            </label>
          ) : (
            <label className="block">
              <span className={label}>Target quarter</span>
              <select
                value={draft.target_quarter ?? ""}
                onChange={(e) => set("target_quarter", e.target.value || null)}
                className={input}
              >
                <option value="">None</option>
                {quarterOptions(draft.target_quarter).map((q) => (
                  <option key={q} value={q}>
                    {q.replace(/^(\d{4})-(Q\d)$/, "$2 $1")}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div>
            <span className={label}>Card footer</span>
            <p className="py-1 text-xs uppercase tracking-wide text-zinc-500">
              {metaLabel(draft)}
            </p>
          </div>
        </div>

        <label className="block">
          <span className={label}>Title (English)</span>
          <input
            type="text"
            value={draft.title.en}
            maxLength={TITLE_MAX}
            onChange={(e) => setText("title", "en", e.target.value)}
            className={input}
          />
        </label>
        <label className="block">
          <span className={label}>Description (English)</span>
          <textarea
            value={draft.description.en}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            onChange={(e) => setText("description", "en", e.target.value)}
            className={input}
          />
        </label>

        <label className="block">
          <span className={label}>ID</span>
          <input
            type="text"
            value={draft.id}
            disabled={!isNew}
            maxLength={60}
            onChange={(e) => {
              setIdTouched(true);
              set("id", e.target.value);
            }}
            className={`${input} font-mono text-xs`}
          />
          <span className="mt-1 block text-[11px] text-zinc-400">
            {isNew
              ? "Never shown on the site. Lowercase, hyphenated. Cannot be changed later."
              : "Fixed once created."}
          </span>
        </label>

        <fieldset className="rounded-md border border-[var(--admin-border)] p-3">
          <legend className="px-1 text-xs font-medium text-zinc-600">
            Translations
          </legend>
          <p className="mb-3 text-[11px] text-zinc-500">
            Optional. Any field left blank shows the English text in that
            language.
          </p>
          <div className="space-y-3">
            {TRANSLATED_LOCALES.map((l) => (
              <div key={l} className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">
                  {LOCALE_LABELS[l].name}
                </span>
                <input
                  type="text"
                  value={draft.title[l] ?? ""}
                  maxLength={TITLE_MAX}
                  placeholder={draft.title.en || "Title"}
                  dir={l === "ar" ? "rtl" : undefined}
                  onChange={(e) => setText("title", l, e.target.value)}
                  className={input}
                />
                <textarea
                  value={draft.description[l] ?? ""}
                  maxLength={DESCRIPTION_MAX}
                  rows={2}
                  placeholder={draft.description.en || "Description"}
                  dir={l === "ar" ? "rtl" : undefined}
                  onChange={(e) => setText("description", l, e.target.value)}
                  className={input}
                />
              </div>
            ))}
          </div>
        </fieldset>
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

        {!isNew && (
          <div className="ml-auto flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-zinc-600">
                  Delete for good? Unticking &quot;Show on the homepage&quot; hides it instead.
                </span>
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="rounded bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={pending}
                  className="rounded px-2 py-1.5 text-zinc-600 hover:bg-zinc-100"
                >
                  Keep
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                className="rounded px-2 py-1.5 text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}
