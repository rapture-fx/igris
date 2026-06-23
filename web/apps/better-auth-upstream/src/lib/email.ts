// Transactional email for auth recovery/verification, sent via Resend's REST API.
//
// Dependency-free on purpose: this uses fetch() against Resend rather than the
// `resend` npm package, so the auth service ships no extra dependency. It mirrors
// the Go ResendClient conventions (RESEND_API_KEY, RESEND_FROM_EMAIL with the same
// default sender) so all Igris email originates from one verified domain.
//
// Security: never log token-bearing URLs, tokens, or the email body. Only a
// redacted recipient and the message kind are logged.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Igris Inertial <noreply@igrisinertial.com>';

export type SendResult = { sent: boolean; skipped?: boolean; error?: string };

/** Redact an email for logs: a***@example.com — never log the full address. */
function redactEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const first = email[0];
  return `${first}***${email.slice(at)}`;
}

/**
 * Send a transactional email. If RESEND_API_KEY is unset the call is a graceful
 * no-op (returns { skipped: true }) so the surrounding auth flow never throws in
 * environments without email configured. With the key present it sends via Resend.
 */
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;

  if (!apiKey) {
    // Do not fail the auth flow; surface a clear, secret-free warning instead.
    console.warn(
      `[auth-email] RESEND_API_KEY not set — skipping "${params.subject}" to ${redactEmail(params.to)}`,
    );
    return { sent: false, skipped: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
      }),
    });

    if (!res.ok) {
      // Resend error body can echo request fields; do not log it verbatim.
      console.error(
        `[auth-email] send failed (${res.status}) for "${params.subject}" to ${redactEmail(params.to)}`,
      );
      return { sent: false, error: `resend_status_${res.status}` };
    }
    return { sent: true };
  } catch {
    console.error(
      `[auth-email] send threw for "${params.subject}" to ${redactEmail(params.to)}`,
    );
    return { sent: false, error: 'resend_request_failed' };
  }
}

const BTN =
  'display:inline-block;padding:10px 18px;background:#1b1912;color:#f6f6f4;text-decoration:none;border-radius:8px;font-size:14px';
const WRAP =
  'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b1912;line-height:1.5;font-size:15px';

/** Password-reset email. `url` is the BetterAuth-generated, token-bearing link. */
export function passwordResetEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Reset your Igris password',
    html: `<div style="${WRAP}">
      <h2 style="font-size:18px;margin:0 0 12px">Reset your password</h2>
      <p>We received a request to reset your Igris Inertial password. Click below to choose a new one. This link expires shortly and can be used once.</p>
      <p style="margin:20px 0"><a href="${url}" style="${BTN}">Reset password</a></p>
      <p style="font-size:13px;color:#6a6a5c">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    </div>`,
    text: `Reset your Igris password by opening this one-time link (it expires shortly): ${url}\n\nIf you didn't request this, ignore this email.`,
  };
}

/** Email-verification email. `url` is the BetterAuth-generated, token-bearing link. */
export function verificationEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Verify your Igris email',
    html: `<div style="${WRAP}">
      <h2 style="font-size:18px;margin:0 0 12px">Verify your email</h2>
      <p>Confirm this email address to finish setting up your Igris Inertial account.</p>
      <p style="margin:20px 0"><a href="${url}" style="${BTN}">Verify email</a></p>
      <p style="font-size:13px;color:#6a6a5c">If you didn't create an Igris account, you can ignore this email.</p>
    </div>`,
    text: `Verify your Igris email by opening this link: ${url}\n\nIf you didn't create an account, ignore this email.`,
  };
}
