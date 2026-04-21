// deno-lint-ignore-file
// HTML + text templates for Supabase auth emails. Rendered server-side in the
// send-auth-email Edge Function and handed to Resend.

export type EmailActionType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "email_change_current"
  | "email_change_new"
  | "reauthentication";

export type RenderInput = {
  actionType: EmailActionType;
  verifyUrl: string;
  token: string;
  recipientEmail: string;
  siteUrl: string;
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

function layout(bodyHtml: string): string {
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
                  If you did not request this email, you can safely ignore it.
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

function linkFallback(url: string): string {
  return `<p style="font-size:13px;color:#57534e;line-height:1.6;margin:24px 0 0;">Or paste this link into your browser:<br /><a href="${url}" style="color:${brand.accent};word-break:break-all;">${url}</a></p>`;
}

export function renderEmail(input: RenderInput): RenderedEmail {
  const { actionType, verifyUrl, token } = input;

  switch (actionType) {
    case "signup": {
      const html = layout(`
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">Confirm your email</h1>
        <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 24px;">
          Thanks for signing up. Click the button below to confirm your email and activate your account.
        </p>
        ${button(verifyUrl, "Confirm email")}
        ${linkFallback(verifyUrl)}
      `);
      return {
        subject: `Confirm your ${brand.name} email`,
        html,
        text: `Confirm your email for ${brand.name}:\n\n${verifyUrl}\n\nIf you did not sign up, you can safely ignore this email.`,
      };
    }

    case "recovery": {
      const html = layout(`
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">Reset your password</h1>
        <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 24px;">
          We got a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.
        </p>
        ${button(verifyUrl, "Reset password")}
        ${linkFallback(verifyUrl)}
      `);
      return {
        subject: `Reset your ${brand.name} password`,
        html,
        text: `Reset your ${brand.name} password:\n\n${verifyUrl}\n\nThis link expires in 1 hour. If you did not request a reset, you can safely ignore this email.`,
      };
    }

    case "magiclink": {
      const html = layout(`
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">Your sign-in link</h1>
        <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 24px;">
          Click the button below to sign in to ${brand.name}.
        </p>
        ${button(verifyUrl, "Sign in")}
        ${linkFallback(verifyUrl)}
      `);
      return {
        subject: `Sign in to ${brand.name}`,
        html,
        text: `Sign in to ${brand.name}:\n\n${verifyUrl}`,
      };
    }

    case "invite": {
      const html = layout(`
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">You have been invited</h1>
        <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 24px;">
          You were invited to ${brand.name}. Accept the invite to set up your account.
        </p>
        ${button(verifyUrl, "Accept invite")}
        ${linkFallback(verifyUrl)}
      `);
      return {
        subject: `You have been invited to ${brand.name}`,
        html,
        text: `Accept your ${brand.name} invite:\n\n${verifyUrl}`,
      };
    }

    case "email_change":
    case "email_change_new":
    case "email_change_current": {
      const html = layout(`
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">Confirm your email change</h1>
        <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 24px;">
          Click the button below to confirm this change to your ${brand.name} account.
        </p>
        ${button(verifyUrl, "Confirm email change")}
        ${linkFallback(verifyUrl)}
      `);
      return {
        subject: `Confirm your ${brand.name} email change`,
        html,
        text: `Confirm your email change for ${brand.name}:\n\n${verifyUrl}`,
      };
    }

    case "reauthentication": {
      const html = layout(`
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">Your verification code</h1>
        <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 16px;">
          Enter this code to confirm your identity:
        </p>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:0.25em;background:#f5f5f4;border:1px solid #e7e5e4;border-radius:8px;padding:16px;text-align:center;">${token}</div>
      `);
      return {
        subject: `Your ${brand.name} verification code`,
        html,
        text: `Your ${brand.name} verification code: ${token}`,
      };
    }

    default: {
      const html = layout(`
        <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">Action required</h1>
        <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 24px;">
          Click the link below to continue.
        </p>
        ${button(verifyUrl, "Continue")}
        ${linkFallback(verifyUrl)}
      `);
      return {
        subject: `Action required for your ${brand.name} account`,
        html,
        text: `Action required for your ${brand.name} account:\n\n${verifyUrl}`,
      };
    }
  }
}
