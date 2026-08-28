// services/admin.service.ts
import User from '@/models/User';

export async function getAllUsers() {
  return User.find().select('-password');
}

export async function updateUserRole(id: string, role: string) {
  return User.findByIdAndUpdate(id, { role }, { new: true });
}
