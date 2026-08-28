// services/audit.service.ts

import AuditLog from '@/models/AuditLog';

export async function createAudit(data: any) {
  return AuditLog.create(data);
}

export async function getLogs() {
  return AuditLog.find()
    .populate('user')
    .sort({
      createdAt: -1,
    });
}
