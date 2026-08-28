// app/api/files/[id]/route.ts

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { deleteFile } from '@/services/file.service';
import { successResponse } from '@/utils/response';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const { id } = await params;
  const result = await deleteFile(id);

  return successResponse(result);
}
