// models/Permission.ts
import mongoose, { Schema, Model } from 'mongoose';

/*
Permission Storage

Example:
USER
can:
create_task

ADMIN
can:
delete_user
*/

const PermissionSchema = new Schema({
  role: String,
  permissions: [String],
});

const Permission: Model<any> =
  mongoose.models.Permission || mongoose.model('Permission', PermissionSchema);

export default Permission;
