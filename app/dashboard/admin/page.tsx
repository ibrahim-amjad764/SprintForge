// app/dashboard/admin/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSessionToken } from '@/lib/session';
import { checkAdmin } from '@/lib/admin';
import MainLayout from '@/components/layout/MainLayout';
import AdminDashboard from '@/components/admin/AdminDashboard';

/*
    Admin Panel — server-side access gate.

    Defense in depth:
    - middleware.ts already restricts /dashboard/admin via the JWT
      role claim (routing hint only).
    - This page re-verifies the token AND the role against the
      database (checkAdmin) before rendering anything, so a stale
      or forged role claim cannot expose the admin UI.
    - AdminDashboard is a client component that fetches
      /api/admin/users, which independently enforces requireAdmin().
      No admin data is rendered during SSR for unauthorized users.
*/
export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  const session = token ? await validateSessionToken(token) : null;

  if (!session) {
    redirect('/login');
  }

  const isAdmin = await checkAdmin(session.userId);

  if (!isAdmin) {
    redirect('/unauthorized');
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Administration
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Admin Panel
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage users and review platform activity.
          </p>
        </div>
        <AdminDashboard />
      </div>
    </MainLayout>
  );
}
