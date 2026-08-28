import ProjectViewSwitcher from '@/components/project/ProjectViewSwitcher';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  console.log("=== PROJECT LAYOUT INITIALIZED ===");
  
  // Resolve params as a Promise in Next.js 15
  const { workspaceId, projectId } = await params;
  
  console.log("Resolved params in layout:", { workspaceId, projectId });
  
  return (
    <div className="flex flex-col h-full">
      {/* Project View Switcher Navigation */}
      <div className="bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex-1">
            <ProjectViewSwitcher workspaceId={workspaceId} projectId={projectId} />
          </div>
        </div>
      </div>
      
      {/* Page Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}