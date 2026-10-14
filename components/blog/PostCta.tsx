import { Link } from '@/i18n/navigation';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';
import { isSignedIn } from '@/lib/auth/session';

// End-of-post call to action. Same split as the /features/[slug] landing
// pages: signed-out readers get the trial, signed-in ones the install button.
export async function PostCta() {
  const signedIn = await isSignedIn();
  return (
    <aside className="mt-14 rounded-2xl border border-black/10 bg-black/[0.02] p-6 sm:p-8 dark:border-white/15 dark:bg-white/[0.03]">
      <h2 className="text-2xl font-semibold tracking-tight text-balance">
        Spend less time listing and more time sourcing
      </h2>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        SaleLinx is a Chrome extension for Depop and Vinted sellers. Crosslist between the two,
        keep your Depop shop fresh, handle offers and spot dead stock, all from one panel.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {signedIn ? (
          <InstallExtensionButton
            label="Add to Chrome"
            className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
          />
        ) : (
          <Link
            href="/auth/signup"
            className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Start your free 14-day trial
          </Link>
        )}
        <Link
          href="/pricing"
          className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
        >
          See pricing
        </Link>
      </div>
    </aside>
  );
}
