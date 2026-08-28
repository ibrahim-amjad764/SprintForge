// models/File.ts
import mongoose, { Schema, Model } from 'mongoose';

/*
File Metadata
Actual file:
Cloudinary

Database stores:
- URL
- Type
- Owner
- Relation
*/

export interface IFile {
  name: string;
  url: string;
  publicId: string;
  type: string;
  size: number;
  user: mongoose.Types.ObjectId;
  task?: mongoose.Types.ObjectId;
}

const FileSchema = new Schema<IFile>(
  {
    name: String,
    url: String,
    publicId: String,
    type: String,
    size: Number,

    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
    },
  },

  { timestamps: true }
);

const File: Model<IFile> =
  mongoose.models.File || mongoose.model<IFile>('File', FileSchema);

export default File;
