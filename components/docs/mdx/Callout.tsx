import type { ReactNode } from 'react';

type Variant = 'info' | 'warn' | 'tip';

const STYLES: Record<Variant, string> = {
  info: 'border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03]',
  warn: 'border-amber-500/30 bg-amber-500/[0.08]',
  tip: 'border-emerald-500/30 bg-emerald-500/[0.08]',
};

const LABELS: Record<Variant, string> = {
  info: 'Note',
  warn: 'Heads up',
  tip: 'Tip',
};

export function Callout({
  variant = 'info',
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`my-6 rounded-lg border px-5 py-4 ${STYLES[variant]}`}>
      <div className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">
        {title ?? LABELS[variant]}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 [&>p]:my-2">
        {children}
      </div>
    </div>
  );
}
