import nodemailer from 'nodemailer';

export const FEEDBACK_TO_EMAIL =
  (process.env.FEEDBACK_TO_EMAIL ?? 'tipsfromtripsapp@gmail.com').trim();

export async function sendFeedbackEmail(opts: {
  fromName?: string;
  fromEmail: string;
  message: string;
  userHint?: string;
}): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);

  if (!host || !smtpUser || !pass) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: smtpUser, pass },
  });

  const displayName = opts.fromName?.trim() || opts.fromEmail;
  const lines = [
    opts.userHint ? `Аккаунт: ${opts.userHint}` : null,
    `Email: ${opts.fromEmail}`,
    opts.fromName?.trim() ? `Имя: ${opts.fromName.trim()}` : null,
    '',
    opts.message.trim(),
  ].filter((line) => line !== null);

  await transporter.sendMail({
    from: `"Tips from Trips" <${smtpUser}>`,
    to: FEEDBACK_TO_EMAIL,
    replyTo: opts.fromEmail,
    subject: `[Tips from Trips] Обратная связь — ${displayName}`,
    text: lines.join('\n'),
  });
}
