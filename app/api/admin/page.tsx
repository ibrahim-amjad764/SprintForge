// app/admin/page.tsx
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function AdminPage() {
  return (
    <div className="p-10">
      <h1 className="mb-8 text-3xl font-bold">Admin Panel</h1>

      <AdminDashboard />
    </div>
  );
}
