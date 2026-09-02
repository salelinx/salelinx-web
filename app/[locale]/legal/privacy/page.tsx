import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  LegalSections,
  type LegalSection,
} from "@/components/legal/LegalSections";
import { pageMetadata } from "@/lib/site";

// The policy body is intentionally English-only and hardcoded rather than
// translated through next-intl: it is a legal document, and a mistranslated
// clause is a liability. Only the page title comes from the Legal namespace.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.privacy" });
  return pageMetadata({
    locale,
    path: "/legal/privacy",
    title: t("title"),
    description: t("metaDescription"),
  });
}

const LAST_UPDATED = "2 September 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    paragraphs: [
      "SaleLinx Ltd (\"SaleLinx\", \"we\", \"us\") is a company registered in England and Wales, company number 17351832, with registered office at 34 Sussex Place, London, W2 2TH. We provide a browser extension and the website salelinx.com that help resellers manage, cross-list, and automate tasks for their own listings on Depop and Vinted.",
      "For the personal data we hold about you as an account holder, SaleLinx Ltd is the data controller. For any privacy question or request, contact us at support@salelinx.com.",
    ],
  },
  {
    heading: "Summary",
    bullets: [
      "Your Depop and Vinted session credentials never leave your browser. The extension acts through the marketplace sessions already signed in on your device.",
      "We only store listing content on our servers when you turn on cloud sync or backup features.",
      "Payments are handled by Stripe. We never see or store your card details.",
      "We do not sell or share your data with advertisers or data brokers, and we do not collect your browsing history.",
      "Details about your buyers (names, delivery details on shipping labels) are processed on your device. They reach our systems only if you use the email shipping labels feature, and even then they are only passed through to deliver your email, never stored.",
    ],
  },
  {
    heading: "Information we collect",
    paragraphs: [
      "Account information. When you create a SaleLinx account we collect your email address and a password, or, if you choose Sign in with Google, the email address and basic profile of your Google account instead of a password. Passwords are hashed by our authentication provider (Supabase); we cannot read them.",
      "Subscription and billing information. Checkout and card processing are handled by Stripe. We store your subscription tier, billing status, and renewal date. We do not receive or store card numbers.",
      "Listing content (optional). If you enable cloud sync or image backup, the listings you select (titles, descriptions, prices, attributes, and photos) are stored in our database and storage so you can restore and relist them. If you never enable these features, your listing data stays on your device.",
      "Usage counters. We record counts of feature actions (for example crosslists per month or refreshes per day) so we can enforce the limits of your plan, understand which features are used, and investigate problems when you contact support. These are numbers only, not the content of the actions.",
      "Support messages. If you open a support ticket or email us, we keep the message and your email address so we can reply. Tickets submitted through the site also record your browser version (the user agent string) so we can reproduce technical problems.",
      "Device sessions. To enforce the per-plan limit on how many devices use your account at the same time, the extension records a random identifier it generates for each install, your browser version (user agent string), and when that install was last active. This lets you (and us) see and manage your active devices; it does not identify you personally beyond linking to your account and is deleted when the account is deleted.",
      "Referrals. If you take part in our referral program, we record the link between you and the people you refer, the status of each referral, and any reward amounts. If you refer others, a display name and your number of successful referrals may be shown to other participants on a referral leaderboard. The display name is one you choose yourself; if you have not chosen one, your linked shop username is used, and if you have no linked shop a neutral placeholder is shown instead (never any part of your email address). A name you choose is visible to other participants, must be unique, and can be removed by us if it is offensive or misleading. The referral program and its conditions are described in our Referral Program Terms.",
      "Diagnostics from the extension. The extension reports anonymous technical counters to us: whether calls to marketplace endpoints succeeded or failed, and, when something in the extension crashes, where it happened and the class of error (for example the error type name, never the error message, your listings, or anything you typed). These reports contain no account identifier and cannot be linked to you; we use them to detect marketplace changes and fix bugs.",
      "Uninstall feedback. If you remove the extension, the page that opens invites you to tell us why. The survey is anonymous: it records only the reason you pick, an optional comment, the extension version, and its language. It is not linked to your account, email address, or IP address, so please do not put personal details in the comment box.",
      "Approximate location. When you visit salelinx.com, our hosting provider (Vercel) derives a two-letter country code from your network address, and we use it to show prices in your likely currency and to suggest a language. The country code is used only while building the page; we do not store it or use it for tracking.",
    ],
  },
  {
    heading: "Information the extension handles but does not send to us",
    paragraphs: [
      "To do its job, the extension reads and uses data from Depop and Vinted inside your browser: your session cookies and tokens, your listings, offers, orders, and conversations. This data is processed locally on your device.",
      "Except for the optional cloud features described above, none of it is transmitted to SaleLinx servers. In particular, we never receive your Depop or Vinted passwords, session cookies, or authentication tokens.",
    ],
  },
  {
    heading: "Order and buyer information",
    paragraphs: [
      "When you use order features such as shipping labels, the extension reads details about your sales from the marketplace, including your buyer's name, username, and the delivery details printed on the shipping label. This information belongs to your buyers, and it is processed on your device: it is held in memory while you use the feature, is not saved to our servers, and is not included in cloud sync.",
      "If you use the email shipping labels feature, the label PDF (which contains the buyer details the carrier prints on the label) is sent through our servers and our email provider (Resend) solely to deliver it to the email address you choose. We do not store the PDF or the buyer details it contains after the email is sent.",
      "For your buyers' personal data, you are the data controller: you decide to fetch it from the marketplace and where to send it. SaleLinx acts only on your instructions to deliver the email. You are responsible for handling your buyers' details lawfully, for example not forwarding labels to people who have no business receiving them. The terms on which we process buyer data as your processor, including the subprocessors involved, are set out in our Data Processing Addendum at /legal/dpa.",
    ],
  },
  {
    heading: "What we do not collect",
    bullets: [
      "Your browsing history or activity on any site other than Depop and Vinted pages where the extension runs.",
      "Your marketplace passwords or session credentials.",
      "Advertising identifiers or analytics profiles for ad targeting.",
    ],
  },
  {
    heading: "How we use your information",
    bullets: [
      "To provide and operate the service, including authentication, cloud sync, and restoring your data across devices.",
      "To enforce the usage limits of your subscription plan.",
      "To process subscription payments and manage your plan (via Stripe).",
      "To send service emails such as email verification, password resets, payment issues, and replies to your support tickets (via Resend).",
      "To fix bugs and improve the product.",
    ],
    trailing: [
      "We do not sell personal data, and we do not use it for third-party advertising.",
    ],
  },
  {
    heading: "Chrome Web Store Limited Use disclosure",
    paragraphs: [
      "SaleLinx's use and transfer of information received from Google APIs and of data collected through the extension adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements. Data collected by the extension is used only to provide and improve the features you can see in the extension, and is never sold, used for advertising, or used to determine creditworthiness.",
    ],
  },
  {
    heading: "Service providers",
    paragraphs: [
      "We use a small number of processors to run SaleLinx. Each receives only what it needs to perform its function:",
    ],
    bullets: [
      "Supabase: authentication, database, and file storage (account data, subscription status, usage counters, and cloud-synced listings and images).",
      "Stripe: subscription payments and invoicing.",
      "Resend: transactional email delivery (account and support emails, and shipping label emails you choose to send, which can include label PDFs containing buyer delivery details).",
      "Vercel: hosting for the salelinx.com website.",
      "Google (Sign in with Google): if you choose to sign in with Google, Google processes your sign-in to authenticate you and shares your Google account email and basic profile with us. This happens only when you use the Google sign-in option, is necessary to provide that sign-in method, and is separate from analytics cookies and cookie consent.",
      "Google (Google Analytics): aggregated statistics about how the website is used, only if you consent to analytics cookies in the cookie banner.",
    ],
    trailing: [
      "Depending on the provider, data may be processed in the United Kingdom, the European Union, or the United States, with appropriate safeguards in place for international transfers.",
    ],
  },
  {
    heading: "Data retention and deletion",
    paragraphs: [
      "We keep your account data for as long as your account exists. Cloud-synced listings and images can be removed at any time from within the extension, which deletes them from our storage.",
      "Support tickets and their replies are deleted 24 months after the ticket is closed.",
      "To delete your account and all associated data, use the Delete account section on your account page; deletion takes effect immediately. You can also email support@salelinx.com from your account email address and we will complete the deletion within 30 days. Either way, records we are legally required to keep (for example invoices) are retained.",
    ],
  },
  {
    heading: "Legal bases",
    paragraphs: [
      "Where UK GDPR or EU GDPR applies, we process your data on the following bases: performance of our contract with you (providing the service you signed up for, including authenticating you when you sign in with your email and password or with Google), our legitimate interests (securing and improving the service), legal obligations (tax and accounting records), and your consent (optional analytics cookies, which you can withdraw at any time via the Cookie settings link in the footer).",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: [
      "You can ask us to access, correct, export, or delete the personal data we hold about you, or object to or restrict certain processing. Contact support@salelinx.com to exercise any of these rights. We respond within one month.",
      "If you believe we have mishandled your personal data, you can lodge a data protection complaint with us directly: email support@salelinx.com with the subject line 'Data protection complaint'. We will acknowledge your complaint within 30 days and tell you the outcome of our review.",
      "If you are in the UK or EU you also have the right to lodge a complaint with your supervisory authority (in the UK, the Information Commissioner's Office), whether or not you complain to us first.",
    ],
  },
  {
    heading: "Cookies",
    id: "cookies",
    paragraphs: [
      "salelinx.com sets a small number of first-party cookies. None of them track you across other sites:",
    ],
    bullets: [
      "Sign-in cookies (names starting sb-): keep you logged in to your account. Set by our authentication provider, Supabase, and refreshed while you stay signed in. Essential.",
      "slx_consent: records your cookie consent choice so we do not ask again. Kept for 6 months. Essential.",
      "NEXT_LOCALE: remembers the language you picked with the language switcher. Kept for 12 months. Preference.",
      "slx_ref: set only if you arrive through a referral share link (salelinx.com/r/...), and kept for up to 30 days so we can credit the person who referred you if you sign up. It contains only the referral code, is deleted as soon as the referral is claimed, and is not used for advertising or cross-site tracking.",
      "Google Analytics cookies (_ga and _ga_..., optional, only with your consent): if you choose Accept in our cookie banner, Google Analytics sets these for up to 2 years to help us understand how visitors use the website, such as which pages are viewed and roughly where visitors come from. They are set only after you accept, and you can change your mind at any time via the Cookie settings link in the footer, which also removes them. Google processes this data on our behalf and it may be transferred to the United States with appropriate safeguards in place.",
    ],
    trailing: [
      "Your light or dark theme choice is stored in your browser's local storage on your device; it is never sent to us.",
      "We do not use advertising or cross-site tracking cookies.",
    ],
  },
  {
    heading: "Children",
    paragraphs: [
      "SaleLinx is not directed at children and requires you to meet the minimum age of the marketplaces it works with. We do not knowingly collect data from anyone under 16.",
    ],
  },
  {
    heading: "Changes to this policy",
    paragraphs: [
      "If we make material changes to this policy we will update this page and, where the change is significant, notify you by email or in the product. The date at the top shows when the policy was last revised.",
    ],
  },
];

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.privacy" });
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Last updated: {LAST_UPDATED}
      </p>
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        This policy is provided in English.
      </p>

      <LegalSections sections={SECTIONS} />
    </main>
  );
}
