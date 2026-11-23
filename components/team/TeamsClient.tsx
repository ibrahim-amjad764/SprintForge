'use client';

import { useState, useEffect } from 'react';
import TeamManagement from './TeamManagement';
import GlobalFilter, { FilterState } from '../filters/GlobalFilter';
import Pagination from '../shared/Pagination';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'developer' | 'designer' | 'project_manager' | 'viewer';
  avatar?: string;
}

interface Team {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  members: TeamMember[];
  activeTasks: number;
  completedTasks: number;
  status: 'active' | 'archived';
  createdAt: string;
  skills?: string[];
}

interface DbTeam {
  _id: string;
  name: string;
  workspace: string;
  members?: Array<{
    _id: string;
    name: string;
    email: string;
    role: TeamMember['role'];
    avatar?: string;
  }>;
  createdAt: string;
}

interface TeamsClientProps {
  projectId: string;
  projectName: string;
  workspaceId: string;
}

const PAGE_SIZE = 20;

export default function TeamsClient({
  projectId,
  projectName,
  workspaceId,
}: TeamsClientProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    priority: [],
    status: [],
    assigneeId: [],
  });

  const search = filters.search?.trim() ?? '';

  // Paginated fetch — search is applied server-side so results stay
  // correct across pages. `loading` is set by the triggering event
  // handlers (filter/page change); state updates happen in async
  // callbacks below.
  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({
      workspace: workspaceId,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (search) params.set('search', search);

    fetch(`/api/teams?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (cancelled || !data.success || !data.data) return;

        const payload = data.data;
        const dbTeams: DbTeam[] = Array.isArray(payload)
          ? payload
          : payload.items ?? [];
        const transformedTeams: Team[] = dbTeams.map((dbTeam) => ({
          id: dbTeam._id,
          name: dbTeam.name,
          projectId: dbTeam.workspace,
          projectName: projectName,
          members: (dbTeam.members || []).map((member) => ({
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
        if (!Array.isArray(payload)) {
          setTotal(payload.total ?? 0);
          setHasMore(!!payload.hasMore);
        } else {
          setTotal(dbTeams.length);
          setHasMore(false);
        }
      })
      .catch((error) => {
        console.error('Error loading teams from API:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectName, page, search]);

  const handleTeamsChange = (updatedTeams: Team[]) => {
    setTeams(updatedTeams);
    // No LocalStorage - data is managed by TeamManagement component via API
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
    setLoading(true);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    setLoading(true);
  };

  // Extract available assignees from teams
  const availableAssignees = teams.flatMap((team) =>
    team.members.map((member) => ({ id: member.id, name: member.name }))
  );

  return (
    <div className="space-y-6">
      <GlobalFilter
        onFilterChange={handleFilterChange}
        availableAssignees={availableAssignees}
        showStatusFilter={false}
        showPriorityFilter={false}
        showAssigneeFilter={false}
      />
      {loading && teams.length === 0 ? (
        <div className="p-6">Loading teams...</div>
      ) : (
        <>
          <TeamManagement
            workspaceId={workspaceId}
            projectId={workspaceId}
            projectName="Workspace"
            initialTeams={teams}
            onTeamsChange={handleTeamsChange}
            filters={filters}
          />
          <Pagination
            page={page}
            limit={PAGE_SIZE}
            total={total}
            hasMore={hasMore}
            loading={loading}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
