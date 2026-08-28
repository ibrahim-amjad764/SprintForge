// services/email.service.ts

import resend from '@/lib/email';

/*
Central Email Service
Instead of writing email logic
everywhere:
auth
tasks
workspace
all call this service.
*/

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  return resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    html,
  });
}