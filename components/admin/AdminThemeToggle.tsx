"use client";

// Light / Dark / System for the admin console, in the sidebar footer (and the
// phone More sheet, which renders the same footer). Dark unless picked
// otherwise, as the console was dark-only before. The choice is read through
// useSyncExternalStore so the server render and hydration agree (nothing is
// selected until the client knows), then the page switches by setting
// data-admin-theme on <html>, which app/admin/admin.css keys the dark palette
// off. The <head> script in app/admin/layout.tsx does the same before first
// paint.

import { useEffect, useSyncExternalStore } from "react";
import { ADMIN_THEME_KEY, type AdminThemeChoice } from "@/lib/admin/theme";

const CHOICES: { value: AdminThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function read(): AdminThemeChoice {
  try {
    const v = localStorage.getItem(ADMIN_THEME_KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another admin tab changing it.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function applyAdminTheme(choice: AdminThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia(DARK_QUERY).matches);
  // admin.css is dark unless this says "light".
  document.documentElement.setAttribute("data-admin-theme", dark ? "dark" : "light");
}

export function AdminThemeToggle() {
  const choice = useSyncExternalStore<AdminThemeChoice | null>(subscribe, read, () => null);

  // Apply it, and on System follow the OS as it changes (e.g. at sunset).
  useEffect(() => {
    if (choice === null) return;
    applyAdminTheme(choice);
    if (choice !== "system") return;
    const query = window.matchMedia(DARK_QUERY);
    const follow = () => applyAdminTheme("system");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [choice]);

  function pick(next: AdminThemeChoice) {
    try {
      localStorage.setItem(ADMIN_THEME_KEY, next);
    } catch {
      // Private mode: it still switches, just is not remembered.
    }
    applyAdminTheme(next);
    for (const listener of listeners) listener();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex rounded-md border border-[var(--admin-border)] p-0.5 text-[11px]"
    >
      {CHOICES.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={choice === c.value}
          onClick={() => pick(c.value)}
          className={`flex-1 rounded px-1.5 py-0.5 ${
            choice === c.value
              ? "bg-zinc-900 font-medium text-white"
              : "text-zinc-500 hover:text-zinc-900"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
