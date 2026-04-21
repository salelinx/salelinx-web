import { Icon } from '@/components/Icon';

export function InstallPinCallout() {
  return (
    <div className="my-6 grid gap-4 rounded-lg border border-black/10 bg-black/[0.03] p-5 sm:grid-cols-[auto_1fr] sm:items-center dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-black/10 bg-white text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200">
        <Icon name="puzzle" className="h-8 w-8" />
      </div>
      <div>
        <div className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">
          Pin the extension
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          Click the puzzle icon at the top right of Chrome, find SaleLinx in the
          list, and click the pin icon next to it. The SaleLinx icon will stay
          visible in your toolbar so you can open the side panel with one click.
        </p>
      </div>
    </div>
  );
}
