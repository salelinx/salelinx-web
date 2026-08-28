"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { InstallExtensionButton } from "@/components/InstallExtensionButton";
import { Icon, type IconName } from "@/components/Icon";

interface Labels {
  navFeatures: string;
  navPricing: string;
  navRoadmap: string;
  navFaq: string;
  navDocs: string;
  account: string;
  support: string;
  signOut: string;
  signIn: string;
  getStarted: string;
  addToChrome: string;
  openMenu: string;
  closeMenu: string;
}

interface Props {
  isAuthed: boolean;
  labels: Labels;
}

export function MobileMenu({ isAuthed, labels }: Props) {
  // Read straight from the LanguageSwitcher namespace rather than threading
  // another label down from Header: "Language" is already translated in all
  // seven locales there, and a second copy would be one more thing to keep in
  // step for no gain.
  const tLang = useTranslations("LanguageSwitcher");
  const [open, setOpen] = useState(false);
  // Kept mounted for the length of the exit animation. Unmounting on the click
  // made it vanish on a frame, so the panel had an entrance and no exit.
  const [closing, setClosing] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  // Must match the .mobile-menu-panel.is-closing duration in globals.css. Too
  // short and the panel disappears mid-animation; too long and it sits there
  // invisible, still swallowing the next tap.
  const EXIT_MS = 150;

  const close = useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      closeTimer.current = window.setTimeout(() => {
        setOpen(false);
        setClosing(false);
        closeTimer.current = null;
      }, EXIT_MS);
      return true;
    });
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  // Close the menu on navigation. We track the pathname the menu was last
  // synced to and close in an event-driven way rather than calling setState
  // synchronously in an effect body (which the React lint rule flags as a
  // potential cascading render).
  const lastPathRef = useRef(pathname);

  useEffect(() => {
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname;
      setOpen(false);
      setClosing(false);
    }
  }, [pathname]);

  // Outside-click via a document listener rather than a full-screen backdrop
  // element. The backdrop was what stopped the page scrolling behind the menu:
  // a fixed inset-0 layer eats touch-scroll as well as taps. Listening on the
  // document keeps the click-away behaviour with nothing covering the page.
  //
  // The button is checked as well as the panel, otherwise tapping it while open
  // counts as "outside", closes the menu, and then the button's own onClick
  // reopens it — so it would never shut.
  useEffect(() => {
    if (!open || closing) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, closing, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // One row shape for every destination, so the list scans as a list rather
  // than a pile of differently-weighted links. The icon column is what gives it
  // a left edge to read down; before, only "Add to Chrome" had one, which made
  // that row look like a mistake.
  const rowClass =
    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-zinc-700 transition-colors hover:bg-black/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.06]";
  const activeRowClass =
    "flex items-center gap-2.5 rounded-lg bg-black/[0.05] px-2.5 py-2 text-[14px] font-medium text-zinc-900 dark:bg-white/[0.08] dark:text-white";
  const iconClass =
    "h-[17px] w-[17px] shrink-0 text-zinc-400 dark:text-zinc-500";
  const sectionClass =
    "px-2.5 pb-1 pt-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-600";

  // Only pathname routes light up. Five of these are hash links into the home
  // and features pages, and there is no reliable way to know which section the
  // reader is looking at from here — guessing would leave the wrong row
  // highlighted more often than the right one.
  const isActive = (href: string) => !href.includes("#") && pathname === href;
  const row = (href: string) => (isActive(href) ? activeRowClass : rowClass);

  const NAV: { href: string; label: string; icon: IconName }[] = [
    { href: "/#features", label: labels.navFeatures, icon: "sparkle" },
    { href: "/#pricing", label: labels.navPricing, icon: "tag" },
    { href: "/features#roadmap", label: labels.navRoadmap, icon: "tree" },
    { href: "/help/faq", label: labels.navFaq, icon: "message" },
    { href: "/docs", label: labels.navDocs, icon: "book" },
  ];

  return (
    <>
      <button
        type="button"
        aria-label={open ? labels.closeMenu : labels.openMenu}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        ref={buttonRef}
        onClick={() => (open ? close() : setOpen(true))}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-zinc-900 transition hover:bg-black/[0.04] sm:hidden dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          {open ? (
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {open && (
        <>
          <div
            id="mobile-menu-panel"
            ref={panelRef}
            role="dialog"
            className={`popover-pop${closing ? " is-closing" : ""} fixed end-3 top-[54px] z-50 max-h-[calc(100dvh-70px)] w-[15.5rem] origin-top-right overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.28)] sm:hidden dark:border-white/12 dark:bg-zinc-950`}
          >
            <nav className="flex flex-col p-1.5 pb-2.5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={row(item.href)}
                >
                  <Icon name={item.icon} className={iconClass} />
                  {item.label}
                </Link>
              ))}

              <div className={sectionClass}>{labels.account}</div>
              <Link href="/help" className={row("/help")}>
                <Icon name="shield" className={iconClass} />
                {labels.support}
              </Link>
              {isAuthed ? (
                <Link href="/account" className={row("/account")}>
                  <Icon name="users" className={iconClass} />
                  {labels.account}
                </Link>
              ) : (
                <Link href="/auth/login" className={row("/auth/login")}>
                  <Icon name="lock" className={iconClass} />
                  {labels.signIn}
                </Link>
              )}

              {/* The one action on the sheet, so it is the one filled control.
                  Everything above is navigation and stays quiet; a page full of
                  equally-weighted bordered buttons is what made this feel
                  undesigned. */}
              <div className="mt-3 flex flex-col gap-1.5 px-1.5">
                {isAuthed ? (
                  <InstallExtensionButton
                    label={labels.addToChrome}
                    className="flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-zinc-900"
                  />
                ) : (
                  <>
                    <Link
                      href="/auth/signup"
                      className="rounded-lg bg-zinc-900 px-3 py-2.5 text-center text-[14px] font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-zinc-900"
                    >
                      {labels.getStarted}
                    </Link>
                    <InstallExtensionButton
                      label={labels.addToChrome}
                      className="flex items-center justify-center gap-2 rounded-lg border border-black/10 px-3 py-2.5 text-[14px] font-medium text-zinc-800 transition-colors hover:bg-black/[0.04] dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                    />
                  </>
                )}
              </div>

              {/* Language and Sign out share the closing row: both are settings
                  rather than destinations, and neither earns a full-width
                  control. Sign out was a bordered block the same size as Get
                  started, which gave leaving the same weight as joining. */}
              <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] px-2.5 pt-2.5 dark:border-white/10">
                <span className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  {tLang("label")}
                </span>
                <div className="flex items-center gap-3">
                  {isAuthed && (
                    <form action="/auth/signout" method="post">
                      <button
                        type="submit"
                        className="text-[13px] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                      >
                        {labels.signOut}
                      </button>
                    </form>
                  )}
                  <LanguageSwitcher triggerClassName="h-7 w-7" />
                </div>
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
