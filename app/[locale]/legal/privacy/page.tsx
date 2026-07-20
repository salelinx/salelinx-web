import { getTranslations } from "next-intl/server";
import {
  LegalSections,
  type LegalSection,
} from "@/components/legal/LegalSections";

// The policy body is intentionally English-only and hardcoded rather than
// translated through next-intl: it is a legal document, and a mistranslated
// clause is a liability. Only the page title comes from the Legal namespace.

const LAST_UPDATED = "20 July 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    paragraphs: [
      "SaleLinx (\"SaleLinx\", \"we\", \"us\") provides a browser extension and the website salelinx.com that help resellers manage, cross-list, and automate tasks for their own listings on Depop and Vinted.",
      "For any privacy question or request, contact us at support@salelinx.com.",
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
      "Account information. When you create a SaleLinx account we collect your email address and a password. Passwords are hashed by our authentication provider (Supabase); we cannot read them.",
      "Subscription and billing information. Checkout and card processing are handled by Stripe. We store your subscription tier, billing status, and renewal date. We do not receive or store card numbers.",
      "Listing content (optional). If you enable cloud sync or image backup, the listings you select (titles, descriptions, prices, attributes, and photos) are stored in our database and storage so you can restore and relist them. If you never enable these features, your listing data stays on your device.",
      "Usage counters. We record counts of metered actions (for example crosslists per month or refreshes per day) so we can enforce the limits of your plan. These are numbers only, not the content of the actions.",
      "Support messages. If you open a support ticket or email us, we keep the message and your email address so we can reply, along with basic diagnostics attached to the ticket (extension version, browser user agent, language, and which marketplace it concerns).",
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
      "For your buyers' personal data, you are the data controller: you decide to fetch it from the marketplace and where to send it. SaleLinx acts only on your instructions to deliver the email. You are responsible for handling your buyers' details lawfully, for example not forwarding labels to people who have no business receiving them.",
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
      "To delete your account and all associated data, email support@salelinx.com from your account email address. We will complete the deletion within 30 days, except for records we are legally required to keep (for example invoices).",
    ],
  },
  {
    heading: "Legal bases",
    paragraphs: [
      "Where UK GDPR or EU GDPR applies, we process your data on the following bases: performance of our contract with you (providing the service you signed up for), our legitimate interests (securing and improving the service), and legal obligations (tax and accounting records).",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: [
      "You can ask us to access, correct, export, or delete the personal data we hold about you, or object to or restrict certain processing. Contact support@salelinx.com to exercise any of these rights.",
      "If you are in the UK or EU you also have the right to lodge a complaint with your supervisory authority (in the UK, the Information Commissioner's Office).",
    ],
  },
  {
    heading: "Cookies",
    paragraphs: [
      "The salelinx.com website uses only essential and preference cookies: sign-in cookies that keep you logged in to your account, and a cookie that remembers your light or dark theme choice. We do not use advertising or cross-site tracking cookies.",
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
