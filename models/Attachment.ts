// models/Attachment.ts
import mongoose, { Schema, Model } from 'mongoose';

/*
Attachment Model

Task
 |
Files
*/

export interface IAttachment {
  task: mongoose.Types.ObjectId;
  name: string;
  url: string;
  publicId: string;
  type: string;
  size: number;
  createdAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    name: String,
    url: String,
    publicId: String,
    type: String,
    size: Number,
  },
  { timestamps: true }
);

const Attachment: Model<IAttachment> =
  mongoose.models.Attachment ||
  mongoose.model<IAttachment>('Attachment', AttachmentSchema);

export default Attachment;
