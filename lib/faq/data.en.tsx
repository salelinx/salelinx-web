import { Link } from '@/i18n/navigation';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';
import type { FAQGroup } from './types';

export const FAQ_GROUPS_EN: FAQGroup[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    blurb: 'Installing SaleLinx, signing in, and supported browsers.',
    items: [
      {
        id: 'how-do-i-install',
        q: 'How do I install the SaleLinx extension?',
        a: (
          <>
            <p>
              Install from the{' '}
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Chrome Web Store
              </a>{' '}
              and pin the extension to your toolbar. Full walkthrough with
              screenshots in{' '}
              <Link
                href="/docs/getting-started/install-the-extension"
                className="underline underline-offset-4"
              >
                Installing the SaleLinx extension
              </Link>
              .
            </p>
            <InstallExtensionButton
              label="Add to Chrome"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            />
          </>
        ),
        keywords: ['install', 'setup', 'chrome', 'add'],
      },
      {
        id: 'which-browsers',
        q: 'Which browsers does SaleLinx support?',
        a: (
          <p>
            Any Chromium-based browser: Google Chrome, Microsoft Edge, Brave,
            Arc, Opera. Safari and Firefox are not supported.
          </p>
        ),
        keywords: ['browser', 'chrome', 'edge', 'safari', 'firefox', 'brave'],
      },
      {
        id: 'free-trial',
        q: 'Do I need to pay to try it?',
        a: (
          <p>
            You get a 7-day free trial of the Starter plan, one per account. A
            card is required to start it, but nothing is charged during the
            trial and you can cancel any time from your account page. If you
            don&rsquo;t cancel, your Starter subscription starts automatically
            when the trial ends. See{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              pricing
            </Link>{' '}
            for what each plan includes.
          </p>
        ),
        keywords: ['free', 'trial', 'pricing', 'tier', 'starter', 'card'],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'Account & billing',
    blurb: 'Plans, invoices, payment methods, and cancellations.',
    items: [
      {
        id: 'how-to-upgrade',
        q: 'How do I upgrade my plan?',
        a: (
          <p>
            Sign in at{' '}
            <Link href="/account" className="underline underline-offset-4">
              salelinx.com/account
            </Link>{' '}
            and choose a new plan. The change applies immediately and
            you&rsquo;re prorated for the rest of the billing period.
          </p>
        ),
        keywords: ['upgrade', 'plan', 'change', 'tier'],
      },
      {
        id: 'how-to-cancel',
        q: 'How do I cancel my subscription?',
        a: (
          <p>
            Open your{' '}
            <Link href="/account" className="underline underline-offset-4">
              account page
            </Link>{' '}
            and click <em>Manage billing</em>. You&rsquo;ll land in the Stripe
            customer portal where you can cancel. You keep access until the end
            of the current period.
          </p>
        ),
        keywords: ['cancel', 'unsubscribe', 'stop billing'],
      },
      {
        id: 'change-plan-midmonth',
        q: 'Can I change plans in the middle of a billing period?',
        a: (
          <p>
            Yes. Upgrades take effect immediately with prorated billing.
            Downgrades take effect at the start of the next billing period so
            you don&rsquo;t lose what you already paid for.
          </p>
        ),
        keywords: ['prorate', 'switch', 'downgrade'],
      },
      {
        id: 'where-are-invoices',
        q: 'Where do I get my invoices?',
        a: (
          <p>
            In the Stripe customer portal. Open your account page, click{' '}
            <em>Manage billing</em>, then <em>Invoice history</em>.
          </p>
        ),
        keywords: ['invoice', 'receipt', 'tax', 'vat'],
      },
      {
        id: 'charged-twice',
        q: 'I was charged twice, what do I do?',
        a: (
          <p>
            It&rsquo;s almost always a failed-then-retried charge rather than a
            true duplicate. Check the invoice history in the customer portal
            first. If you see two successful charges, email{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            with the invoice IDs and we&rsquo;ll refund the duplicate.
          </p>
        ),
        keywords: ['duplicate', 'refund', 'overcharge', 'charge'],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    blurb: 'Fixes for the most common things that go wrong.',
    items: [
      {
        id: 'panel-not-appearing',
        q: 'The SaleLinx panel doesn&rsquo;t appear on Depop or Vinted',
        a: (
          <div className="space-y-2">
            <p>Try these in order:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Refresh the marketplace tab.</li>
              <li>
                Make sure the extension is pinned and enabled (puzzle icon in
                the Chrome toolbar).
              </li>
              <li>
                Confirm you&rsquo;re on a product or profile page. The panel
                doesn&rsquo;t open on search or checkout pages.
              </li>
              <li>Sign out and back in from the extension.</li>
            </ol>
          </div>
        ),
        keywords: ['panel', 'missing', 'not showing', 'depop', 'vinted'],
      },
      {
        id: 'listing-failed-to-post',
        q: 'A listing failed to post',
        a: (
          <p>
            Most failures come from being signed out of the target marketplace
            or a required field not mapping cleanly. Sign out and back in on
            the target marketplace, then retry from the dashboard. If a whole
            marketplace is down, check the{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              marketplace status page
            </Link>
            .
          </p>
        ),
        keywords: ['failed', 'error', 'post', 'crosslist', 'upload'],
      },
      {
        id: 'crosslisting-stuck',
        q: 'Crosslisting is stuck on &ldquo;Filling form...&rdquo;',
        a: (
          <p>
            Don&rsquo;t touch the target tab while the extension is filling it.
            If it&rsquo;s been stuck for more than a minute, click <em>Cancel</em>
            in the panel and retry. If it happens repeatedly on one marketplace,
            it&rsquo;s likely a form-layout change on their side; see{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              marketplace status
            </Link>
            .
          </p>
        ),
        keywords: ['stuck', 'hanging', 'frozen', 'slow', 'filling'],
      },
      {
        id: 'cant-sign-in',
        q: 'I&rsquo;m signed out and can&rsquo;t sign back in',
        a: (
          <p>
            Reset your password at{' '}
            <Link
              href="/auth/forgot-password"
              className="underline underline-offset-4"
            >
              salelinx.com/auth/forgot-password
            </Link>
            . Your website account and extension account are the same, so the
            new password works in both.
          </p>
        ),
        keywords: ['password', 'login', 'sign in', 'reset', 'locked out'],
      },
      {
        id: 'listings-not-syncing',
        q: 'My listings aren&rsquo;t syncing to the dashboard',
        a: (
          <p>
            Open the dashboard and click the <em>Resync</em> button in the top
            right. If a specific listing is missing, open it on the marketplace
            once with the SaleLinx panel open; the panel adds it on detection.
          </p>
        ),
        keywords: ['sync', 'missing', 'dashboard', 'refresh'],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy & data',
    blurb: 'What we store, where it lives, and how to delete it.',
    items: [
      {
        id: 'store-marketplace-password',
        q: 'Does SaleLinx store my marketplace password?',
        a: (
          <p>
            No. SaleLinx uses your existing browser session on each marketplace
            so there&rsquo;s no password to enter, store, or leak.
          </p>
        ),
        keywords: ['password', 'credentials', 'security'],
      },
      {
        id: 'where-is-my-data',
        q: 'Where is my data stored?',
        a: (
          <p>
            Your SaleLinx account and listings index are stored in Supabase
            (EU region). Some of our service providers (for example Stripe for
            payments) may process data in the UK, EU, or US with appropriate
            safeguards, as described in our{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>
            . Marketplace data itself stays on the marketplace.
          </p>
        ),
        keywords: ['data', 'storage', 'supabase', 'region', 'eu'],
      },
      {
        id: 'delete-my-data',
        q: 'How do I delete my data?',
        a: (
          <p>
            The fastest way is self-serve: open{' '}
            <Link href="/account" className="underline underline-offset-4">
              your account
            </Link>
            , scroll to the Danger zone, and confirm via the emailed link.
            Deletion takes effect immediately. You can also email{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            from the address on your account and we&rsquo;ll complete the
            deletion within 30 days, usually much sooner.
          </p>
        ),
        keywords: ['delete', 'gdpr', 'remove', 'account', 'erase'],
      },
    ],
  },
];
