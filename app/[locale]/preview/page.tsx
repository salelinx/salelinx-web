import { notFound } from "next/navigation";
import {
  ConversationsPanel,
  CrosslistPanel,
  FollowBotPanel,
  OffersPanel,
} from "@/components/home/HeroPreview";
import { RestockerScene } from "@/components/home/RestockerScene";

/**
 * Dev-only scene preview.
 *
 * The homepage renders these inside a 7400px scroll-driven section, one scene
 * at a time as you pass it, and the mobile header only exists below 640px. That
 * makes checking a change to any of them a scavenger hunt. This puts every
 * scene on one screen, all running at once, plus a real 390px iframe of the
 * homepage so the mobile menu can be opened and looked at without resizing the
 * browser.
 *
 * 404s outside development, so it cannot ship. Not linked from anywhere.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const scenes: { name: string; note: string; el: React.ReactNode }[] = [
    {
      name: "Crosslist",
      note: "11s cycle · blurred underneath, sharp wipes down over it",
      el: <CrosslistPanel />,
    },
    {
      name: "Restocker",
      note: '6.2s per sale · watch for "sold here" then "matched"',
      el: <RestockerScene />,
    },
    {
      name: "Follow bot",
      note: "2.5s per follow · list height is pinned, counters must not move",
      el: <FollowBotPanel />,
    },
    {
      name: "Offers",
      note: "click the actions · footer must stay put",
      el: <OffersPanel />,
    },
    {
      name: "Messages",
      note: "25.6s per thread · rotates through 3",
      el: <ConversationsPanel />,
    },
  ];

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">
          Scene preview
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Development only. Every homepage scene, running at once.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {scenes.map((s) => (
          <section
            key={s.name}
            className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="mb-4 border-b border-black/[0.06] pb-3 dark:border-white/10">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {s.name}
              </h2>
              <p className="mt-0.5 font-mono text-[10px] text-zinc-400">
                {s.note}
              </p>
            </div>
            <div className="flex min-h-[300px] items-center justify-center">
              {s.el}
            </div>
          </section>
        ))}

        {/* A real narrow viewport. The mobile header is `sm:hidden`, so it does
            not exist at desktop width no matter how small you make a div — only
            an actual 390px viewport renders it, which is what the iframe is. */}
        <section className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950">
          <div className="mb-4 border-b border-black/[0.06] pb-3 dark:border-white/10">
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Mobile header + menu
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-400">
              real 390px viewport · tap the circle to open the dropdown
            </p>
          </div>
          <iframe
            src="/"
            title="Mobile viewport"
            className="h-[560px] w-[390px] rounded-xl border border-black/10 dark:border-white/10"
          />
        </section>
      </div>
    </main>
  );
}
