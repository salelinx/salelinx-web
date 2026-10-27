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
            No. You get a 14-day free trial of the Starter plan, with the same
            features as Starter and lower allowances (see{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              pricing
            </Link>
            ). A card is required to start it, but nothing is charged during
            the trial and you can cancel any time from your account page.
            There is one trial per SaleLinx account and per Depop, Vinted or
            eBay shop. If you don&rsquo;t cancel, your Starter subscription starts
            automatically when the trial ends.
          </p>
        ),
        keywords: ['free', 'trial', 'pricing', 'tier', 'starter', 'card'],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'Account & billing',
    blurb: 'Plans, invoices, cancellations, and referral rewards.',
    items: [
      {
        id: 'how-to-upgrade',
        q: 'How do I upgrade my plan?',
        a: (
          <p>
            On a paid plan, open your{' '}
            <Link href="/account" className="underline underline-offset-4">
              account page
            </Link>
            , click <strong>Manage subscription</strong> and choose the new
            plan in Stripe&rsquo;s billing portal. During your free trial, pick
            a plan on the{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              pricing page
            </Link>{' '}
            or click <strong>Start Starter now</strong> on your account page
            instead. That ends the trial and charges your card straight away,
            and the new allowances apply immediately.
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
            and click <strong>Manage subscription</strong>. Stripe&rsquo;s
            billing portal opens, where you can cancel. You keep access until
            the end of the period you&rsquo;ve paid for, and you can resume
            from the same place before then. If you cancel during the free
            trial, you aren&rsquo;t charged.
          </p>
        ),
        keywords: ['cancel', 'unsubscribe', 'stop billing'],
      },
      {
        id: 'change-plan-midmonth',
        q: 'Can I change plans in the middle of a billing period?',
        a: (
          <p>
            Yes. During the free trial, choosing a plan on the{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              pricing page
            </Link>{' '}
            ends the trial early: your card is charged for that plan straight
            away and its allowances apply immediately. On a paid plan, every
            change happens in Stripe&rsquo;s billing portal: click{' '}
            <strong>Manage subscription</strong> on your{' '}
            <Link href="/account" className="underline underline-offset-4">
              account page
            </Link>{' '}
            and pick the plan. Moving to a lower plan always goes through{' '}
            <strong>Manage subscription</strong>.
          </p>
        ),
        keywords: ['prorate', 'switch', 'downgrade', 'trial'],
      },
      {
        id: 'where-are-invoices',
        q: 'Where do I get my invoices?',
        a: (
          <p>
            Open your{' '}
            <Link href="/account" className="underline underline-offset-4">
              account page
            </Link>{' '}
            and click <strong>Manage subscription</strong>. Stripe&rsquo;s
            billing portal opens with your invoice history, where you can
            download each invoice.
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
            true duplicate. Check your invoices first:{' '}
            <strong>Manage subscription</strong> on your account page opens
            them in Stripe&rsquo;s billing portal. If you see two successful
            charges, email{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            with the invoice numbers and we&rsquo;ll refund the duplicate.
          </p>
        ),
        keywords: ['duplicate', 'refund', 'overcharge', 'charge'],
      },
      {
        id: 'refer-and-earn',
        q: 'How does Refer & Earn work?',
        a: (
          <p>
            Copy your link from the <strong>Refer &amp; Earn</strong> tab in
            the SaleLinx panel, or from <strong>Refer a friend</strong> on your{' '}
            <Link href="/account" className="underline underline-offset-4">
              account page
            </Link>
            . Friends who sign up through it get a discount on their first
            month. Once a friend has paid, you earn free time on your own
            plan: 1 week if they choose Starter, 2 weeks for Pro, 1 month for
            Business. It arrives as credit on your next SaleLinx bill about a
            week after their first payment, as long as you have a plan of your
            own. Full rules are in the{' '}
            <Link
              href="/legal/referral-terms"
              className="underline underline-offset-4"
            >
              referral program terms
            </Link>
            .
          </p>
        ),
        keywords: ['refer', 'referral', 'invite', 'friend', 'reward', 'credit', 'discount'],
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
        q: 'The SaleLinx panel doesn&rsquo;t appear on Depop, Vinted or eBay',
        a: (
          <div className="space-y-2">
            <p>
              The panel opens from the SaleLinx launcher in the bottom-right
              corner of every Depop, Vinted and eBay page: click it, or press
              Alt+S (the default shortcut) on one of those tabs. The SaleLinx
              icon in Chrome&rsquo;s toolbar only opens a small window for
              signing in. If you can&rsquo;t see the launcher:
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Refresh the marketplace tab. Tabs that were already open when
                you installed or updated SaleLinx need a refresh.
              </li>
              <li>
                Check that SaleLinx is switched on: open chrome://extensions
                and look for its toggle.
              </li>
              <li>
                Still missing?{' '}
                <Link
                  href="/help/support"
                  className="underline underline-offset-4"
                >
                  Contact support
                </Link>
                .
              </li>
            </ol>
          </div>
        ),
        keywords: ['panel', 'missing', 'not showing', 'launcher', 'depop', 'vinted', 'ebay'],
      },
      {
        id: 'update-available',
        q: 'SaleLinx says an update is available or that I&rsquo;m versions behind',
        a: (
          <p>
            Chrome updates SaleLinx by itself. When a new version has
            downloaded, the panel shows a banner saying it is available: click{' '}
            <strong>Reload to update</strong> and the page refreshes on the new
            version. If the panel says you are one or more versions behind,
            Chrome hasn&rsquo;t fetched the update yet. Click{' '}
            <strong>Open extensions page</strong> (or go to
            chrome://extensions), turn on <strong>Developer mode</strong> at
            the top right, click <strong>Update</strong>, then refresh your
            Depop, Vinted and eBay tabs.
          </p>
        ),
        keywords: ['update', 'version', 'behind', 'outdated', 'reload'],
      },
      {
        id: 'in-use-another-device',
        q: 'SaleLinx says it&rsquo;s in use on another device',
        a: (
          <p>
            You can be signed in on several devices, but only one can use
            SaleLinx at a time. If the panel shows{' '}
            <strong>In use on another device</strong>, click{' '}
            <strong>Use here instead</strong> to carry on here; the other
            device is signed out of SaleLinx. If you&rsquo;ve just closed your
            marketplace tabs on the other device, it also frees up by
            itself within about 10 minutes. If you don&rsquo;t recognise the
            other device, take over and then change your password from your{' '}
            <Link href="/account" className="underline underline-offset-4">
              account page
            </Link>
            .
          </p>
        ),
        keywords: ['device', 'another device', 'computer', 'laptop', 'use here', 'shared'],
      },
      {
        id: 'salelinx-temporarily-down',
        q: 'SaleLinx says it&rsquo;s temporarily down',
        a: (
          <p>
            The panel can&rsquo;t reach our servers right now. Depop, Vinted
            and eBay aren&rsquo;t affected, so you can keep using all three
            sites as normal, and your listings there are untouched. The message clears by
            itself as soon as SaleLinx is reachable again, so there&rsquo;s no
            need to reinstall, sign out or reset your password, even if the
            sign-in screen shows the same message. From version 1.1.12 it
            covers the whole panel and has a <strong>Close SaleLinx</strong>{' '}
            button; earlier versions show it as a banner at the top of the
            panel.
          </p>
        ),
        keywords: ['down', 'outage', 'unavailable', 'not working', 'offline'],
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
            . If you signed up with Google, there is no password to reset: use
            the <strong>Continue with Google</strong> button on the sign-in
            page instead. Your website account and extension account are the
            same, so whichever way you sign back in works in both.
          </p>
        ),
        keywords: ['password', 'login', 'sign in', 'reset', 'locked out', 'google'],
      },
      {
        id: 'open-a-marketplace-tab',
        q: 'SaleLinx asks me to open a Depop or Vinted tab',
        a: (
          <p>
            SaleLinx works through your own signed-in Depop and Vinted
            sessions, so a Depop or Vinted feature needs a tab for its
            marketplace open somewhere in Chrome. Any window will do, and it
            doesn&rsquo;t have to be the tab you&rsquo;re looking at. Click{' '}
            <strong>Open Depop</strong> or <strong>Open Vinted</strong> in the
            message, or open the site yourself; crosslisting between Depop and
            Vinted needs both. eBay never needs a tab, because it connects
            through eBay&rsquo;s own sign-in, so crosslisting to or from eBay
            only needs the Depop or Vinted tab. If a
            tab is open but SaleLinx asks you to reload it (for example after
            Chrome put the tab to sleep to save memory), click{' '}
            <strong>Reload Depop tab</strong> or{' '}
            <strong>Reload Vinted tab</strong>. From version 1.1.12,{' '}
            <strong>My Listings</strong> also offers to open a missing tab when
            you refresh; earlier versions asked you to reload a tab even when
            none was open.
          </p>
        ),
        keywords: ['tab', 'open', 'reload', 'needs a tab', 'depop', 'vinted', 'ebay'],
      },
      {
        id: 'wrong-marketplace-account',
        q: 'SaleLinx says I&rsquo;m signed in to Depop or Vinted as a different account',
        a: (
          <p>
            SaleLinx only works with the Depop and Vinted accounts linked to
            it, and pauses that marketplace&rsquo;s features while the site is
            signed in to a different one. To fix it, sign out on Depop or
            Vinted, sign back in with the linked account and reload the tab. If
            you want SaleLinx to use the other account instead, open{' '}
            <strong>Settings</strong> in the panel, click{' '}
            <strong>Unlink</strong> under <strong>Marketplace accounts</strong>,
            then click <strong>Link</strong> for the account you&rsquo;re
            signed in with. eBay works differently: SaleLinx always uses the
            eBay account linked in <strong>Settings</strong>, whichever account
            the eBay site is signed in to. More in{' '}
            <Link
              href="/docs/getting-started/connect-your-first-marketplace"
              className="underline underline-offset-4"
            >
              Connect your first marketplace
            </Link>
            .
          </p>
        ),
        keywords: ['different account', 'wrong account', 'mismatch', 'relink', 'unlink'],
      },
      {
        id: 'account-already-linked',
        q: 'SaleLinx says my Depop, Vinted or eBay account is already linked or has used a free trial',
        a: (
          <p>
            Each Depop, Vinted or eBay account can be linked to only one
            SaleLinx account at a time. If it&rsquo;s linked to another SaleLinx account
            of yours, sign in to that one, click <strong>Unlink</strong> in{' '}
            <strong>Settings</strong>, then sign back in to this account and
            link it. Each shop also gets one free trial: if it already had one
            on another SaleLinx account, you can link it here once you start a
            paid plan from the{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              pricing page
            </Link>
            . If you can&rsquo;t get into the other account,{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              contact support
            </Link>
            .
          </p>
        ),
        keywords: ['already linked', 'link', 'trial', 'another account', 'could not link'],
      },
      {
        id: 'listings-not-syncing',
        q: 'My listings aren&rsquo;t showing up or are out of date',
        a: (
          <p>
            SaleLinx reads your listings from Depop and Vinted while a tab for
            that marketplace is open and signed in to your linked account. In{' '}
            <strong>My Listings</strong>, the status next to each marketplace
            at the top shows when it last synced: click{' '}
            <strong>Update All</strong>, or the refresh button beside one
            marketplace, to sync now. If it asks you to open or reload a tab,
            or says your session expired, do that on the marketplace site and
            refresh again. eBay listings come straight from eBay with no tab
            needed: they update at most every 15 minutes, and you see your
            active eBay listings plus those sold in the last 60 days. If the
            eBay status says <strong>reconnect in Settings</strong>, open{' '}
            <strong>Settings</strong> and click <strong>Link</strong> on the
            eBay row. More in the{' '}
            <Link
              href="/docs/inventory/listings"
              className="underline underline-offset-4"
            >
              My Listings guide
            </Link>
            .
          </p>
        ),
        keywords: ['sync', 'missing', 'my listings', 'refresh', 'out of date', 'ebay'],
      },
      {
        id: 'crosslisting-stuck',
        q: 'Crosslisting is stuck or won&rsquo;t start',
        a: (
          <div className="space-y-2">
            <p>Check these in order:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Both marketplaces you&rsquo;re copying between are linked. For
                Depop and Vinted, a tab for each is also open and signed in to
                the linked account; eBay needs no tab. The panel tells you
                which one is missing.
              </li>
              <li>
                Look at the <Link href="/docs/getting-started/queue" className="underline underline-offset-4">queue</Link> at the bottom of the panel&rsquo;s sidebar.
                SaleLinx runs one job at a time, so a crosslist shows{' '}
                <strong>Queued</strong> until the job ahead of it finishes. If
                it shows <strong>Paused</strong>, click{' '}
                <strong>Resume</strong>.
              </li>
              <li>
                <strong>Rate limited</strong> means Depop or Vinted is limiting
                requests. SaleLinx waits and carries on by itself when the
                countdown ends.
              </li>
              <li>
                <strong>eBay is busy right now</strong> means eBay is
                temporarily turning requests away. Try again later; nothing has
                been posted or charged.
              </li>
              <li>
                If you&rsquo;ve used your monthly crosslist allowance, SaleLinx
                says the limit is reached. It resets at the start of each month
                (UTC); see{' '}
                <Link href="/pricing" className="underline underline-offset-4">
                  pricing
                </Link>{' '}
                for bigger plans.
              </li>
            </ol>
            <p>
              If one marketplace keeps failing, check the{' '}
              <Link
                href="/docs/status"
                className="underline underline-offset-4"
              >
                marketplace status page
              </Link>
              .
            </p>
          </div>
        ),
        keywords: ['stuck', 'hanging', 'frozen', 'slow', 'queued', 'crosslist', 'ebay', 'busy'],
      },
      {
        id: 'listing-failed-to-post',
        q: 'A crosslisted item failed',
        a: (
          <p>
            The queue at the bottom of the panel&rsquo;s sidebar shows how many
            items failed. Most failures come from being signed out of the
            marketplace you&rsquo;re copying to, or from details that
            marketplace wouldn&rsquo;t accept. Sign in there with your linked
            account, then select the item in <strong>My Listings</strong> and
            click <strong>Crosslist</strong> again. When eBay refuses an item,
            the review step says what eBay needs, usually an item specific such
            as size or department: click <strong>Fill in</strong>, add it, and
            the item can be posted. From version 1.1.12, failed
            items don&rsquo;t count towards your monthly crosslist allowance.
            If a whole marketplace is having problems, check the{' '}
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
        id: 'presets-not-syncing',
        q: 'My saved presets aren&rsquo;t on my other computer',
        a: (
          <p>
            Saved presets sync through your SaleLinx account on any active plan
            or trial, so first check that both devices are signed in to the
            same account and that your plan is active. Which preset is selected
            is per device, so pick it again on the second machine. Signing out
            clears presets from that browser; they come back on the next
            sign-in. Details in{' '}
            <Link
              href="/docs/getting-started/account-and-subscription"
              className="underline underline-offset-4"
            >
              Account and subscription
            </Link>
            .
          </p>
        ),
        keywords: ['preset', 'presets', 'settings', 'sync', 'device'],
      },
      {
        id: 'contact-support',
        q: 'How do I contact support?',
        a: (
          <p>
            Open the <strong>Support</strong> tab in the SaleLinx panel, choose
            a <strong>Type</strong>, describe the problem and click{' '}
            <strong>Submit</strong>. Tickets sent from the panel include your
            extension version and plan, which helps us find the cause. You can
            also write to us from the{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              contact page
            </Link>{' '}
            or email{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>
            . We email you when we reply, and you can follow and answer the
            conversation in <strong>My tickets</strong> in the Support tab or
            under <strong>Your tickets</strong> on your{' '}
            <Link href="/account" className="underline underline-offset-4">
              account page
            </Link>
            .
          </p>
        ),
        keywords: ['support', 'contact', 'help', 'ticket', 'email', 'bug'],
      },
    ],
  },
  {
    slug: 'ebay',
    title: 'eBay',
    blurb: 'Connecting eBay, managing and crosslisting eBay listings, and what it costs.',
    items: [
      {
        id: 'ebay-connect',
        q: 'How do I connect my eBay account?',
        a: <p>Open the SaleLinx panel, go to <em>Settings</em>, and click <em>Link</em> on the eBay row. Sign in on eBay&rsquo;s own page and agree to let SaleLinx manage your listings. SaleLinx never sees your eBay password, and you can unlink at any time.</p>,
        keywords: ['ebay', 'connect', 'link', 'account'],
      },
      {
        id: 'ebay-fees',
        q: 'Does crosslisting to eBay cost anything?',
        a: <p>eBay charges its normal listing fees, the same as listing by hand. SaleLinx shows eBay&rsquo;s fee for every item before anything is posted, so you can go back or remove items first. eBay listings go live straight away, because eBay has no drafts.</p>,
        keywords: ['ebay', 'fees', 'cost', 'crosslist'],
      },
      {
        id: 'ebay-tab',
        q: 'Do I need an eBay tab open?',
        a: (
          <p>
            No. eBay connects through eBay&rsquo;s own sign-in, so SaleLinx
            reaches your eBay listings without an eBay tab open. You still open
            the panel itself from a Depop, Vinted or eBay page.
          </p>
        ),
        keywords: ['ebay', 'tab', 'open'],
      },
      {
        id: 'ebay-manage-listings',
        q: 'Can I edit, end or relist eBay listings from SaleLinx?',
        a: (
          <p>
            Yes. Your eBay listings appear in <strong>My Listings</strong>.
            Open one to edit its title, description, price, quantity, photos,
            condition, category and item specifics, and save straight to eBay.{' '}
            <strong>Unlist</strong> ends the listing; eBay has no delete, so
            deleting an eBay row ends the listing too. An ended listing opens
            with a <strong>Relist</strong> option. More in the{' '}
            <Link
              href="/docs/inventory/listings"
              className="underline underline-offset-4"
            >
              My Listings guide
            </Link>
            .
          </p>
        ),
        keywords: ['ebay', 'edit', 'end', 'unlist', 'relist', 'delete', 'my listings'],
      },
      {
        id: 'ebay-postage',
        q: 'Where does postage come from when I crosslist to eBay?',
        a: (
          <p>
            From your eBay account. SaleLinx uses your eBay business policies,
            or copies postage and returns from one of your existing eBay
            listings. If there&rsquo;s nothing to copy, the Crosslist tab asks
            for your postage once, and you can change it later in{' '}
            <strong>Settings &rarr; eBay &rarr; Postage</strong>.
          </p>
        ),
        keywords: ['ebay', 'postage', 'shipping', 'returns', 'policies'],
      },
      {
        id: 'ebay-busy',
        q: 'What does &ldquo;eBay is busy right now&rdquo; mean?',
        a: (
          <p>
            eBay is temporarily turning requests away. Try again later; nothing
            has been posted or charged.
          </p>
        ),
        keywords: ['ebay', 'busy', 'error', 'try again'],
      },
      {
        id: 'ebay-reconnect',
        q: 'SaleLinx asks me to reconnect eBay',
        a: (
          <p>
            The permission eBay gives SaleLinx runs out after a while, and it
            also ends if you remove SaleLinx&rsquo;s access in your eBay
            account. Open <strong>Settings</strong> in the panel and click{' '}
            <strong>Link</strong> on the eBay row to approve it again. Your
            eBay listings aren&rsquo;t affected.
          </p>
        ),
        keywords: ['ebay', 'reconnect', 'link', 'expired', 'access'],
      },
      {
        id: 'ebay-disconnect',
        q: 'How do I disconnect eBay?',
        a: (
          <p>
            Open <strong>Settings</strong> in the panel and click{' '}
            <strong>Unlink</strong> on the eBay row. SaleLinx deletes its eBay
            access straight away, and your listings on eBay stay as they are.
          </p>
        ),
        keywords: ['ebay', 'disconnect', 'unlink', 'remove'],
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
            No. SaleLinx works through the Depop and Vinted sessions
            you&rsquo;re already signed in to in your own browser, so you never
            give us a marketplace password. To link a shop to your SaleLinx
            account, we store only its username and account ID. eBay connects through eBay&rsquo;s own sign-in page, and SaleLinx never sees your eBay password. For eBay we also keep the access token eBay gives us, so SaleLinx can act on your listings.
          </p>
        ),
        keywords: ['password', 'credentials', 'security'],
      },
      {
        id: 'where-is-my-data',
        q: 'Where is my data stored?',
        a: (
          <p>
            Your SaleLinx account, plan, settings and linked shop usernames are
            stored with our database provider, Supabase, and payments are
            handled by Stripe. Listing details and photos are only stored with
            us for listings you save to the cloud; the rest of what SaleLinx
            reads from Depop and Vinted isn&rsquo;t stored on our servers. eBay
            requests go through our servers, which keep the access eBay grants
            for your account and the postage details you set for eBay
            crosslists, including the postcode you send from. Data
            travels over HTTPS, Supabase encrypts it at rest, and access rules
            tie every listing and photo to your account. Where our providers
            process data is set out in our{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>
            .
          </p>
        ),
        keywords: ['data', 'storage', 'supabase', 'cloud', 'region', 'encryption'],
      },
      {
        id: 'delete-my-data',
        q: 'How do I delete my data?',
        a: (
          <p>
            Open your{' '}
            <Link href="/account" className="underline underline-offset-4">
              account page
            </Link>
            , scroll to the bottom and click <strong>Delete account</strong>.
            Enter your password (not needed if you sign in with Google) and we
            email you a confirmation link: open it within 60 minutes while
            signed in and confirm once more. Your account, listings, images,
            linked marketplace accounts (including your eBay connection), usage
            history and support tickets are
            then deleted straight away, and any subscription is canceled with
            no refund for the time left. You can also email{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            from the address on your account and we&rsquo;ll complete the
            deletion within 30 days.
          </p>
        ),
        keywords: ['delete', 'gdpr', 'remove', 'account', 'erase'],
      },
    ],
  },
];
