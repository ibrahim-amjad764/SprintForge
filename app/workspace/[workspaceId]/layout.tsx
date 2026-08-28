import MainLayout from '@/components/layout/MainLayout';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log("=== WORKSPACE LAYOUT INITIALIZED ===");
  
  return (
    <MainLayout>
      {children}
    </MainLayout>
  );
}