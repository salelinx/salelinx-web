"use client";

// Short-lived messages for the planner, bottom centre: "Scheduled", "Moved to
// Thu", with an Undo where one makes sense. Successes fade after a few
// seconds; errors stay until closed, so nothing that needs reading vanishes.

import { useCallback, useRef, useState } from "react";
import { IconAlert, IconCheck, IconX } from "./icons";

export type Toast = {
  id: number;
  text: string;
  tone: "ok" | "error" | "info";
  action?: { label: string; run: () => void };
};

const LINGER_MS = 6000;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const push = useCallback(
    (text: string, tone: Toast["tone"] = "ok", action?: Toast["action"]) => {
      const id = next.current++;
      // At most three at once; the oldest goes first.
      setToasts((all) => [...all.slice(-2), { id, text, tone, action }]);
      if (tone !== "error")
        setTimeout(() => dismiss(id), action ? LINGER_MS + 4000 : LINGER_MS);
      return id;
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="slx-pop pointer-events-auto flex max-w-xl items-start gap-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-3 pr-2 text-sm text-zinc-800 shadow-lg shadow-black/10"
        >
          <span
            className={`mt-0.5 ${t.tone === "error" ? "text-red-600" : t.tone === "ok" ? "text-emerald-600" : "text-zinc-400"}`}
          >
            {t.tone === "error" ? (
              <IconAlert size={16} />
            ) : (
              <IconCheck size={16} />
            )}
          </span>
          <p className="min-w-0 flex-1 leading-snug">{t.text}</p>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.run();
                onDismiss(t.id);
              }}
              className="shrink-0 rounded-md px-2 py-0.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-900"
          >
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
