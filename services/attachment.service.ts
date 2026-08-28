// services/attachment.service.ts

import Attachment from '@/models/Attachment';

export async function createAttachment(data: any) {
  return Attachment.create(data);
}

export async function getAttachments(task: string) {
  return Attachment.find({
    task,
  });
}

export async function deleteAttachment(id: string) {
  return Attachment.findByIdAndDelete(id);
}
