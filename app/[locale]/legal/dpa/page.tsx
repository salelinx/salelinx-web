import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  LegalSections,
  type LegalSection,
} from "@/components/legal/LegalSections";
import { pageMetadata } from "@/lib/site";

// Like the privacy policy and terms, the DPA body is hardcoded English on
// purpose: it is a legal document, and a mistranslated clause is a liability.
// Only the page title comes from the Legal namespace.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.dpa" });
  return pageMetadata({
    locale,
    path: "/legal/dpa",
    title: t("title"),
    description: t("metaDescription"),
  });
}

const LAST_UPDATED = "17 August 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "About this addendum",
    paragraphs: [
      "This Data Processing Addendum (\"DPA\") forms part of the agreement between you and SaleLinx Ltd, a company registered in England and Wales with company number 17351832 and registered office at 34 Sussex Place, London, W2 2TH (\"SaleLinx\", \"we\", \"us\"), and applies whenever SaleLinx processes personal data about your buyers on your behalf.",
      "It covers only buyer personal data that SaleLinx processes as your processor. It does not cover the account and billing data we hold about you, for which SaleLinx is itself the controller; that is described in our privacy policy.",
      "Where UK GDPR or EU GDPR applies, this DPA is the written contract required by Article 28. Terms such as controller, processor, processing, personal data, and data subject have the meanings given to them in that legislation.",
    ],
  },
  {
    heading: "Roles of the parties",
    paragraphs: [
      "For buyer personal data, you are the controller and SaleLinx is your processor. You decide to fetch buyer details from the marketplace and where to send them; SaleLinx processes that data only to carry out the feature you invoked.",
      "You are responsible for having a lawful basis to process your buyers' personal data and for giving your buyers any privacy information the law requires. You must only use SaleLinx features with buyer data you are entitled to process.",
    ],
  },
  {
    heading: "Subject matter and details of the processing",
    bullets: [
      "Subject matter: processing buyer personal data as needed to provide the SaleLinx order features you use, principally the email shipping labels feature.",
      "Duration: for each instruction, only for as long as it takes to carry it out (for example, to deliver a label email). SaleLinx does not retain buyer personal data after the instruction is completed.",
      "Nature and purpose: transient handling and onward delivery of buyer data (for example, passing a label PDF to our email provider so it reaches the address you chose). SaleLinx does not store buyer data on its servers and does not include it in cloud sync.",
      "Types of personal data: buyer name and username, and the delivery details printed on a shipping label (such as postal address), as read from the marketplace at your instruction.",
      "Categories of data subjects: your buyers on the marketplaces you use with SaleLinx (currently Depop and Vinted).",
    ],
  },
  {
    heading: "Our obligations as processor",
    bullets: [
      "We process buyer personal data only on your documented instructions, which are given through your use of the relevant SaleLinx features, unless we are required to process it by law (in which case we will tell you, unless the law prohibits it).",
      "We ensure that people authorised to process buyer personal data are bound by appropriate confidentiality obligations.",
      "We implement appropriate technical and organisational measures to keep buyer personal data secure, taking into account the state of the art, the risks, and the transient nature of the processing.",
      "We assist you, taking into account the nature of the processing, in responding to requests from data subjects and in meeting your obligations around security, breach notification, and data protection impact assessments.",
      "We make available the information reasonably necessary to demonstrate compliance with Article 28 and allow for and contribute to audits, on reasonable prior notice and subject to confidentiality.",
      "We notify you without undue delay after becoming aware of a personal data breach affecting buyer personal data processed on your behalf.",
    ],
  },
  {
    heading: "Subprocessors",
    paragraphs: [
      "You give general authorisation for SaleLinx to engage subprocessors to help provide the service. Each subprocessor is bound by data protection terms no less protective than those in this DPA, and SaleLinx remains responsible for their performance.",
      "The subprocessors currently used to process buyer personal data are:",
    ],
    bullets: [
      "Resend (email delivery): delivers shipping label emails you choose to send, including the label PDF that contains the buyer delivery details the carrier prints. Data is processed only to deliver the email and is not retained by us afterwards.",
      "Supabase (platform infrastructure) and Vercel (website hosting): provide the infrastructure through which an instruction passes; they do not receive a stored copy of buyer personal data, which SaleLinx does not persist.",
    ],
    trailing: [
      "If we intend to add or replace a subprocessor that processes buyer personal data, we will update this page before the change takes effect so you have the opportunity to object. Stripe is not listed here because it processes your billing data as a separate controller, not buyer data on your behalf.",
    ],
  },
  {
    heading: "International transfers",
    paragraphs: [
      "Depending on the subprocessor, buyer personal data passed through our systems may be processed in the United Kingdom, the European Union, or the United States. Where personal data is transferred outside the UK or EEA, we rely on an appropriate transfer mechanism, such as the UK International Data Transfer Agreement or the EU Standard Contractual Clauses with any required addendum.",
    ],
  },
  {
    heading: "Return and deletion",
    paragraphs: [
      "Because SaleLinx does not store buyer personal data after completing an instruction, there is normally no buyer personal data for us to return or delete at the end of our services. Any buyer data held transiently to carry out an instruction is discarded once that instruction is complete.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Questions about this addendum or about how we process buyer data: support@salelinx.com, or write to SaleLinx Ltd, 34 Sussex Place, London, W2 2TH, United Kingdom.",
    ],
  },
];

export default async function DpaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.dpa" });
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Last updated: {LAST_UPDATED}
      </p>
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        This addendum is provided in English.
      </p>
      <LegalSections sections={SECTIONS} />
    </main>
  );
}
