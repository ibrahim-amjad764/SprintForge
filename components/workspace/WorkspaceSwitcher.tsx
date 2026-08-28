"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Workspaces</h3>
        <button
          onClick={() => setLocalModalOpen(true)}
          className="text-xs font-medium text-primary hover:underline"
          disabled={modalIsOpen}
        >
          + New
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary"></div>
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : workspaces.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">No workspaces yet.</p>
          <button
            onClick={() => setLocalModalOpen(true)}
            className="block w-full rounded-md bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground hover:opacity-90"
            disabled={modalIsOpen}
          >
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="relative">
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm disabled:opacity-50"
            value={currentWorkspaceId || ""}
            onChange={(e) => changeWorkspace(e.target.value)}
            disabled={switching || modalIsOpen}
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
          {switching && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary"></div>
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
