'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, ListTodo, CalendarDays } from 'lucide-react';

interface ProjectViewSwitcherProps {
  workspaceId: string;
  projectId: string;
}

export default function ProjectViewSwitcher({ workspaceId, projectId }: ProjectViewSwitcherProps) {
  console.log("=== PROJECT VIEW SWITCHER INITIALIZED ===");
  console.log("Props received:", { workspaceId, projectId });
  
  const pathname = usePathname();
  const router = useRouter();

  console.log("Current pathname:", pathname);
  console.log("useRouter instance:", router);

  // Dynamic route base helper
  const basePath = `/workspace/${workspaceId}/projects/${projectId}`;
  console.log("Constructed basePath:", basePath);

  const tabs = [
    { id: 'board', name: 'Board View', icon: LayoutGrid, path: `${basePath}/board` },
    { id: 'list', name: 'Task List', icon: ListTodo, path: `${basePath}/list` },
    { id: 'calendar', name: 'Calendar', icon: CalendarDays, path: `${basePath}/calendar` },
  ];

  console.log("Available tabs configuration:", tabs);

  return (
    <div className="flex border-b border-border bg-card px-6 py-2 gap-4">
      {tabs.map((tab) => {
        // Check active route state layout safely
        const isActive = pathname.endsWith(tab.path) || pathname.includes(tab.id);
        const Icon = tab.icon;

        console.log(`=== TAB RENDERING: ${tab.id} ===`);
        console.log("Tab path:", tab.path);
        console.log("Is active:", isActive);
        console.log("Pathname check - endsWith:", pathname.endsWith(tab.path));
        console.log("Pathname check - includes:", pathname.includes(tab.id));

        return (
          <button
            key={tab.id}
            onClick={() => {
              console.log(`=== TAB CLICKED: ${tab.id} ===`);
              console.log("Navigating to:", tab.path);
              console.log("Current pathname before navigation:", pathname);
              router.push(tab.path);
              console.log("Navigation command executed");
            }}
            className={`flex items-center gap-2 pb-3 pt-2 text-sm font-medium border-b-2 transition-all px-1
              ${isActive 
                ? 'border-blue-600 text-blue-600 dark:text-blue-300 font-semibold' 
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
          >
            <Icon className="w-4 h-4" />
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}