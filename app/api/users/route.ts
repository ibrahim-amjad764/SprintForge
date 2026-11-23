// app/api/users/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { getWorkspaceMembership } from '@/lib/authorization';
import { apiError } from '@/utils/error-handler';

/*
    User lookup for invite/member pickers.

    Supported filters:
    - ?email=<email>     -> matching users (minimal fields)
    - ?workspace=<id>    -> users who are members of that workspace
                            (caller must be a member)

    Passwords are always excluded. A bare request returns 400 —
    bulk user listing is not exposed.
*/
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const email = request.nextUrl.searchParams.get('email');
    const workspace = request.nextUrl.searchParams.get('workspace');

    if (email) {
      const users = await User.find({
        email: { $regex: email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      })
        .select('name email avatar role')
        .limit(5)
        .lean();
      return successResponse(users);
    }

    if (workspace) {
      // IDOR: caller must be a member of the workspace
      const membership = await getWorkspaceMembership(workspace, userId);
      if (!membership) {
        return errorResponse('Forbidden', 403);
      }

      const members = await WorkspaceMember.find({ workspace })
        .select('user')
        .lean();
      const memberIds = members.map((m) => m.user);

      const users = await User.find({ _id: { $in: memberIds } })
        .select('name email avatar role')
        .lean();
      return successResponse(users);
    }

    return errorResponse('email or workspace parameter required', 400);
  } catch (error) {
    return apiError(error, 'Failed to fetch users');
  }
}
