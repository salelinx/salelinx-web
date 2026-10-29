import {
  button,
  COMPANY_INFO,
  emailLayout,
  heading,
  linkFallback,
  paragraph,
} from "../_shared/email-theme.ts";

// Mirrors CHROME_WEB_STORE_URL in lib/site.ts, which Deno cannot import.
export const STORE_URL =
  "https://chromewebstore.google.com/detail/salelinx/oichfmfogobecihmhlgkfcfbdceomenj";

export type Locale = "en" | "fr" | "es" | "de";
export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "fr", "es", "de"];

const EMAIL_COPY: Record<
  Locale,
  { subject: string; preheader: string; heading: string; body: string; cta: string; fallback: string }
> = {
  en: {
    subject: "Your SaleLinx install link",
    preheader: "Open this on your computer to add SaleLinx to Chrome.",
    heading: "Add SaleLinx to Chrome",
    body: "SaleLinx is a Chrome extension, so it installs on a computer rather than a phone. Open this email on your computer, add SaleLinx to Chrome, then sign in with the account you just created.",
    cta: "Add to Chrome",
    fallback: "Or copy this link into Chrome on your computer:",
  },
  fr: {
    subject: "Votre lien d'installation SaleLinx",
    preheader: "Ouvrez ceci sur votre ordinateur pour ajouter SaleLinx à Chrome.",
    heading: "Ajouter SaleLinx à Chrome",
    body: "SaleLinx est une extension Chrome : elle s'installe sur un ordinateur, pas sur un téléphone. Ouvrez cet e-mail sur votre ordinateur, ajoutez SaleLinx à Chrome, puis connectez-vous avec le compte que vous venez de créer.",
    cta: "Ajouter à Chrome",
    fallback: "Ou copiez ce lien dans Chrome sur votre ordinateur :",
  },
  es: {
    subject: "Tu enlace para instalar SaleLinx",
    preheader: "Ábrelo en tu ordenador para añadir SaleLinx a Chrome.",
    heading: "Añade SaleLinx a Chrome",
    body: "SaleLinx es una extensión de Chrome, así que se instala en un ordenador, no en el móvil. Abre este correo en tu ordenador, añade SaleLinx a Chrome e inicia sesión con la cuenta que acabas de crear.",
    cta: "Añadir a Chrome",
    fallback: "O copia este enlace en Chrome en tu ordenador:",
  },
  de: {
    subject: "Dein SaleLinx-Installationslink",
    preheader: "Öffne das auf deinem Computer, um SaleLinx zu Chrome hinzuzufügen.",
    heading: "SaleLinx zu Chrome hinzufügen",
    body: "SaleLinx ist eine Chrome-Erweiterung und wird auf einem Computer installiert, nicht auf dem Handy. Öffne diese E-Mail auf deinem Computer, füge SaleLinx zu Chrome hinzu und melde dich mit dem Konto an, das du gerade erstellt hast.",
    cta: "Zu Chrome hinzufügen",
    fallback: "Oder kopiere diesen Link in Chrome auf deinem Computer:",
  },
};

export function installLinkEmail(locale: Locale): { subject: string; html: string; text: string } {
  const c = EMAIL_COPY[locale];
  const html = emailLayout({
    preheader: c.preheader,
    eyebrow: "SaleLinx",
    bodyHtml: [
      heading(c.heading),
      paragraph(c.body),
      button(STORE_URL, c.cta),
      linkFallback(STORE_URL, c.fallback),
    ].join("\n"),
  });
  const text = `${c.heading}\n\n${c.body}\n\n${c.cta}: ${STORE_URL}\n\n${COMPANY_INFO}\n`;
  return { subject: c.subject, html, text };
}
