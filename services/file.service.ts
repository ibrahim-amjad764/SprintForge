// services/file.service.ts
import cloudinary from '@/lib/cloudinary';
import File from '@/models/File';

export async function uploadFile(
  file: any,
  user: string
) {
  const uploaded = await cloudinary.uploader.upload(
    file,

    {
      resource_type: 'auto',
    }
  );

  return File.create({
    name: uploaded.original_filename,
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    type: uploaded.resource_type,
    size: uploaded.bytes,
    user,
  });
}

export async function deleteFile(id: string) {
  const file = await File.findById(id);

  if (!file) return null;

  await cloudinary.uploader.destroy(file.publicId);

  return File.findByIdAndDelete(id);
}
