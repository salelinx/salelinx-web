import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  LegalSections,
  type LegalSection,
} from "@/components/legal/LegalSections";
import { pageMetadata } from "@/lib/site";

// Like the privacy policy, the terms body is hardcoded English on purpose.
// Only the page title is translated. See components/legal/LegalSections.tsx.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.terms" });
  return pageMetadata({
    locale,
    path: "/legal/terms",
    title: t("title"),
    description: t("metaDescription"),
  });
}

const LAST_UPDATED = "16 August 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "Agreement",
    paragraphs: [
      "These terms are a contract between you and SaleLinx Ltd, a company registered in England and Wales with company number 17351832 and registered office at 34 Sussex Place, London, W2 2TH (\"SaleLinx\", \"we\", \"us\"), covering your use of the SaleLinx browser extension and the salelinx.com website (together, the \"service\"). By creating an account or using the service you agree to these terms. If you do not agree, do not use the service.",
      "Our privacy policy explains how we handle personal data and forms part of these terms.",
    ],
  },
  {
    heading: "The service",
    paragraphs: [
      "SaleLinx helps resellers manage, cross-list, and automate tasks for their own listings on Depop and Vinted. The extension works through the marketplace sessions already signed in on your device.",
      "SaleLinx is an independent tool. We are not affiliated with, endorsed by, or sponsored by Depop, Vinted, or any marketplace. Their names are used only to describe compatibility.",
    ],
  },
  {
    heading: "Your account",
    bullets: [
      "You must provide a valid email address and keep your login credentials secure, whether that is your password or the third-party account you sign in with (such as Google). You are responsible for activity under your account.",
      "You must meet the minimum age required by the marketplaces you use with SaleLinx, and in any case be at least 16.",
      "One account is for one person. Do not share or resell access to your account.",
    ],
  },
  {
    heading: "Subscriptions, trials, and billing",
    bullets: [
      "Paid plans are billed in advance on a recurring basis through Stripe. Your plan renews automatically until you cancel.",
      "Free trials require a payment method and convert to a paid subscription at the end of the trial unless you cancel before it ends.",
      "You can cancel at any time from the billing portal in your account. Cancellation takes effect at the end of the current billing period; you keep access until then.",
      "If we change the price of your plan we will give you at least 30 days notice by email, and the new price applies from your next renewal after the notice period.",
    ],
    trailing: [
      "Except where the law gives you a non-waivable right to a refund, payments are non-refundable and we do not give partial refunds for unused time. Nothing in these terms limits your statutory rights as a consumer.",
    ],
  },
  {
    heading: "Plan limits",
    paragraphs: [
      "Each plan includes usage limits (for example, cross-lists per month). Limits are shown on the pricing page and enforced automatically. We may adjust limits for future billing periods; if we materially reduce a limit on a paid plan we will give you advance notice.",
    ],
  },
  {
    heading: "Acceptable use",
    bullets: [
      "Use SaleLinx only with marketplace accounts you own and listings you have the right to manage.",
      "You are responsible for complying with the terms of service of each marketplace you use. Automating actions on a marketplace may be restricted by that marketplace's terms, and you use automation features at your own risk.",
      "Do not use the service for unlawful activity, including selling counterfeit or prohibited items.",
      "Do not abuse, probe, overload, or attempt to gain unauthorised access to the service or its infrastructure, and do not resell or white-label the service.",
    ],
    trailing: [
      "Marketplaces may change their sites, throttle activity, or take action against accounts at their sole discretion. SaleLinx is not responsible for actions a marketplace takes against your account.",
    ],
  },
  {
    heading: "Your content",
    paragraphs: [
      "You keep all rights to your listing content (titles, descriptions, photos, prices). If you enable cloud sync or backup, you grant us permission to store and process that content solely to provide those features to you. We claim no other rights to it.",
    ],
  },
  {
    heading: "Buyer data",
    paragraphs: [
      "Order features such as shipping labels involve personal data about your buyers (for example names and delivery details printed on labels). For that data, you are the data controller and SaleLinx acts as your processor: we process buyer data only on your instructions, only to provide the feature you invoked (for example delivering a label email to the address you chose), and we do not store it after delivery.",
      "You are responsible for having a lawful basis to use your buyers' data and for sending labels only to recipients who legitimately need them. Details are in our privacy policy.",
    ],
  },
  {
    heading: "Availability and changes to the service",
    paragraphs: [
      "We work to keep the service reliable, but it is provided \"as is\" and \"as available\". Because the extension depends on third-party marketplaces we do not control, features can break when marketplaces change their sites, and we may modify or discontinue features to keep the service working. If we discontinue a material paid feature, we will give you reasonable notice.",
    ],
  },
  {
    heading: "Intellectual property",
    paragraphs: [
      "The service, including the extension code, website, and branding, is owned by SaleLinx and protected by intellectual property law. We grant you a personal, non-exclusive, non-transferable licence to use the service while you have an account. You may not copy, modify, distribute, or reverse engineer the service except where the law permits it despite this restriction.",
    ],
  },
  {
    heading: "Liability",
    paragraphs: [
      "Nothing in these terms excludes or limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot lawfully be excluded.",
      "Subject to that, we are not liable for indirect or consequential losses, lost profits, lost sales, or losses caused by a marketplace's actions against your account, and our total liability arising out of the service in any 12-month period is limited to the amount you paid us in that period (or 50 GBP if you paid nothing).",
    ],
  },
  {
    heading: "Termination",
    paragraphs: [
      "You can stop using the service and delete your account at any time (see the privacy policy for how deletion works).",
      "We may suspend or terminate your account if you materially breach these terms, if we are required to by law, or if we discontinue the service. If we terminate a paid account without cause, we will refund the unused part of your current billing period.",
    ],
  },
  {
    heading: "Changes to these terms",
    paragraphs: [
      "We may update these terms from time to time. If a change is material we will notify you by email or in the product at least 14 days before it takes effect. Continuing to use the service after a change takes effect means you accept the updated terms.",
    ],
  },
  {
    heading: "Governing law",
    paragraphs: [
      "These terms are governed by the law of England and Wales, and disputes are subject to the courts of England and Wales. If you are a consumer living elsewhere, you also keep the protection of any mandatory consumer rules of the country you live in, and you may bring proceedings there.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Questions about these terms: support@salelinx.com, or write to SaleLinx Ltd, 34 Sussex Place, London, W2 2TH, United Kingdom.",
    ],
  },
];

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.terms" });
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Last updated: {LAST_UPDATED}
      </p>
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        These terms are provided in English.
      </p>
      <LegalSections sections={SECTIONS} />
    </main>
  );
}
