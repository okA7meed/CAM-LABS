import { Resend } from 'resend';
import { ENV } from '../config/env';
import { AppError } from '../utils/errors';
import { Logger } from '../utils/logger';

/**
 * Backend-only transactional email abstraction.
 *
 * Architecture: Frontend → CAM LABS Backend → EmailService → Resend → inbox.
 * Resend is never called from the frontend and RESEND_API_KEY never leaves
 * the server process. The sender is fully controlled by RESEND_FROM so a
 * future verified domain requires only an env change, never a code change.
 */
let resendClient: Resend | null = null;

const getResendClient = (): Resend => {
  if (!ENV.RESEND_API_KEY) {
    throw new AppError('Password reset email is temporarily unavailable.', 503, 'EMAIL_NOT_CONFIGURED');
  }
  if (!resendClient) resendClient = new Resend(ENV.RESEND_API_KEY);
  return resendClient;
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const buildResetCodeHtml = (code: string, expiryMinutes: number): string => {
  const safeCode = escapeHtml(code);
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#0a0f1c;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Arial,Helvetica,sans-serif;color:#e5e9f2;">
<div style="border:1px solid #1e2a44;border-radius:12px;background-color:#0e1628;padding:32px 28px;">
<div style="font-size:22px;font-weight:bold;letter-spacing:4px;color:#ffffff;">CAM LABS</div>
<div style="font-size:11px;letter-spacing:3px;color:#7d8aa5;margin-top:6px;">ENGINEER &bull; MANUFACTURE &bull; INNOVATE</div>
<div style="height:1px;background-color:#1e2a44;margin:24px 0;"></div>
<div style="font-size:18px;font-weight:bold;color:#ffffff;">PASSWORD RESET VERIFICATION</div>
<p style="font-size:14px;line-height:1.6;color:#b9c3d8;">We received a request to reset the password for your CAM LABS account.</p>
<p style="font-size:14px;color:#b9c3d8;">Your verification code is:</p>
<div style="text-align:center;margin:24px 0;">
<span style="display:inline-block;font-size:36px;font-weight:bold;letter-spacing:10px;color:#ffffff;background-color:#13203a;border:1px solid #2b5cb8;border-radius:10px;padding:16px 24px 16px 34px;">${safeCode}</span>
</div>
<p style="font-size:13px;color:#8b98b3;">This code expires in ${expiryMinutes} minutes.</p>
<p style="font-size:13px;color:#8b98b3;">If you did not request this password reset, you can safely ignore this email.</p>
<div style="height:1px;background-color:#1e2a44;margin:24px 0;"></div>
<div style="font-size:12px;color:#66738e;">CAM LABS Security</div>
</div>
</div>
</body></html>`;
};

const buildResetCodeText = (code: string, expiryMinutes: number): string =>
  [
    'CAM LABS',
    'ENGINEER - MANUFACTURE - INNOVATE',
    '',
    'PASSWORD RESET VERIFICATION',
    '',
    'We received a request to reset the password for your CAM LABS account.',
    '',
    `Your verification code is: ${code}`,
    '',
    `This code expires in ${expiryMinutes} minutes.`,
    '',
    'If you did not request this password reset, you can safely ignore this email.',
    '',
    'CAM LABS Security',
  ].join('\n');

interface ResendFailure {
  message?: string;
  statusCode?: number;
  name?: string;
}

const toSafeSendError = (failure: unknown): AppError => {
  const info = failure as ResendFailure | null;
  const message = typeof info?.message === 'string' ? info.message : '';
  const statusCode = typeof info?.statusCode === 'number' ? info.statusCode : undefined;
  // Resend test-sender restriction (no verified domain): delivery is limited
  // to the Resend account owner's own address. Surface the restriction
  // plainly without echoing addresses, keys, or codes.
  if (
    statusCode === 403 ||
    /testing emails|own email address|not verified|verification/i.test(message)
  ) {
    return new AppError(
      'Email delivery is restricted: the current test sender can only deliver to the Resend account email until a domain is verified.',
      422,
      'RECIPIENT_NOT_ALLOWED',
    );
  }
  return new AppError('Password reset email could not be sent. Please try again.', 502, 'EMAIL_SEND_FAILED');
};

export const EmailService = {
  /**
   * Sends a 6-digit password-reset code. Resolves with the provider message
   * id on acceptance (acceptance is not a delivery guarantee). Never logs
   * or returns the recipient, code, subject details, or API key.
   */
  sendPasswordResetCode: async (to: string, code: string): Promise<{ id: string }> => {
    const client = getResendClient();
    const expiryMinutes = ENV.PASSWORD_RESET_OTP_TTL_MINUTES;    let result: { data?: { id: string } | null; error?: unknown };
    try {
      result = await client.emails.send({
        from: ENV.RESEND_FROM,
        to,
        subject: 'Your CAM LABS Password Reset Code',
        html: buildResetCodeHtml(code, expiryMinutes),
        text: buildResetCodeText(code, expiryMinutes),
      });
    } catch (error) {
      // Network / SDK failure. Log only the failure class, never payload.
      Logger.error('[Email] Resend request failed:', error instanceof Error ? error.name : 'unknown');
      throw toSafeSendError(error);
    }
    if (result.error) {
      const info = result.error as ResendFailure;
      Logger.error('[Email] Resend rejected send:', info?.name ?? `status-${info?.statusCode ?? 'unknown'}`);
      throw toSafeSendError(result.error);
    }
    // Acceptance logged with provider id only — no recipient, no code.
    Logger.info('[Email] Password reset code accepted by provider.');
    return { id: result.data?.id ?? '' };
  },

  /**
   * Sends a 6-digit ownership-verification code (e.g. email change). Same
   * delivery and logging guarantees as the reset sender; copy is neutral so
   * the method stays reusable without leaking flow details.
   */
  sendVerificationCode: async (to: string, code: string, subject: string): Promise<{ id: string }> => {
    const client = getResendClient();
    const expiryMinutes = ENV.PASSWORD_RESET_OTP_TTL_MINUTES;
    const safeCode = escapeHtml(code);
    const safeSubject = escapeHtml(subject);
    let result: { data?: { id: string } | null; error?: unknown };
    try {
      result = await client.emails.send({
        from: ENV.RESEND_FROM,
        to,
        subject: `Your CAM LABS Verification Code — ${subject}`,
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#0a0f1c;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Arial,Helvetica,sans-serif;color:#e5e9f2;">
<div style="border:1px solid #1e2a44;border-radius:12px;background-color:#0e1628;padding:32px 28px;">
<div style="font-size:22px;font-weight:bold;letter-spacing:4px;color:#ffffff;">CAM LABS</div>
<div style="font-size:11px;letter-spacing:3px;color:#7d8aa5;margin-top:6px;">ENGINEER &bull; MANUFACTURE &bull; INNOVATE</div>
<div style="height:1px;background-color:#1e2a44;margin:24px 0;"></div>
<div style="font-size:18px;font-weight:bold;color:#ffffff;">${safeSubject}</div>
<p style="font-size:14px;color:#b9c3d8;">Your verification code is:</p>
<div style="text-align:center;margin:24px 0;">
<span style="display:inline-block;font-size:36px;font-weight:bold;letter-spacing:10px;color:#ffffff;background-color:#13203a;border:1px solid #2b5cb8;border-radius:10px;padding:16px 24px 16px 34px;">${safeCode}</span>
</div>
<p style="font-size:13px;color:#8b98b3;">This code expires in ${expiryMinutes} minutes.</p>
<p style="font-size:13px;color:#8b98b3;">If you did not request this, you can safely ignore this email.</p>
<div style="height:1px;background-color:#1e2a44;margin:24px 0;"></div>
<div style="font-size:12px;color:#66738e;">CAM LABS Security</div>
</div>
</div>
</body></html>`,
        text: ['CAM LABS', '', safeSubject, '', `Your verification code is: ${code}`, '', `This code expires in ${expiryMinutes} minutes.`, '', 'If you did not request this, you can safely ignore this email.'].join('\n'),
      });
    } catch (error) {
      Logger.error('[Email] Resend request failed:', error instanceof Error ? error.name : 'unknown');
      throw toSafeSendError(error);
    }
    if (result.error) {
      const info = result.error as ResendFailure;
      Logger.error('[Email] Resend rejected send:', info?.name ?? `status-${info?.statusCode ?? 'unknown'}`);
      throw toSafeSendError(result.error);
    }
    Logger.info('[Email] Verification code accepted by provider.');
    return { id: result.data?.id ?? '' };
  },
};
