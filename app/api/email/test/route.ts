// app/api/email/test/route.ts
import { NextRequest } from 'next/server';
import { sendEmail } from '@/services/email.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAdmin } from '@/lib/admin';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    const body = await request.json();

    await sendEmail({
      to: body.email,
      subject: 'SprintForge Test Email',
      html: `

<h1>
Welcome to SprintForge
</h1>

<p>
Email system working.
</p>

`,
    });
    return successResponse(null, 'Email sent');
  } catch (error) {
    return errorResponse('Email failed', 500);
  }
}
