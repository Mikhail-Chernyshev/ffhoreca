import nodemailer from 'nodemailer';
import { FEEDBACK_TO_EMAIL } from './feedbackMail';

export type ReportReason =
  | 'csam'
  | 'sexual'
  | 'violence'
  | 'illegal'
  | 'spam'
  | 'other';

const REASON_LABELS: Record<ReportReason, string> = {
  csam: 'Материалы с участием несовершеннолетних (CSAM)',
  sexual: 'Откровенный сексуальный контент (18+)',
  violence: 'Насилие или экстремизм',
  illegal: 'Прочий незаконный контент',
  spam: 'Спам или вводящий в заблуждение контент',
  other: 'Другое',
};

export async function sendPlaceReportEmail(opts: {
  placeId: string;
  placeName: string;
  ownerUsername: string;
  mapUrl: string;
  reason: ReportReason;
  message?: string;
  reporterEmail: string;
  reporterName?: string;
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

  const reasonLabel = REASON_LABELS[opts.reason];
  const lines = [
    `Место: «${opts.placeName}» (id: ${opts.placeId})`,
    `Карта: @${opts.ownerUsername}`,
    `Ссылка: ${opts.mapUrl}`,
    `Причина: ${reasonLabel}`,
    opts.userHint ? `Аккаунт жалующегося: ${opts.userHint}` : null,
    `Email жалующегося: ${opts.reporterEmail}`,
    opts.reporterName?.trim() ? `Имя: ${opts.reporterName.trim()}` : null,
    '',
    opts.message?.trim() ? `Комментарий:\n${opts.message.trim()}` : '(без комментария)',
  ].filter((line) => line !== null);

  await transporter.sendMail({
    from: `"Tips from Trips" <${smtpUser}>`,
    to: FEEDBACK_TO_EMAIL,
    replyTo: opts.reporterEmail,
    subject: `[Tips from Trips] Жалоба на место — ${opts.placeName}`,
    text: lines.join('\n'),
  });
}

export function isValidReportReason(value: unknown): value is ReportReason {
  return (
    value === 'csam'
    || value === 'sexual'
    || value === 'violence'
    || value === 'illegal'
    || value === 'spam'
    || value === 'other'
  );
}
