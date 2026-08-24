import { Link } from '@/i18n/navigation';

// Hover/focus dropdown under the Header's Support link, mirroring the Account
// menu next to it.
//
// Rendered in BOTH the signed-in and signed-out branches. That is the point:
// /help/support redirects anonymous visitors to login, so someone who cannot
// sign in - the person most likely to need support - previously had no route
// to help from the Header at all. Every destination below is public.
//
// Extracted rather than duplicated because the two branches would otherwise
// drift, and this list is the one that must not: a link that exists only when
// signed in is invisible to exactly the users who need it.

type Props = {
  labels: {
    faq: string;
    docs: string;
    status: string;
    contact: string;
  };
};

export function HelpMenu({ labels }: Props) {
  const items = [
    ['/help/faq', labels.faq],
    ['/docs', labels.docs],
    ['/docs/status', labels.status],
    ['/help/support', labels.contact],
  ] as const;

  return (
    // pt-2 keeps the hover area contiguous between trigger and panel, matching
    // the Account menu.
    <div className="invisible absolute left-1/2 top-full -translate-x-1/2 pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
      <div className="w-52 rounded-xl border border-black/10 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-zinc-900">
        {items.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="block rounded-lg px-3 py-2 text-zinc-700 hover:bg-black/5 hover:text-black dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
