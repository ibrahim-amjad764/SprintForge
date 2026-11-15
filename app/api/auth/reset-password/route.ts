// app/api/auth/reset-password/route.ts
//
// DISABLED: The password-reset flow was never implemented
// (no token generation, persistence, or expiry existed).
// The endpoint is kept returning a generic error so it cannot
// be used to enumerate registered email addresses.
// A proper reset flow is planned for a future phase.

import { errorResponse } from '@/utils/response';

export async function POST() {
  return errorResponse('Password reset is not available', 501);
}
