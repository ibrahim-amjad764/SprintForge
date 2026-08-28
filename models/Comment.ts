// models/Comment.ts
import { schema } from '@hookform/resolvers/ajv/src/__tests__/__fixtures__/data.js';
import mongoose, { Schema, Model } from 'mongoose';

/*
 Comment Model
 A comment belongs to:
 Task
 User
*/

export interface IComment {
  task: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Comment: Model<IComment> =
  mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);

export default Comment;
