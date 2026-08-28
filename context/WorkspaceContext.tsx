// context/WorkspaceContext.tsx

// "use client";

// import { createContext, useContext, useState } from "react";
// import { useRouter } from "next/navigation";

// const WorkspaceContext = createContext(null);

// export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
//   return (
//     <WorkspaceContext.Provider value={null}>
//       {children}
//     </WorkspaceContext.Provider>
//   );
// }

// export function useWorkspace() {
//   return useContext(WorkspaceContext);
// }

"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";

interface WorkspaceType {
  _id: string;
  name: string;
}

interface WorkspaceContextType {
  workspace: WorkspaceType | null;

  setWorkspace: (workspace: WorkspaceType) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceType | null>(null);

  return (
    <WorkspaceContext.Provider value={{ workspace, setWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("WorkspaceProvider missing");
  }

  return context;
}
