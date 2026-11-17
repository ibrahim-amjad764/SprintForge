// services/admin.service.ts
//
// Admin queries and mutations. Every function here assumes the
// caller has already passed requireAdmin() — this layer owns data
// shaping, pagination bounds, and mutation safety guards, never
// authentication.
//
// PRIVACY: user projections explicitly exclude `password` and
// `tokenVersion`. Audit payloads must never contain secrets.
//
// OWNERSHIP: this phase performs no workspace/user deletion, so
// workspaces cannot be orphaned. Role changes never touch
// Workspace.owner.

import mongoose from 'mongoose';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import WorkspaceMember from '@/models/WorkspaceMember';
import Task from '@/models/Task';
import AuditLog from '@/models/AuditLog';
import type { PaginationParams } from '@/lib/pagination';

const USER_ROLES = ['USER', 'ADMIN'] as const;
export type AdminAssignableRole = (typeof USER_ROLES)[number];

// Fields safe to expose to the admin UI — no password, no
// tokenVersion, no other credential material.
const USER_SELECT = '_id name email role avatar createdAt';
const USER_SEARCH_MAX = 100;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function paginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getUsersPaginated({
  q,
  role,
  page,
  limit,
  skip,
}: PaginationParams & { q?: string; role?: string }) {
  const filter: Record<string, unknown> = {};

  if (role && (USER_ROLES as readonly string[]).includes(role)) {
    filter.role = role;
  }

  const search = q?.trim().slice(0, USER_SEARCH_MAX);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { users, pagination: paginationMeta(page, limit, total) };
}

export async function getWorkspacesPaginated({
  q,
  page,
  limit,
  skip,
}: PaginationParams & { q?: string }) {
  const filter: Record<string, unknown> = {};

  const search = q?.trim().slice(0, USER_SEARCH_MAX);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { slug: pattern }];
  }

  const [workspaces, total] = await Promise.all([
    Workspace.find(filter)
      .select('name slug owner maxMembers currentMembers createdAt')
      .populate({ path: 'owner', select: 'name email' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Workspace.countDocuments(filter),
  ]);

  // Member counts for just this page — one aggregation, no N+1.
  const ids = workspaces.map((w) => w._id);
  const counts = await WorkspaceMember.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { workspace: { $in: ids } } },
    { $group: { _id: '$workspace', count: { $sum: 1 } } },
  ]);
  const countByWorkspace = new Map(counts.map((c) => [String(c._id), c.count]));

  const rows = workspaces.map((w) => ({
    _id: w._id,
    name: w.name,
    slug: w.slug,
    owner: w.owner,
    memberCount: countByWorkspace.get(String(w._id)) ?? 0,
    maxMembers: w.maxMembers,
    currentMembers: w.currentMembers,
    createdAt: w.createdAt,
  }));

  return { workspaces: rows, pagination: paginationMeta(page, limit, total) };
}

export async function getAdminStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    adminUsers,
    totalWorkspaces,
    totalMembers,
    totalTasks,
    totalAuditLogs,
    newUsers30d,
    newWorkspaces30d,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'ADMIN' }),
    Workspace.countDocuments(),
    WorkspaceMember.countDocuments(),
    Task.countDocuments(),
    AuditLog.countDocuments(),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Workspace.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
  ]);

  return {
    totalUsers,
    adminUsers,
    totalWorkspaces,
    totalMembers,
    totalTasks,
    totalAuditLogs,
    newUsers30d,
    newWorkspaces30d,
  };
}

export type SetRoleResult =
  | { status: 'ok'; user: Record<string, unknown> }
  | { status: 'not_found' }
  | { status: 'unchanged'; user: Record<string, unknown> }
  | { status: 'invalid_role' }
  | { status: 'self_demotion' }
  | { status: 'last_admin' };

/*
Role mutation with safety guards. The actor is the authenticated
admin's userId (from requireAdmin — never client-supplied).

Guards:
- Role must be USER or ADMIN (schema enum is the backstop).
- An admin cannot demote themselves — prevents accidental
  lockout of the actor's own session.
- The last remaining ADMIN cannot be demoted — prevents
  platform-wide admin lockout.
*/
export async function setUserRole(
  targetUserId: string,
  newRole: string,
  actorId: string
): Promise<SetRoleResult> {
  if (!(USER_ROLES as readonly string[]).includes(newRole)) {
    return { status: 'invalid_role' };
  }

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return { status: 'not_found' };
  }

  const target = await User.findById(targetUserId)
    .select('_id name email role')
    .lean();

  if (!target) {
    return { status: 'not_found' };
  }

  if (target.role === newRole) {
    return { status: 'unchanged', user: target as unknown as Record<string, unknown> };
  }

  // Self-demotion guard.
  if (String(target._id) === actorId && newRole !== 'ADMIN') {
    return { status: 'self_demotion' };
  }

  // Last-admin guard: demoting the final ADMIN would lock every
  // admin out of the platform.
  if (target.role === 'ADMIN' && newRole === 'USER') {
    const adminCount = await User.countDocuments({ role: 'ADMIN' });
    if (adminCount <= 1) {
      return { status: 'last_admin' };
    }
  }

  const updated = await User.findByIdAndUpdate(
    targetUserId,
    { role: newRole },
    { new: true }
  )
    .select(USER_SELECT)
    .lean();

  return { status: 'ok', user: updated as unknown as Record<string, unknown> };
}
