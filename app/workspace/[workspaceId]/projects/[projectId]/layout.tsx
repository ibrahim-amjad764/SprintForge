import ProjectViewSwitcher from '@/components/project/ProjectViewSwitcher';
import logger from '@/lib/logger';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  logger.info("=== PROJECT LAYOUT INITIALIZED ===");
  
  // Resolve params as a Promise in Next.js 15
  const { workspaceId, projectId } = await params;
  
  logger.info({ values: [{ workspaceId, projectId }] }, "Resolved params in layout:");
  
  return (
    <div className="flex flex-col h-full">
      {/* Project View Switcher Navigation */}
      <div className="bg-card border-b border-border">
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