import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  LegalSections,
  type LegalSection,
} from "@/components/legal/LegalSections";
import { pageMetadata } from "@/lib/site";

// Like the other legal pages, the body is hardcoded English on purpose: it
// states the material conditions of a promotional offer, and a mistranslated
// condition is a liability. Only the page title comes from the Legal namespace.
// Keep these terms in step with the actual program rules in
// process-referral-rewards/index.ts and docs/REFERRALS.md.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.referralTerms" });
  return pageMetadata({
    locale,
    path: "/legal/referral-terms",
    title: t("title"),
    description: t("metaDescription"),
    // English-only body (see above): canonicalize all locale URLs to the
    // default-locale page rather than claiming hreflang for duplicates.
    contentLocales: ["en"],
  });
}

const LAST_UPDATED = "2 September 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "About the referral program",
    paragraphs: [
      "These terms govern the SaleLinx referral program, operated by SaleLinx Ltd (\"SaleLinx\", \"we\", \"us\"). They apply in addition to our Terms of Service and privacy policy. By sharing a referral link or signing up through one, you agree to these terms.",
      "The program lets an existing customer (the \"referrer\") invite a new user (the \"referee\") with a personal link. If the referee subscribes to a paid plan, the referee gets a discount on their first month and the referrer earns account credit worth a period of their own plan, set by the plan the referee subscribed to. The specific conditions below apply.",
    ],
  },
  {
    heading: "The referee discount",
    bullets: [
      "The discount applies only to a new SaleLinx account that signs up through a referral link and subscribes to a paid plan. It is applied automatically at checkout; no code is needed.",
      "The discount applies to your first payment only, and cannot be combined with any other promotion code. If a referral discount is active on your account, the promo-code field at checkout is not available.",
      "Your referral must be attached before you subscribe. The link remembers your invite in your browser for 30 days; if that period passes, or you clear the cookie, before you subscribe, the discount will not apply.",
      "The size of the discount depends on the plan you choose: each plan has its own referral discount on the first month's price. The exact discounted amount for your plan is shown to you at checkout before you pay.",
    ],
  },
  {
    heading: "The referrer reward",
    bullets: [
      "You earn a reward when someone you referred subscribes to a paid plan and makes their first successful payment. A free trial alone does not earn a reward; the referee must make a real payment.",
      "The reward is account credit worth a period of your own current plan price, set by the plan the referee is on when the reward is granted: one week (25% of your monthly price) if they are on Starter, two weeks (50%) if they are on Pro, and one month (100%) if they are on Business. The credit is applied automatically by Stripe to your upcoming invoices. It is not a cash payment and is not transferable or redeemable for cash.",
      "Rewards are held for 7 days after the referee's first payment before they are granted. If the referee cancels or their subscription lapses during that period, the reward is voided.",
      "To receive a reward you must have your own active paid subscription at the time the reward is granted. If you do not, the reward waits until you do, for up to 90 days, after which it is voided.",
      "You can earn a maximum of 10 rewards per calendar month. Additional qualifying referrals carry over to the following month rather than being lost.",
      "If the referee changes plan during the 7-day hold, the reward is based on the plan they are on when it is granted.",
      "Rewards currently apply to monthly plans. If your plan is billed on another cycle, your reward may be deferred until we can apply it.",
    ],
  },
  {
    heading: "Eligibility and fair use",
    bullets: [
      "You cannot refer yourself. Referrals between accounts controlled by the same person, and any attempt to create fake or duplicate accounts to generate rewards, are not permitted.",
      "A referee can be referred only once, and the referral must be claimed within the first 48 hours of the referee's account.",
      "We may withhold, void, or reverse any discount or reward, and suspend participation, where we reasonably believe the program is being abused or these terms are broken. A reward tied to a payment that is later refunded or charged back may be voided or reversed.",
    ],
  },
  {
    heading: "Changes and ending the program",
    paragraphs: [
      "We may change these terms, change the discount or reward, or pause or end the referral program at any time. Where a change is material we will update this page. Rewards already granted are not affected by a later change, but pending rewards are subject to the terms in force when they are granted.",
    ],
  },
  {
    heading: "Data and privacy",
    paragraphs: [
      "To run the program we record the link between a referrer and the people they refer, the status of each referral, and reward amounts. If you take part and the app offers a leaderboard, a display name and your number of successful referrals may be shown on it to other participants. The display name used is any name you have chosen for the leaderboard, otherwise your linked shop username, or failing that a neutral placeholder. A name you choose is visible to other participants and must be unique, and we may remove or replace any name we consider offensive, misleading, or impersonating someone else. See our privacy policy for how we handle this data.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Questions about the referral program: support@salelinx.com.",
    ],
  },
];

export default async function ReferralTermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.referralTerms" });
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
