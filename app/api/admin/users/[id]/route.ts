// app/api/admin/users/[id]/route.ts
import { NextRequest } from 'next/server';

import { connectDB } from '@/lib/db';
import { setUserRole } from '@/services/admin.service';
import { createAudit } from '@/services/audit.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAdmin } from '@/lib/admin';
import logger from '@/lib/logger';
import { apiError } from '@/utils/error-handler';

const STATUS_TO_HTTP: Record<string, number> = {
  not_found: 404,
  invalid_role: 400,
  self_demotion: 400,
  last_admin: 409,
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    await connectDB();

    const { id } = await context.params;

    let body: { role?: unknown };
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    // Role is validated again inside setUserRole — never trust input.
    const role = typeof body.role === 'string' ? body.role : '';

    const result = await setUserRole(id, role, auth.user.userId);

    if (result.status !== 'ok' && result.status !== 'unchanged') {
      const status = STATUS_TO_HTTP[result.status] ?? 400;
      const messages: Record<string, string> = {
        not_found: 'User not found',
        invalid_role: 'Role must be USER or ADMIN',
        self_demotion: 'You cannot demote your own admin account',
        last_admin: 'Cannot demote the last remaining administrator',
      };
      return errorResponse(messages[result.status] ?? 'Role update failed', status);
    }

    // Audit the mutation. Audit failure must not fail the change —
    // the role update already committed; log and continue.
    if (result.status === 'ok') {
      try {
        await createAudit({
          user: auth.user.userId,
          action: 'ADMIN_ROLE_CHANGE',
          target: `user:${id}`,
          description: `Administrator changed user role to ${role}`,
        });
      } catch (auditError) {
        logger.error({ err: auditError }, 'Failed to write audit log for role change:');
      }
    }

    return successResponse({ user: result.user });
  } catch (error) {
    return apiError(error, 'Failed to update user role');
  }
}
