"use client";

// Picks what is in a video: one opening, style and sound, any topics, and three
// yes/no flags (lib/social/tags.ts). Used by the planner's editor and by the
// tagging drawer on Stats. "New" adds a value of our own, which then shows as
// an option everywhere once something is saved with it.

import { useState } from "react";
import {
  TAG_FLAGS,
  TAG_GROUPS,
  TAG_MAX_LENGTH,
  TAG_MAX_TOPICS,
  type SocialTags,
  type TagGroupKey,
} from "@/lib/social/tags";

const chip = (on: boolean) =>
  `rounded-md border px-2.5 py-1 text-xs ${
    on
      ? "border-zinc-900 bg-zinc-900 text-white"
      : "border-[var(--admin-border)] text-zinc-600 hover:text-zinc-900"
  }`;

export function TagEditor({
  value,
  onChange,
  options,
}: {
  value: SocialTags;
  onChange: (next: SocialTags) => void;
  options: Record<TagGroupKey, string[]>;
}) {
  const set = (next: SocialTags) => onChange({ ...next, by: "you" });
  // Values added here before anything is saved with them.
  const [extra, setExtra] = useState<Partial<Record<TagGroupKey, string[]>>>({});
  const [adding, setAdding] = useState<TagGroupKey | null>(null);
  const [draft, setDraft] = useState("");

  const selected = (key: TagGroupKey): string[] =>
    key === "topics" ? (value.topics ?? []) : value[key] ? [value[key]!] : [];

  function toggle(key: TagGroupKey, option: string) {
    if (key === "topics") {
      const now = value.topics ?? [];
      const topics = now.includes(option)
        ? now.filter((t) => t !== option)
        : now.length < TAG_MAX_TOPICS
          ? [...now, option]
          : now;
      set({ ...value, topics: topics.length ? topics : undefined });
    } else {
      set({ ...value, [key]: value[key] === option ? undefined : option });
    }
  }

  function add(key: TagGroupKey) {
    const label = draft.trim().replace(/\s+/g, " ").slice(0, TAG_MAX_LENGTH);
    setAdding(null);
    setDraft("");
    if (!label) return;
    setExtra((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), label] }));
    if (!selected(key).includes(label)) toggle(key, label);
  }

  return (
    <div className="space-y-3">
      {TAG_GROUPS.map((g) => {
        const all = [...new Set([...options[g.key], ...(extra[g.key] ?? []), ...selected(g.key)])];
        return (
          <fieldset key={g.key} className="space-y-1.5">
            <legend className="text-xs font-medium text-zinc-600">
              {g.label}
              {g.hint && <span className="font-normal text-zinc-400"> {g.hint}</span>}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {all.map((o) => {
                const on = selected(g.key).includes(o);
                return (
                  <button key={o} type="button" aria-pressed={on} onClick={() => toggle(g.key, o)} className={chip(on)}>
                    {o}
                  </button>
                );
              })}
              {adding === g.key ? (
                <span className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={draft}
                    maxLength={TAG_MAX_LENGTH}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        add(g.key);
                      }
                      if (e.key === "Escape") setAdding(null);
                    }}
                    aria-label={`New ${g.label.toLowerCase()}`}
                    className="w-36 rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 text-xs text-zinc-900"
                  />
                  <button type="button" onClick={() => add(g.key)} className="rounded-md border border-[var(--admin-border)] px-2 py-1 text-xs text-zinc-700 hover:text-zinc-900">
                    Add
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(g.key);
                    setDraft("");
                  }}
                  className="rounded-md border border-dashed border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-900"
                >
                  New
                </button>
              )}
            </div>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {TAG_FLAGS.map((f) => (
          <label key={f.key} className="flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={!!value[f.key]}
              onChange={(e) => set({ ...value, [f.key]: e.target.checked || undefined })}
            />
            {f.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Tags as small chips: picked ones solid, automatic ones dashed. */
export function TagChips({ picked, auto = [] }: { picked: string[]; auto?: string[] }) {
  if (!picked.length && !auto.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {picked.map((t) => (
        <span key={`p:${t}`} className="rounded border border-[var(--admin-border)] px-1.5 text-[11px] text-zinc-600">
          {t}
        </span>
      ))}
      {auto.map((t) => (
        <span key={`a:${t}`} className="rounded border border-dashed border-[var(--admin-border)] px-1.5 text-[11px] text-zinc-500">
          {t}
        </span>
      ))}
    </span>
  );
}
