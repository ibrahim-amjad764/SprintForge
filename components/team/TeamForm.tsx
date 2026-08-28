// components/team/TeamForm.tsx
"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

interface Props {
  workspaceId: string;
}

export default function TeamForm({ workspaceId }: Props) {
  const [name, setName] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    await apiRequest(
      "/api/teams",

      {
        method: "POST",

        body: JSON.stringify({
          name,
          workspace: workspaceId,
        }),
      },
    );

    setName("");

    alert("Team created");
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3"
    >
      <input
        className="border p-3 rounded"
        placeholder="Team name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <button className="bg-black text-white px-4 py-2 rounded">
        Create Team
      </button>
    </form>
  );
}
