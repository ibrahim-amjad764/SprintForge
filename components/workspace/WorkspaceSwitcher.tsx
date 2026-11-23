"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { apiRequest } from "@/lib/api";
import CreateWorkspaceModal from "./CreateWorkspaceModal";

interface Workspace {
  _id: string;
  name: string;
}

interface WorkspaceSwitcherProps {
  onWorkspaceChange?: (workspaceId: string) => void;
  isModalOpen?: boolean;
}

export default function WorkspaceSwitcher({ onWorkspaceChange, isModalOpen }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);
  const [localModalOpen, setLocalModalOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiRequest("/api/workspace");
        setWorkspaces(response.data || []);
      } catch {
        setError("Could not load workspaces");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function changeWorkspace(id: string) {
    if (!id) return;
    setSwitching(true);
    
    if (onWorkspaceChange) {
      onWorkspaceChange(id);
    }
    
    router.push(`/workspace/${id}`);
  }

  // Get current workspace ID from pathname
  const currentWorkspaceId = pathname?.match(/^\/workspace\/([^/]+)/)?.[1];

  const modalIsOpen = isModalOpen || localModalOpen;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
          Workspace
        </h3>
        <button
          onClick={() => setLocalModalOpen(true)}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
          disabled={modalIsOpen}
          aria-label="Create new workspace"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary"></div>
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : workspaces.length === 0 ? (
        <div className="space-y-2">
          <p className="px-1 text-xs text-muted-foreground">No workspaces yet.</p>
          <button
            onClick={() => setLocalModalOpen(true)}
            className="block w-full rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-glow transition-all hover:brightness-110 disabled:opacity-60"
            disabled={modalIsOpen}
          >
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="relative">
          <select
            className="w-full appearance-none rounded-lg border border-input bg-muted/50 px-3 py-2.5 pr-9 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-50"
            value={currentWorkspaceId || ""}
            onChange={(e) => changeWorkspace(e.target.value)}
            disabled={switching || modalIsOpen}
            aria-label="Switch workspace"
          >
            <option value="" disabled>
              Select workspace
            </option>
            {workspaces.map((workspace) => (
              <option key={workspace._id} value={workspace._id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          {switching && (
            <div className="absolute right-9 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary"></div>
            </div>
          )}
        </div>
      )}

      <CreateWorkspaceModal
        isOpen={localModalOpen}
        onClose={() => setLocalModalOpen(false)}
      />
    </div>
  );
}
