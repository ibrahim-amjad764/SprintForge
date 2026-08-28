// app/api/auth/reset-password/route.ts

import { sendEmail } from '@/services/email.service';
import { resetPasswordEmail } from '@/components/templates/emails/reset-password';
import User from '@/models/User';

export async function POST(req: Request) {
  const { email } = await req.json();

  // Find the user in database
  const user = await User.findOne({ email });

  if (!user) {
    return Response.json(
      { message: 'User not found' },
      { status: 404 }
    );
  }

  // Generate reset URL
  const resetUrl = `http://localhost:3000/reset-password?token=YOUR_TOKEN`;

  await sendEmail({
    to: user.email,
    subject: 'Reset Password',
    html: resetPasswordEmail(
      user.name,
      resetUrl
    ),
  });

  return Response.json({ success: true });
}