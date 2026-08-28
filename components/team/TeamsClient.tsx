'use client';

import { useState, useEffect } from 'react';
import TeamManagement from './TeamManagement';
import GlobalFilter, { FilterState } from '../filters/GlobalFilter';

interface Team {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  members: any[];
  activeTasks: number;
  completedTasks: number;
  status: 'active' | 'archived';
  createdAt: string;
  skills?: string[];
}

interface TeamsClientProps {
  projectId: string;
  projectName: string;
  workspaceId: string;
}

export default function TeamsClient({
  projectId,
  projectName,
  workspaceId,
}: TeamsClientProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    priority: [],
    status: [],
    assigneeId: [],
  });

  // Load teams from API on mount
  useEffect(() => {
    async function loadTeams() {
      try {
        setLoading(true);
        const response = await fetch(`/api/teams?workspace=${workspaceId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Transform DB teams to match Team interface
            const transformedTeams = data.data.map((dbTeam: any) => ({
              id: dbTeam._id,
              name: dbTeam.name,
              projectId: dbTeam.workspace,
              projectName: projectName,
              members: (dbTeam.members || []).map((member: any) => ({
                id: member._id,
                name: member.name,
                email: member.email,
                role: member.role,
                avatar: member.avatar,
              })),
              activeTasks: 0, // Will be calculated from tasks
              completedTasks: 0, // Will be calculated from tasks
              status: 'active',
              createdAt: dbTeam.createdAt,
              skills: [],
            }));
            setTeams(transformedTeams);
          }
        }
      } catch (error) {
        console.error('Error loading teams from API:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTeams();
  }, [workspaceId, projectName]);

  const handleTeamsChange = async (updatedTeams: any[]) => {
    setTeams(updatedTeams);
    // No LocalStorage - data is managed by TeamManagement component via API
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // Extract available assignees from teams
  const availableAssignees = teams.flatMap((team) =>
    team.members.map((member: any) => ({ id: member.id, name: member.name }))
  );

  if (loading) {
    return <div className="p-6">Loading teams...</div>;
  }

  return (
    <div className="space-y-6">
      <GlobalFilter
        onFilterChange={handleFilterChange}
        availableAssignees={availableAssignees}
        showStatusFilter={false}
        showPriorityFilter={false}
        showAssigneeFilter={false}
      />
      <TeamManagement
        workspaceId={workspaceId}
        projectId={workspaceId}
        projectName="Workspace"
        initialTeams={teams}
        onTeamsChange={handleTeamsChange}
        filters={filters}
      />
    </div>
  );
}
