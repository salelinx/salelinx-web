"use client";

// Client component on purpose: SCENES lives in ScrollWorldDemo, which is
// "use client", and a server component importing a value (rather than a
// component) across that boundary gets a client reference, not the array.
// Mapping over it then throws "SCENES.map is not a function".
import { notFound } from "next/navigation";
import { SCENES } from "@/components/home/ScrollWorldDemo";

/**
 * Dev-only scene preview, and the mobile harness for the homepage panels.
 *
 * Two things make a panel change hard to check by hand, and this page exists
 * for both:
 *
 * 1. **The panels render invisible outside the homepage.** Every one is built
 *    from `.cascade-item` elements, which globals.css starts at opacity 0 and
 *    only reveals through `.panel-swap .cascade-item` or an `.in-view`
 *    ancestor. An earlier version of this page dropped the panels in bare and
 *    showed five empty boxes. Every panel here is wrapped in `panel-swap` for
 *    that reason; do not remove it.
 *
 * 2. **Phone width is where they break, and it cannot be faked with a narrow
 *    div.** The homepage renders four of the six scenes through `FitWidth`,
 *    which lays them out at PANEL_DESIGN_WIDTH and scales the result down to
 *    whatever the column gives it. On a 390px phone that is roughly half size,
 *    and the panels set type in hard pixels as small as 8.5px, so labels land
 *    near 4px. Each scene below is therefore shown twice at phone width: as it
 *    ships today (scaled) and at natural size (what `Scene.fluid` would give
 *    it). The pair is the whole point of the page, since "can this panel go
 *    fluid?" is answered by looking at the right-hand column.
 *
 * 404s outside development, so it cannot ship. Not linked from anywhere.
 */

/**
 * Viewing this page AT a 390px viewport is the only way to check anything
 * breakpoint-dependent: Tailwind's `sm:` resolves against the viewport, not
 * the frame, so a 342px frame inside a wide window still gets desktop rules.
 * The `inbox` scene is the example, it stacks its two panels only below `sm`.
 * The page drops its own gutters below `sm` so the frames still fit.
 */

/** Mirrors DESIGN_WIDTH in ScrollWorldDemo. Keep the two in step. */
const PANEL_DESIGN_WIDTH = 680;

/** 390px phone minus the scene's px-6 gutters. What a panel actually gets. */
const PHONE_CONTENT_WIDTH = 342;

const PHONE_SCALE = PHONE_CONTENT_WIDTH / PANEL_DESIGN_WIDTH;

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-[1500px] px-0 py-10 sm:px-6">
      <header className="mb-8 px-3 sm:px-0">
        <h1 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">
          Scene preview
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Development only. Every homepage panel, running at once, at phone
          width both as it ships and at natural size. The phone column is{" "}
          {PHONE_CONTENT_WIDTH}px, which is a 390px viewport minus the
          scene&rsquo;s gutters; today&rsquo;s scale factor is{" "}
          {PHONE_SCALE.toFixed(3)}.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {SCENES.map((s) => (
          <section
            key={s.id}
            className="rounded-2xl border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-zinc-950 sm:p-5"
          >
            <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-black/[0.06] pb-3 dark:border-white/10">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {s.id}
              </h2>
              <span
                className={
                  s.fluid
                    ? "rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-700 dark:text-emerald-400"
                    : "rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-400"
                }
              >
                {s.fluid === true ? "fluid" : `scaled ${PHONE_SCALE.toFixed(2)}`}
              </span>
              <p className="font-mono text-[10px] text-zinc-400">
                {s.layout === "full" ? "full-width overview scene" : "split scene"}
              </p>
            </div>

            <div className="flex flex-wrap items-start gap-8">
              {/* As shipped on a phone: natural width, transform-scaled down.
                  Same maths as FitWidth, inlined so this page does not depend
                  on a component that is not exported. The outer box takes the
                  scaled height because transforms do not affect layout. */}
              <Frame
                label={`phone ${PHONE_CONTENT_WIDTH}px, as shipped`}
                sub={s.fluid === true ? "fluid: renders natural, not scaled" : "scaled"}
                width={PHONE_CONTENT_WIDTH}
              >
                {s.fluid === true ? (
                  <div className="panel-swap" style={{ width: PHONE_CONTENT_WIDTH }}>
                    {s.render()}
                  </div>
                ) : (
                  <div
                    style={{
                      width: PHONE_CONTENT_WIDTH,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="panel-swap"
                      style={{
                        width: PANEL_DESIGN_WIDTH,
                        transform: `scale(${PHONE_SCALE})`,
                        transformOrigin: "top left",
                      }}
                    >
                      {s.render()}
                    </div>
                  </div>
                )}
              </Frame>

              {/* What Scene.fluid would give it: no transform, panel asked to
                  reflow into the phone column. Overflow is visible on purpose
                  so a panel that cannot cope shows the overhang rather than
                  hiding it. */}
              <Frame
                label={`phone ${PHONE_CONTENT_WIDTH}px, natural size`}
                sub="what fluid: true would look like"
                width={PHONE_CONTENT_WIDTH}
              >
                <div className="panel-swap" style={{ width: PHONE_CONTENT_WIDTH }}>
                  {s.render()}
                </div>
              </Frame>

              {/* Desktop reference. */}
              <Frame
                label={`desktop ${PANEL_DESIGN_WIDTH}px`}
                sub="design width"
                width={PANEL_DESIGN_WIDTH}
              >
                <div className="panel-swap" style={{ width: PANEL_DESIGN_WIDTH }}>
                  {s.render()}
                </div>
              </Frame>
            </div>
          </section>
        ))}

        {/* A real narrow viewport. The mobile header is `sm:hidden`, so it does
            not exist at desktop width no matter how small you make a div, and
            the scenes' own `min-h-[100svh]` only resolves against a real
            viewport. Points at #features so it lands on the scenes. */}
        <section className="rounded-2xl border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-zinc-950 sm:p-5">
          <div className="mb-4 border-b border-black/[0.06] pb-3 dark:border-white/10">
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Real 390px viewport
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-400">
              the homepage itself · scroll it to check scene spacing and the
              mobile menu
            </p>
          </div>
          <iframe
            src="/#features"
            title="Mobile viewport"
            className="h-[780px] w-[390px] rounded-xl border border-black/10 dark:border-white/10"
          />
        </section>
      </div>
    </main>
  );
}

/** Labelled, width-pinned box with a visible edge, so overhang is obvious. */
function Frame({
  label,
  sub,
  width,
  children,
}: {
  label: string;
  sub: string;
  width: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </p>
        <p className="font-mono text-[10px] text-zinc-400">{sub}</p>
      </div>
      <div
        className="rounded-lg border border-dashed border-black/15 p-2 dark:border-white/20"
        style={{ width: width + 16 }}
      >
        {children}
      </div>
    </div>
  );
}
