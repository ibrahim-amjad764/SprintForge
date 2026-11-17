// services/audit.service.ts

import mongoose from 'mongoose';
import AuditLog from '@/models/AuditLog';
import type { PaginationParams } from '@/lib/pagination';

const LOG_SEARCH_MAX = 100;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function createAudit(data: {
  user: mongoose.Types.ObjectId | string;
  action: string;
  target: string;
  description: string;
}) {
  return AuditLog.create(data);
}

export interface AuditLogFilters extends PaginationParams {
  q?: string;
  action?: string;
  user?: string;
}

export async function getLogsPaginated({
  q,
  action,
  user,
  page,
  limit,
  skip,
}: AuditLogFilters) {
  const filter: Record<string, unknown> = {};

  if (action?.trim()) {
    filter.action = action.trim().slice(0, 100);
  }

  if (user && mongoose.Types.ObjectId.isValid(user)) {
    filter.user = new mongoose.Types.ObjectId(user);
  }

  const search = q?.trim().slice(0, LOG_SEARCH_MAX);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { action: pattern },
      { target: pattern },
      { description: pattern },
    ];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate({ path: 'user', select: 'name email' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
