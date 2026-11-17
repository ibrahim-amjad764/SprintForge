// lib/page-guards.ts
//
// Server-component authorization guards for page routes.
//
// Middleware only verifies that *a* JWT exists — it cannot check
// resource membership (edge runtime, no DB). These helpers run in
// Node server components, validate the session against the database
// (tokenVersion revocation-aware), and verify workspace/task
// membership before any workspace-scoped data is fetched or rendered.
//
// Owner access is preserved: getWorkspaceMembership treats
// Workspace.owner as OWNER even without a member row.
//
// Usage in a page/layout:
//   const { workspaceId } = await params;
//   await requireWorkspaceAccess(workspaceId);
// Unauthenticated → /login; authenticated non-member → /unauthorized.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import mongoose from 'mongoose';
import { validateSessionToken } from '@/lib/session';
import { connectDB } from '@/lib/db';
import Project from '@/models/Project';
import {
  getWorkspaceMembership,
  getMembershipForTask,
  type Membership,
} from '@/lib/authorization';

async function requirePageSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  const session = token ? await validateSessionToken(token) : null;
  if (!session) {
    redirect('/login');
  }
  return session;
}

export async function requireWorkspaceAccess(
  workspaceId: string
): Promise<Membership> {
  const session = await requirePageSession();
  // Malformed IDs can't match a member row — reject before Mongoose
  // throws a CastError (which would surface as a 500, not a redirect).
  if (!mongoose.isValidObjectId(workspaceId)) {
    redirect('/unauthorized');
  }
  const membership = await getWorkspaceMembership(workspaceId, session.userId);
  if (!membership) {
    redirect('/unauthorized');
  }
  return membership;
}

export async function requireTaskAccess(taskId: string): Promise<Membership> {
  const session = await requirePageSession();
  if (!mongoose.isValidObjectId(taskId)) {
    redirect('/unauthorized');
  }
  const membership = await getMembershipForTask(taskId, session.userId);
  if (!membership) {
    redirect('/unauthorized');
  }
  return membership;
}

/*
Project-scoped pages must also prove the project actually belongs
to the workspace in the URL — otherwise a member of workspace A
could view workspace B's project by crafting
/workspace/A/projects/<B-project-id>. Membership in the URL
workspace alone is not sufficient.
*/
export async function requireProjectInWorkspace(
  projectId: string,
  workspaceId: string
): Promise<void> {
  await connectDB();
  if (!mongoose.isValidObjectId(projectId) || !mongoose.isValidObjectId(workspaceId)) {
    redirect('/unauthorized');
  }
  const project = await Project.findById(projectId).select('workspace').lean();
  const projectWorkspace = project?.workspace ? String(project.workspace) : null;
  if (!project || projectWorkspace !== String(workspaceId)) {
    redirect('/unauthorized');
  }
}

// For pages that need the userId but no resource membership check
// (e.g. scoping a global list to the user's own workspaces).
export async function requirePageUserId(): Promise<string> {
  const session = await requirePageSession();
  return session.userId;
}
