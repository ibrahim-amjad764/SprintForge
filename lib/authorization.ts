// lib/authorization.ts
//
// Resource-level authorization helpers.
//
// Every protected resource ultimately belongs to a Workspace:
//   Task → Project → Workspace
//   Comment / Attachment / TimeEntry / File → Task → Project → Workspace
//   Team / Project → Workspace
//
// Membership is determined by WorkspaceMember documents, with the
// Workspace.owner treated as OWNER even if no member row exists.
// Client-supplied user/workspace IDs are never trusted — callers
// must pass the authenticated userId from requireAuth().

import { connectDB } from "@/lib/db";
import Workspace from "@/models/Workspace";
import WorkspaceMember from "@/models/WorkspaceMember";
import Project from "@/models/Project";
import Task from "@/models/Task";
import Team from "@/models/Team";
import type { WorkspaceRole } from "@/models/WorkspaceMember";

export interface Membership {
  workspaceId: string;
  role: WorkspaceRole;
}

/*
    Role capability matrix (Batch 4):

    READ     — every workspace member (GET endpoints)
    COMMENT  — OWNER, ADMIN, EDITOR, COMMENTER
    WRITE    — OWNER, ADMIN, EDITOR (create/update/delete work items)
    ADMIN    — OWNER, ADMIN (settings, members, workspace lifecycle)
              enforced separately via ADMIN_ROLES in routes
*/
const WRITE_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "EDITOR"];
const COMMENT_ROLES: WorkspaceRole[] = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "COMMENTER",
];

/** OWNER/ADMIN/EDITOR roles may mutate workspace content. */
export function canWriteWorkspace(role: WorkspaceRole): boolean {
  return WRITE_ROLES.includes(role);
}

/** COMMENTER and above may comment; VIEWER is read-only. */
export function canCommentWorkspace(role: WorkspaceRole): boolean {
  return COMMENT_ROLES.includes(role);
}

function toId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

/*
    Resolve a user's membership in a workspace.
    Returns null when the user is not a member and is not the owner.
*/
/** Resolves the user's WorkspaceMember role; falls back to OWNER when they own the workspace. */
export async function getWorkspaceMembership(
  workspaceId: string,
  userId: string,
): Promise<Membership | null> {
  await connectDB();

  const member = await WorkspaceMember.findOne({
    workspace: workspaceId,
    user: userId,
  })
    .select("role")
    .lean();

  if (member) {
    return { workspaceId, role: member.role };
  }

  const workspace = await Workspace.findById(workspaceId)
    .select("owner")
    .lean();

  if (workspace && toId(workspace.owner) === userId) {
    return { workspaceId, role: "OWNER" };
  }

  return null;
}

/** True when the user has any membership (or ownership) in the workspace. */
export async function isWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  return (await getWorkspaceMembership(workspaceId, userId)) !== null;
}

/*
    All workspace IDs a user can access:
    WorkspaceMember rows + workspaces they own.
*/
/** All workspace ids the user can access (memberships + owned). */
export async function getUserWorkspaceIds(userId: string): Promise<string[]> {
  await connectDB();

  const [memberRows, owned] = await Promise.all([
    WorkspaceMember.find({ user: userId }).select("workspace").lean(),
    Workspace.find({ owner: userId }).select("_id").lean(),
  ]);

  return [
    ...memberRows.map((m) => String(m.workspace)),
    ...owned.map((w) => String(w._id)),
  ];
}

/*
    All project IDs inside the user's accessible workspaces.
*/
/** All project ids inside the user's accessible workspaces — the standard data-scope filter. */
export async function getUserProjectIds(userId: string): Promise<string[]> {
  const workspaceIds = await getUserWorkspaceIds(userId);
  if (workspaceIds.length === 0) return [];

  const projects = await Project.find({ workspace: { $in: workspaceIds } })
    .select("_id")
    .lean();

  return projects.map((p) => String(p._id));
}

/*
    Membership for the workspace that owns a project.
    Returns null when the project does not exist or the user
    is not a member of its workspace.
*/
/** Membership for the workspace owning a project; null when inaccessible. */
export async function getMembershipForProject(
  projectId: string,
  userId: string,
): Promise<Membership | null> {
  await connectDB();

  const project = await Project.findById(projectId).select("workspace").lean();
  const workspaceId = toId(project?.workspace);
  if (!workspaceId) return null;

  return getWorkspaceMembership(workspaceId, userId);
}

/*
    Membership for the workspace that owns a task
    (task → project → workspace).
*/
/** Membership for the workspace owning a task; null when inaccessible. */
export async function getMembershipForTask(
  taskId: string,
  userId: string,
): Promise<Membership | null> {
  await connectDB();

  const task = await Task.findById(taskId)
    .select("project")
    .populate({ path: "project", select: "workspace" })
    .lean();

  const project = task?.project as { workspace?: unknown } | null;
  const workspaceId = toId(project?.workspace);
  if (!workspaceId) return null;

  return getWorkspaceMembership(workspaceId, userId);
}

/*
    Membership for the workspace that owns a team.
*/
/** Membership for the workspace owning a team; null when inaccessible. */
export async function getMembershipForTeam(
  teamId: string,
  userId: string,
): Promise<Membership | null> {
  await connectDB();

  const team = await Team.findById(teamId).select("workspace").lean();
  const workspaceId = toId(team?.workspace);
  if (!workspaceId) return null;

  return getWorkspaceMembership(workspaceId, userId);
}
