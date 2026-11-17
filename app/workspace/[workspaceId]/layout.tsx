import MainLayout from '@/components/layout/MainLayout';
import { requireWorkspaceAccess } from '@/lib/page-guards';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  // Server-side membership gate for the whole workspace segment.
  // Individual pages re-verify on each navigation (layouts persist
  // across client-side nav, so page-level checks are the ones that
  // catch mid-session revocations).
  const { workspaceId } = await params;
  await requireWorkspaceAccess(workspaceId);

  return (
    <MainLayout>
      {children}
    </MainLayout>
  );
}
