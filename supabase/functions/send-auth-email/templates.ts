// deno-lint-ignore-file
// HTML + text templates for Supabase auth emails. Rendered server-side in the
// send-auth-email Edge Function and handed to Resend.
//
// Strings are translated to en / fr / es / de. The Edge Function resolves the
// recipient's locale from user_metadata.preferred_locale (written at signup by
// the web app) and falls back to "en" when absent or unknown.

export type EmailActionType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "email_change_current"
  | "email_change_new"
  | "reauthentication";

export type Locale = "en" | "fr" | "es" | "de";

export type RenderInput = {
  actionType: EmailActionType;
  verifyUrl: string;
  token: string;
  recipientEmail: string;
  siteUrl: string;
  locale: Locale;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

const brand = {
  name: "SaleLinx",
  accent: "#1f8a4c",
};

type ActionStrings = {
  subject: string;
  heading: string;
  body: string;
  button: string;
  text: string;
};

type Pack = {
  linkFallbackPrefix: string;
  ignoreFooter: string;
  reauthBodyPrefix: string;
  actions: Record<EmailActionType, ActionStrings>;
  defaultAction: ActionStrings;
};

const en: Pack = {
  linkFallbackPrefix: "Or paste this link into your browser:",
  ignoreFooter: "If you did not request this email, you can safely ignore it.",
  reauthBodyPrefix: "Enter this code to confirm your identity:",
  actions: {
    signup: {
      subject: `Confirm your ${brand.name} email`,
      heading: "Confirm your email",
      body: "Thanks for signing up. Click the button below to confirm your email and activate your account.",
      button: "Confirm email",
      text: `Confirm your email for ${brand.name}:\n\n{url}\n\nIf you did not sign up, you can safely ignore this email.`,
    },
    recovery: {
      subject: `Reset your ${brand.name} password`,
      heading: "Reset your password",
      body: "We got a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.",
      button: "Reset password",
      text: `Reset your ${brand.name} password:\n\n{url}\n\nThis link expires in 1 hour. If you did not request a reset, you can safely ignore this email.`,
    },
    magiclink: {
      subject: `Sign in to ${brand.name}`,
      heading: "Your sign-in link",
      body: `Click the button below to sign in to ${brand.name}.`,
      button: "Sign in",
      text: `Sign in to ${brand.name}:\n\n{url}`,
    },
    invite: {
      subject: `You have been invited to ${brand.name}`,
      heading: "You have been invited",
      body: `You were invited to ${brand.name}. Accept the invite to set up your account.`,
      button: "Accept invite",
      text: `Accept your ${brand.name} invite:\n\n{url}`,
    },
    email_change: {
      subject: `Confirm your ${brand.name} email change`,
      heading: "Confirm your email change",
      body: `Click the button below to confirm this change to your ${brand.name} account.`,
      button: "Confirm email change",
      text: `Confirm your email change for ${brand.name}:\n\n{url}`,
    },
    email_change_current: {
      subject: `Confirm your ${brand.name} email change`,
      heading: "Confirm your email change",
      body: `Click the button below to confirm this change to your ${brand.name} account.`,
      button: "Confirm email change",
      text: `Confirm your email change for ${brand.name}:\n\n{url}`,
    },
    email_change_new: {
      subject: `Confirm your ${brand.name} email change`,
      heading: "Confirm your email change",
      body: `Click the button below to confirm this change to your ${brand.name} account.`,
      button: "Confirm email change",
      text: `Confirm your email change for ${brand.name}:\n\n{url}`,
    },
    reauthentication: {
      subject: `Your ${brand.name} verification code`,
      heading: "Your verification code",
      body: "Enter this code to confirm your identity:",
      button: "",
      text: `Your ${brand.name} verification code: {token}`,
    },
  },
  defaultAction: {
    subject: `Action required for your ${brand.name} account`,
    heading: "Action required",
    body: "Click the link below to continue.",
    button: "Continue",
    text: `Action required for your ${brand.name} account:\n\n{url}`,
  },
};

const fr: Pack = {
  linkFallbackPrefix: "Ou collez ce lien dans votre navigateur :",
  ignoreFooter:
    "Si vous n'avez pas demandé cet e-mail, vous pouvez l'ignorer en toute sécurité.",
  reauthBodyPrefix: "Saisissez ce code pour confirmer votre identité :",
  actions: {
    signup: {
      subject: `Confirmez votre adresse e-mail ${brand.name}`,
      heading: "Confirmez votre adresse e-mail",
      body: "Merci pour votre inscription. Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail et activer votre compte.",
      button: "Confirmer l'adresse e-mail",
      text: `Confirmez votre adresse e-mail pour ${brand.name} :\n\n{url}\n\nSi vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail en toute sécurité.`,
    },
    recovery: {
      subject: `Réinitialisez votre mot de passe ${brand.name}`,
      heading: "Réinitialisez votre mot de passe",
      body: "Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Ce lien expire dans 1 heure.",
      button: "Réinitialiser le mot de passe",
      text: `Réinitialisez votre mot de passe ${brand.name} :\n\n{url}\n\nCe lien expire dans 1 heure. Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet e-mail en toute sécurité.`,
    },
    magiclink: {
      subject: `Connectez-vous à ${brand.name}`,
      heading: "Votre lien de connexion",
      body: `Cliquez sur le bouton ci-dessous pour vous connecter à ${brand.name}.`,
      button: "Se connecter",
      text: `Connectez-vous à ${brand.name} :\n\n{url}`,
    },
    invite: {
      subject: `Vous avez été invité à ${brand.name}`,
      heading: "Vous avez été invité",
      body: `Vous avez été invité à ${brand.name}. Acceptez l'invitation pour configurer votre compte.`,
      button: "Accepter l'invitation",
      text: `Acceptez votre invitation ${brand.name} :\n\n{url}`,
    },
    email_change: {
      subject: `Confirmez le changement d'e-mail de votre compte ${brand.name}`,
      heading: "Confirmez votre changement d'adresse e-mail",
      body: `Cliquez sur le bouton ci-dessous pour confirmer ce changement sur votre compte ${brand.name}.`,
      button: "Confirmer le changement d'e-mail",
      text: `Confirmez le changement d'e-mail sur ${brand.name} :\n\n{url}`,
    },
    email_change_current: {
      subject: `Confirmez le changement d'e-mail de votre compte ${brand.name}`,
      heading: "Confirmez votre changement d'adresse e-mail",
      body: `Cliquez sur le bouton ci-dessous pour confirmer ce changement sur votre compte ${brand.name}.`,
      button: "Confirmer le changement d'e-mail",
      text: `Confirmez le changement d'e-mail sur ${brand.name} :\n\n{url}`,
    },
    email_change_new: {
      subject: `Confirmez le changement d'e-mail de votre compte ${brand.name}`,
      heading: "Confirmez votre changement d'adresse e-mail",
      body: `Cliquez sur le bouton ci-dessous pour confirmer ce changement sur votre compte ${brand.name}.`,
      button: "Confirmer le changement d'e-mail",
      text: `Confirmez le changement d'e-mail sur ${brand.name} :\n\n{url}`,
    },
    reauthentication: {
      subject: `Votre code de vérification ${brand.name}`,
      heading: "Votre code de vérification",
      body: "Saisissez ce code pour confirmer votre identité :",
      button: "",
      text: `Votre code de vérification ${brand.name} : {token}`,
    },
  },
  defaultAction: {
    subject: `Action requise sur votre compte ${brand.name}`,
    heading: "Action requise",
    body: "Cliquez sur le lien ci-dessous pour continuer.",
    button: "Continuer",
    text: `Action requise sur votre compte ${brand.name} :\n\n{url}`,
  },
};

const es: Pack = {
  linkFallbackPrefix: "O pega este enlace en tu navegador:",
  ignoreFooter:
    "Si no has solicitado este correo, puedes ignorarlo sin problema.",
  reauthBodyPrefix: "Introduce este código para confirmar tu identidad:",
  actions: {
    signup: {
      subject: `Confirma tu correo de ${brand.name}`,
      heading: "Confirma tu correo",
      body: "Gracias por registrarte. Haz clic en el botón de abajo para confirmar tu correo y activar tu cuenta.",
      button: "Confirmar correo",
      text: `Confirma tu correo para ${brand.name}:\n\n{url}\n\nSi no te has registrado, puedes ignorar este correo sin problema.`,
    },
    recovery: {
      subject: `Restablece tu contraseña de ${brand.name}`,
      heading: "Restablece tu contraseña",
      body: "Hemos recibido una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para elegir una nueva. Este enlace caduca en 1 hora.",
      button: "Restablecer contraseña",
      text: `Restablece tu contraseña de ${brand.name}:\n\n{url}\n\nEste enlace caduca en 1 hora. Si no has solicitado un restablecimiento, puedes ignorar este correo sin problema.`,
    },
    magiclink: {
      subject: `Inicia sesión en ${brand.name}`,
      heading: "Tu enlace para iniciar sesión",
      body: `Haz clic en el botón de abajo para iniciar sesión en ${brand.name}.`,
      button: "Iniciar sesión",
      text: `Inicia sesión en ${brand.name}:\n\n{url}`,
    },
    invite: {
      subject: `Has sido invitado a ${brand.name}`,
      heading: "Has sido invitado",
      body: `Se te ha invitado a ${brand.name}. Acepta la invitación para configurar tu cuenta.`,
      button: "Aceptar invitación",
      text: `Acepta tu invitación a ${brand.name}:\n\n{url}`,
    },
    email_change: {
      subject: `Confirma el cambio de correo de tu cuenta ${brand.name}`,
      heading: "Confirma tu cambio de correo",
      body: `Haz clic en el botón de abajo para confirmar este cambio en tu cuenta de ${brand.name}.`,
      button: "Confirmar cambio de correo",
      text: `Confirma el cambio de correo en ${brand.name}:\n\n{url}`,
    },
    email_change_current: {
      subject: `Confirma el cambio de correo de tu cuenta ${brand.name}`,
      heading: "Confirma tu cambio de correo",
      body: `Haz clic en el botón de abajo para confirmar este cambio en tu cuenta de ${brand.name}.`,
      button: "Confirmar cambio de correo",
      text: `Confirma el cambio de correo en ${brand.name}:\n\n{url}`,
    },
    email_change_new: {
      subject: `Confirma el cambio de correo de tu cuenta ${brand.name}`,
      heading: "Confirma tu cambio de correo",
      body: `Haz clic en el botón de abajo para confirmar este cambio en tu cuenta de ${brand.name}.`,
      button: "Confirmar cambio de correo",
      text: `Confirma el cambio de correo en ${brand.name}:\n\n{url}`,
    },
    reauthentication: {
      subject: `Tu código de verificación de ${brand.name}`,
      heading: "Tu código de verificación",
      body: "Introduce este código para confirmar tu identidad:",
      button: "",
      text: `Tu código de verificación de ${brand.name}: {token}`,
    },
  },
  defaultAction: {
    subject: `Acción requerida en tu cuenta de ${brand.name}`,
    heading: "Acción requerida",
    body: "Haz clic en el enlace de abajo para continuar.",
    button: "Continuar",
    text: `Acción requerida en tu cuenta de ${brand.name}:\n\n{url}`,
  },
};

const de: Pack = {
  linkFallbackPrefix: "Oder füge diesen Link in deinen Browser ein:",
  ignoreFooter:
    "Wenn du diese E-Mail nicht angefordert hast, kannst du sie gefahrlos ignorieren.",
  reauthBodyPrefix: "Gib diesen Code ein, um deine Identität zu bestätigen:",
  actions: {
    signup: {
      subject: `Bestätige deine ${brand.name}-E-Mail-Adresse`,
      heading: "Bestätige deine E-Mail-Adresse",
      body: "Danke für deine Registrierung. Klicke auf die Schaltfläche unten, um deine E-Mail-Adresse zu bestätigen und dein Konto zu aktivieren.",
      button: "E-Mail bestätigen",
      text: `Bestätige deine E-Mail-Adresse für ${brand.name}:\n\n{url}\n\nWenn du dich nicht registriert hast, kannst du diese E-Mail gefahrlos ignorieren.`,
    },
    recovery: {
      subject: `Setze dein ${brand.name}-Passwort zurück`,
      heading: "Setze dein Passwort zurück",
      body: "Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Klicke auf die Schaltfläche unten, um ein neues zu wählen. Dieser Link läuft in 1 Stunde ab.",
      button: "Passwort zurücksetzen",
      text: `Setze dein ${brand.name}-Passwort zurück:\n\n{url}\n\nDieser Link läuft in 1 Stunde ab. Wenn du kein Zurücksetzen angefordert hast, kannst du diese E-Mail gefahrlos ignorieren.`,
    },
    magiclink: {
      subject: `Melde dich bei ${brand.name} an`,
      heading: "Dein Anmeldelink",
      body: `Klicke auf die Schaltfläche unten, um dich bei ${brand.name} anzumelden.`,
      button: "Anmelden",
      text: `Melde dich bei ${brand.name} an:\n\n{url}`,
    },
    invite: {
      subject: `Du wurdest zu ${brand.name} eingeladen`,
      heading: "Du wurdest eingeladen",
      body: `Du wurdest zu ${brand.name} eingeladen. Nimm die Einladung an, um dein Konto einzurichten.`,
      button: "Einladung annehmen",
      text: `Nimm deine ${brand.name}-Einladung an:\n\n{url}`,
    },
    email_change: {
      subject: `Bestätige die E-Mail-Änderung deines ${brand.name}-Kontos`,
      heading: "Bestätige deine E-Mail-Änderung",
      body: `Klicke auf die Schaltfläche unten, um diese Änderung an deinem ${brand.name}-Konto zu bestätigen.`,
      button: "E-Mail-Änderung bestätigen",
      text: `Bestätige die E-Mail-Änderung bei ${brand.name}:\n\n{url}`,
    },
    email_change_current: {
      subject: `Bestätige die E-Mail-Änderung deines ${brand.name}-Kontos`,
      heading: "Bestätige deine E-Mail-Änderung",
      body: `Klicke auf die Schaltfläche unten, um diese Änderung an deinem ${brand.name}-Konto zu bestätigen.`,
      button: "E-Mail-Änderung bestätigen",
      text: `Bestätige die E-Mail-Änderung bei ${brand.name}:\n\n{url}`,
    },
    email_change_new: {
      subject: `Bestätige die E-Mail-Änderung deines ${brand.name}-Kontos`,
      heading: "Bestätige deine E-Mail-Änderung",
      body: `Klicke auf die Schaltfläche unten, um diese Änderung an deinem ${brand.name}-Konto zu bestätigen.`,
      button: "E-Mail-Änderung bestätigen",
      text: `Bestätige die E-Mail-Änderung bei ${brand.name}:\n\n{url}`,
    },
    reauthentication: {
      subject: `Dein ${brand.name}-Bestätigungscode`,
      heading: "Dein Bestätigungscode",
      body: "Gib diesen Code ein, um deine Identität zu bestätigen:",
      button: "",
      text: `Dein ${brand.name}-Bestätigungscode: {token}`,
    },
  },
  defaultAction: {
    subject: `Aktion erforderlich für dein ${brand.name}-Konto`,
    heading: "Aktion erforderlich",
    body: "Klicke auf den Link unten, um fortzufahren.",
    button: "Weiter",
    text: `Aktion erforderlich für dein ${brand.name}-Konto:\n\n{url}`,
  },
};

const PACKS: Record<Locale, Pack> = { en, fr, es, de };

function packFor(locale: Locale): Pack {
  return PACKS[locale] ?? PACKS.en;
}

function layout(bodyHtml: string, ignoreFooter: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f4;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;padding:40px;max-width:560px;border:1px solid #e7e5e4;">
            <tr>
              <td>
                <div style="font-size:14px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${brand.accent};margin-bottom:24px;">${brand.name}</div>
                ${bodyHtml}
                <hr style="border:none;border-top:1px solid #e7e5e4;margin:32px 0 16px;" />
                <p style="font-size:12px;color:#78716c;line-height:1.6;margin:0;">
                  ${ignoreFooter}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${brand.accent};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">${label}</a>`;
}

function linkFallback(url: string, prefix: string): string {
  return `<p style="font-size:13px;color:#57534e;line-height:1.6;margin:24px 0 0;">${prefix}<br /><a href="${url}" style="color:${brand.accent};word-break:break-all;">${url}</a></p>`;
}

function fillText(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

export function renderEmail(input: RenderInput): RenderedEmail {
  const { actionType, verifyUrl, token, locale } = input;
  const pack = packFor(locale);

  if (actionType === "reauthentication") {
    const strings = pack.actions.reauthentication;
    const html = layout(
      `
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">${strings.heading}</h1>
        <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 16px;">
          ${strings.body}
        </p>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:0.25em;background:#f5f5f4;border:1px solid #e7e5e4;border-radius:8px;padding:16px;text-align:center;">${token}</div>
      `,
      pack.ignoreFooter,
    );
    return {
      subject: strings.subject,
      html,
      text: fillText(strings.text, { token }),
    };
  }

  const strings =
    actionType in pack.actions
      ? pack.actions[actionType]
      : pack.defaultAction;

  const html = layout(
    `
      <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">${strings.heading}</h1>
      <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 24px;">
        ${strings.body}
      </p>
      ${button(verifyUrl, strings.button)}
      ${linkFallback(verifyUrl, pack.linkFallbackPrefix)}
    `,
    pack.ignoreFooter,
  );
  return {
    subject: strings.subject,
    html,
    text: fillText(strings.text, { url: verifyUrl }),
  };
}
