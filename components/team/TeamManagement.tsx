'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Users,
  MoreVertical,
  Trash2,
  Archive,
  Search,
  Zap,
  TrendingUp,
  CalendarDays,
  MessageSquare,
  Video,
  X,
  Edit2,
  FileText,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { FilterState } from '../filters/GlobalFilter';
import MembersRosterModal from '../modals/MembersRosterModal';
import ActiveTasksModal from '../modals/ActiveTasksModal';
import TeamLeaderboardModal from '../modals/TeamLeaderboardModal';

interface Member {
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
  members: Member[];
  activeTasks: number;
  completedTasks: number;
  status: 'active' | 'archived';
  createdAt: string;
  skills?: string[];
}

interface TeamManagementProps {
  projectId: string;
  projectName: string;
  workspaceId: string;
  initialTeams?: Team[];
  onTeamsChange?: (teams: Team[]) => void;
  tasks?: any[]; // Calendar tasks for metric sync
  filters?: FilterState;
}

export default function TeamManagement({
  projectId,
  projectName,
  workspaceId,
  initialTeams = [],
  onTeamsChange,
  tasks = [],
  filters,
}: TeamManagementProps) {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [calendarTasks, setCalendarTasks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [skillsInput, setSkillsInput] = useState('');

  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'archived'>(
    'all'
  );
  const [newTeamName, setNewTeamName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<
    'admin' | 'developer' | 'designer' | 'project_manager' | 'viewer'
  >('developer');
  const [newTeamSkills, setNewTeamSkills] = useState<string[]>([]);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskAssigneeId, setQuickTaskAssigneeId] = useState<
    string | undefined
  >(undefined);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [isMostActiveModalOpen, setIsMostActiveModalOpen] = useState(false);

  // Sync with parent when initialTeams changes
  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  // Load calendar tasks from API
  useEffect(() => {
    async function loadTasks() {
      try {
        if (projectId) {
          const response = await fetch(`/api/tasks?project=${projectId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setCalendarTasks(data.data);
            }
          }
        }
      } catch (error) {
        console.error('Error loading tasks from API:', error);
        setCalendarTasks([]);
      }
    }

    loadTasks();
  }, [projectId]);

  // Calculate team-specific task counts
  const getTeamTaskCounts = (teamName: string) => {
    const teamTasks = calendarTasks.filter(
      (task) =>
        task.category?.toLowerCase() === teamName.toLowerCase() ||
        task.title?.toLowerCase().includes(teamName.toLowerCase())
    );
    const total = teamTasks.length;
    const completed = teamTasks.filter(
      (task) => task.status === 'COMPLETED' || task.status === 'DONE'
    ).length;
    return { total, completed };
  };

  // Calculate individual member task counts (team-scoped with member ID)
  const getMemberTaskCounts = (memberId: string, teamId: string) => {
    const memberTasks = calendarTasks.filter(
      (task) => task.assignedToId === memberId && task.teamId === teamId
    );
    const total = memberTasks.length;
    const completed = memberTasks.filter(
      (task) => task.status === 'COMPLETED' || task.status === 'DONE'
    ).length;
    const inProgress = total - completed;
    return { total, completed, inProgress };
  };

  // Get team-specific tasks for detail panel
  const getTeamTasks = (teamId: string) => {
    return calendarTasks.filter((task) => task.teamId === teamId);
  };

  // Handle task status toggle
  const handleTaskStatusToggle = async (taskId: string) => {
    const task = calendarTasks.find((t) => t._id === taskId);
    if (!task) return;

    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const updatedTasks = calendarTasks.map((t) =>
            t._id === taskId
              ? {
                  ...t,
                  status: newStatus,
                  completedAt:
                    newStatus === 'DONE' ? new Date().toISOString() : undefined,
                }
              : t
          );
          setCalendarTasks(updatedTasks);
          toast.success('Task status updated');
        }
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
    }
  };

  // Handle quick task creation in side panel
  const handleQuickTaskCreate = async (taskTitle: string) => {
    console.log('=== TASK CREATION STARTED ===');
    console.log('Input taskTitle:', taskTitle);
    console.log('selectedTeam:', selectedTeam);
    console.log('quickTaskAssigneeId:', quickTaskAssigneeId);
    console.log('taskDueDate:', taskDueDate);
    console.log('taskPriority:', taskPriority);

    if (!taskTitle.trim() || !selectedTeam) {
      console.error('VALIDATION ERROR - Missing required fields');
      toast.error('Please enter a task title and select a team.');
      return;
    }

    // Auto-extract projectId from URL
    const pathParts = window.location.pathname.split('/');
    const currentProjectId = pathParts[4] || undefined; // /workspace/[workspaceId]/projects/[projectId]/...
    console.log('URL pathParts:', pathParts);
    console.log('Extracted currentProjectId from URL:', currentProjectId);

    // FORCE DYNAMIC PROJECT FALLBACK IDENTIFICATION
    const targetProjectId = currentProjectId || selectedTeam.projectId;
    console.log('Final targetProjectId after fallback logic:', targetProjectId);

    if (!targetProjectId) {
      console.error('CLIENT ERROR - No project context found for this team');
      console.error('Team data:', selectedTeam);
      toast.error('Please link a default project to this team first.');
      return;
    }

    const selectedMember = selectedTeam.members.find(
      (m) => m.id === quickTaskAssigneeId
    );
    console.log('Selected member:', selectedMember);

    // FIX ENTIRE PAYLOAD STRUCTURAL PROPERTIES
    const payload = {
      title: taskTitle.trim(),
      project: targetProjectId, // Maps to Mongoose validation schema requirement
      projectId: targetProjectId, // Keeps frontend interfaces consistent
      teamId: selectedTeam.id, // Binds task directly to this parent team document
      dueDate: taskDueDate ? taskDueDate : null, // Send as YYYY-MM-DD string to prevent timezone bugs
      status: 'TODO',
      priority: taskPriority || 'MEDIUM',
      assignee: quickTaskAssigneeId || null, // Must be the 24-character hexadecimal ObjectId string, NOT the plain text name!
    };

    console.log('=== SENDING PAYLOAD TO SERVER ===');
    console.log('Request URL:', '/api/tasks');
    console.log('Request Method:', 'POST');
    console.log('Request Headers:', { 'Content-Type': 'application/json' });
    console.log('Request Body (payload):', payload);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('=== SERVER RESPONSE RECEIVED ===');
      console.log('Response Status:', res.status);
      console.log('Response OK:', res.ok);

      const data = await res.json();
      console.log('Response Data:', data);

      if (!res.ok) {
        console.error('=== SERVER REJECTION LOG ===');
        console.error('Status Code:', res.status);
        console.error('Status Text:', res.statusText);
        console.error('Error Response:', data);
        console.error('Full Error Details:', JSON.stringify(data, null, 2));
        toast.error(
          `Database Error: ${data.error || data.message || 'Failed to save task'}`
        );
        return;
      }

      console.log('=== SUCCESS LOG - Task permanently written to MongoDB ===');
      console.log('Created Task Data:', data);
      console.log('Task ID:', data.data?._id);
      console.log('Task Title:', data.data?.title);
      console.log('Full Response:', JSON.stringify(data, null, 2));
      toast.success('Task created and saved permanently to DB!');

      // Update local state with the new task
      if (data.success && data.data) {
        const newTask = {
          _id: data.data._id,
          title: data.data.title,
          status: data.data.status,
          priority: data.data.priority,
          category: 'task' as const,
          dueDate: data.data.dueDate,
          assignedTo: selectedMember?.name || undefined,
          assignedToId: data.data.assignee?._id || data.data.assignee,
          teamId: selectedTeam.id,
          projectId: targetProjectId,
        };

        const updatedTasks = [...calendarTasks, newTask];
        setCalendarTasks(updatedTasks);
        console.log('Local state updated with new task:', newTask);
      }

      // Reset local input states fields smoothly
      setQuickTaskTitle('');
      setTaskDueDate('');
      setTaskPriority('MEDIUM');
      console.log('=== FORM FIELDS RESET ===');
    } catch (error) {
      console.error('=== NETWORK ERROR LOG ===');
      console.error(
        'Error Type:',
        error instanceof Error ? error.constructor.name : typeof error
      );
      console.error(
        'Error Message:',
        error instanceof Error ? error.message : String(error)
      );
      console.error('Full Error Object:', error);
      console.error(
        'Stack Trace:',
        error instanceof Error ? error.stack : 'No stack trace available'
      );
      toast.error('Network issue. Synchronization failed.');
    }

    console.log('=== TASK CREATION PROCESS COMPLETED ===');
  };

  // 30-day expiry filter for completed tasks
  const filterRecentCompletedTasks = (tasks: any[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return tasks.filter((task) => {
      if (task.completedAt) {
        const completedDate = new Date(task.completedAt);
        return completedDate >= thirtyDaysAgo;
      }
      return true; // Keep tasks without completedAt
    });
  };

  // Calculate metrics with calendar task sync
  const totalMembers = teams.reduce(
    (acc, team) => acc + team.members.length,
    0
  );

  // Calculate global active tasks by summing member in-progress tasks across all teams
  const totalActiveTasks = teams.reduce((total, team) => {
    const memberActiveTasks = team.members.reduce((memberTotal, member) => {
      const memberCounts = getMemberTaskCounts(member.id, team.id);
      return memberTotal + memberCounts.inProgress;
    }, 0);
    return total + memberActiveTasks;
  }, 0);

  const mostActiveTeam =
    teams.length > 0
      ? teams.reduce((max, team) => {
          const teamActiveTasks = team.members.reduce((memberTotal, member) => {
            const memberCounts = getMemberTaskCounts(member.id, team.id);
            return memberTotal + memberCounts.inProgress;
          }, 0);
          const maxActiveTasks = max.members.reduce((memberTotal, member) => {
            const memberCounts = getMemberTaskCounts(member.id, max.id);
            return memberTotal + memberCounts.inProgress;
          }, 0);
          return teamActiveTasks > maxActiveTasks ? team : max;
        })
      : null;

  // Filter teams
  const filteredTeams = teams.filter((team) => {
    const searchQuery = filters?.search || '';
    const matchesSearch =
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.members.some((member) =>
        member.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      (team.skills &&
        team.skills.some((skill) =>
          skill.toLowerCase().includes(searchQuery.toLowerCase())
        ));
    const matchesFilter =
      filterTab === 'all' ||
      (filterTab === 'active' && team.status === 'active') ||
      (filterTab === 'archived' && team.status === 'archived');
    return matchesSearch && matchesFilter;
  });

  // Create or update team
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error('Team name is required');
      return;
    }

    try {
      const isEditing =
        selectedTeam && selectedTeam.id.startsWith('team-') === false;
      const url = isEditing ? `/api/teams/${selectedTeam.id}` : '/api/teams';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName,
          description: newTeamSkills.join(', '),
          workspace: workspaceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const teamData: Team = {
            id: data.data._id,
            name: data.data.name,
            projectId: workspaceId,
            projectName,
            members: selectedTeam?.members || [],
            activeTasks: selectedTeam?.activeTasks || 0,
            completedTasks: selectedTeam?.completedTasks || 0,
            status: selectedTeam?.status || 'active',
            createdAt: data.data.createdAt,
            skills: newTeamSkills,
          };

          let updatedTeams;
          if (isEditing) {
            updatedTeams = teams.map((t) =>
              t.id === selectedTeam.id ? teamData : t
            );
          } else {
            updatedTeams = [...teams, teamData];
          }

          setTeams(updatedTeams);
          if (onTeamsChange) {
            onTeamsChange(updatedTeams);
          }
          setShowCreateForm(false);
          setSelectedTeam(null);
          setNewTeamName('');
          setSkillsInput('');
          setNewTeamSkills([]);
          setNewTeamSkills([]);
          setSkillsInput('');
          setShowCreateForm(false);
          setSelectedTeam(null);
          toast.success(
            isEditing
              ? 'Team updated successfully'
              : 'Team created successfully'
          );
        }
      }
    } catch (error) {
      console.error('Error saving team:', error);
      toast.error('Failed to save team');
    }
  };

  const mapDbMemberToMember = (member: any) => ({
    id: member._id?.toString() || member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    avatar: member.avatar,
  });

  // Add member
  const handleAddMember = async () => {
    if (!newMemberName.trim() || !newMemberEmail.trim() || !selectedTeam)
      return;

    // Prepare member data for backend (without id field - let MongoDB generate _id)
    const newMemberForDB = {
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
      role: newMemberRole,
    };

    // Transform existing members to DB format (id -> _id)
    const existingMembersForDB = selectedTeam.members.map((member) => ({
      _id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      avatar: member.avatar,
    }));

    const updatedMembersForDB = [...existingMembersForDB, newMemberForDB];

    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: updatedMembersForDB }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const updatedMembers = (data.data.members || updatedMembersForDB).map(
            mapDbMemberToMember
          );

          const updatedTeams = teams.map((team) =>
            team.id === selectedTeam.id
              ? {
                  ...team,
                  members: updatedMembers,
                }
              : team
          );

          const updatedTeam = updatedTeams.find(
            (team) => team.id === selectedTeam.id
          );

          setTeams(updatedTeams);
          setSelectedTeam(updatedTeam || selectedTeam);
          if (onTeamsChange) {
            onTeamsChange(updatedTeams);
          }

          setNewMemberName('');
          setNewMemberEmail('');
          setShowMemberModal(false);
          toast.success('Member added successfully');
        }
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member');
    }
  };

  // Delete team
  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;

    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const updatedTeams = teams.filter((team) => team.id !== teamId);
        setTeams(updatedTeams);
        if (onTeamsChange) {
          onTeamsChange(updatedTeams);
        }
        toast.success('Team deleted');
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error('Failed to delete team');
    }
  };

  // Archive team
  const handleArchiveTeam = async (teamId: string) => {
    try {
      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      const newStatus = team.status === 'active' ? 'archived' : 'active';

      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updatedTeams: Team[] = teams.map((t) =>
          t.id === teamId ? { ...t, status: newStatus as Team['status'] } : t
        );
        setTeams(updatedTeams);
        if (onTeamsChange) {
          onTeamsChange(updatedTeams);
        }
        toast.success('Team status updated');
      }
    } catch (error) {
      console.error('Error updating team status:', error);
      toast.error('Failed to update team status');
    }
  };

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'developer':
        return 'bg-blue-100 text-blue-800';
      case 'designer':
        return 'bg-pink-100 text-pink-800';
      case 'project_manager':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle card click for details
  const handleCardClick = (team: Team) => {
    setSelectedTeam(team);
    setShowTeamDetails(true);
  };

  // Handle calendar icon click
  const handleCalendarClick = (teamName: string, teamId: string) => {
    console.log('=== TEAM CALENDAR NAVIGATION INITIATED ===');
    console.log('Team name:', teamName);
    console.log('Team ID:', teamId);
    console.log('Workspace ID:', workspaceId);
    console.log('Project ID:', projectId);

    const teamSlug = teamName.toLowerCase().replace(/\s+/g, '-');
    console.log('Generated team slug:', teamSlug);

    // Use the universal route format as specified in requirements
    const targetRoute = `/workspace/${workspaceId}/projects/${projectId}/calendar?team=${teamSlug}`;
    console.log('Navigating to:', targetRoute);

    router.push(targetRoute);
    console.log('Navigation command executed');
  };

  // Handle direct team calendar navigation
  const handleTeamCalendarDirect = (teamId: string) => {
    console.log('=== DIRECT TEAM CALENDAR NAVIGATION INITIATED ===');
    console.log('Team ID:', teamId);
    console.log('Workspace ID:', workspaceId);

    const targetRoute = `/workspace/${workspaceId}/teams/${teamId}/calendar`;
    console.log('Navigating to:', targetRoute);

    router.push(targetRoute);
    console.log('Navigation command executed');
  };

  // Handle chat/video button clicks
  const handleCommunicationClick = (type: 'chat' | 'video') => {
    toast.success(
      `${type === 'chat' ? 'Chat' : 'Video call'} features are being integrated. Coming soon! `
    );
  };

  // Handle team edit
  const handleEditTeam = (team: Team) => {
    setSelectedTeam(team);
    setNewTeamName(team.name);
    setNewTeamSkills(team.skills || []);
    setSkillsInput(team.skills?.join(', ') ?? '');
    setShowCreateForm(true);
    setShowMenu(null);
  };

  // Handle menu toggle
  const handleMenuToggle = (teamId: string) => {
    setShowMenu(showMenu === teamId ? null : teamId);
  };

  return (
    <div className="space-y-6">
      {/* Create Team Form */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Enter team name..."
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          className="h-10 flex-1 rounded-lg border border-neutral-200 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          onClick={() => {
            setShowCreateForm(true);
            setSelectedTeam(null);
            setNewTeamName('');
            setSkillsInput('');
            setNewTeamSkills([]);
          }}
          className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-6 text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Team
        </button>
      </div>

      {showCreateForm && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold">Create New Team</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Team Name
              </label>
              <input
                type="text"
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="h-10 w-full rounded-lg border border-neutral-200 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Skills (optional)
              </label>
              <input
                type="text"
                placeholder="React, UI/UX, DevOps (comma separated)"
                value={skillsInput} // Use raw string instead of join()
                onChange={(e) => {
                  const val = e.target.value;
                  setSkillsInput(val); // Raw typing ko real-time chalne dein, koi space delete nahi hogi!

                  // Backend array ko comma pe split kar ke save karein
                  const skillsArray = val
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);

                  setNewTeamSkills(skillsArray);
                }}
                className="h-10 w-full rounded-lg border border-neutral-200 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateTeam}
                className="h-10 rounded-lg bg-blue-600 px-6 text-white hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setSelectedTeam(null);
                  setNewTeamName('');
                  setSkillsInput('');
                  setNewTeamSkills([]);
                }}
                className="h-10 rounded-lg border border-neutral-200 px-6 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Performance Metrics Row */}
      <div className="grid grid-cols-3 gap-4">
        <div
          onClick={() => setIsMembersModalOpen(true)}
          className="cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Members</div>
              <div className="text-2xl font-bold">{totalMembers}</div>
            </div>
          </div>
        </div>
        <div
          onClick={() => setIsTasksModalOpen(true)}
          className="cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <Zap className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Active Tasks</div>
              <div className="text-2xl font-bold">{totalActiveTasks}</div>
            </div>
          </div>
        </div>
        <div
          onClick={() => setIsMostActiveModalOpen(true)}
          className="cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Most Active</div>
              <div className="truncate text-sm font-bold">
                {mostActiveTeam?.name || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['all', 'active', 'archived'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`rounded-lg px-4 py-2 capitalize transition-colors ${
                filterTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'border bg-white hover:bg-gray-100'
              }`}
            >
              {tab} (
              {teams.filter((t) => tab === 'all' || t.status === tab).length})
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border py-2 pr-4 pl-10 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Teams Grid */}
      {filteredTeams.length === 0 ? (
        <div className="rounded-lg border bg-white py-16 text-center">
          <Users className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <h3 className="mb-2 text-xl font-semibold text-gray-700">
            No teams created yet
          </h3>
          <p className="text-gray-500">
            Start by creating your first squad above!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => {
            const taskCounts = getTeamTaskCounts(team.name);
            // Calculate total active tasks for all team members
            const memberActiveTasks = team.members.reduce((total, member) => {
              const memberCounts = getMemberTaskCounts(member.id, team.id);
              return total + memberCounts.inProgress;
            }, 0);
            return (
              <div
                key={team.id}
                onClick={() => handleCardClick(team)}
                className={`cursor-pointer rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                  team.status === 'archived' ? 'opacity-60' : ''
                }`}
              >
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">
                      {team.name}
                    </h3>
                    <span className="mt-1 inline-block rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                      {team.projectName}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuToggle(team.id);
                      }}
                      className="rounded p-1 hover:bg-gray-100"
                    >
                      <MoreVertical className="h-4 w-4 text-gray-500" />
                    </button>
                    {showMenu === team.id && (
                      <div className="absolute top-8 right-0 z-50 w-48 rounded-lg border bg-white shadow-lg">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTeam(team);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-100"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit Team
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveTeam(team.id);
                            setShowMenu(null);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-100"
                        >
                          <Archive className="h-4 w-4" />
                          {team.status === 'active' ? 'Archive' : 'Unarchive'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Members */}
                <div className="mb-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {team.members.length} members
                    </span>
                  </div>
                  <div className="flex -space-x-2">
                    {team.members.slice(0, 4).map((member, index) => (
                      <div
                        key={`${member.id ?? member.name}-${index}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-medium text-white"
                        title={member.name}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {team.members.length > 4 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs font-medium text-gray-600">
                        +{team.members.length - 4}
                      </div>
                    )}
                  </div>
                </div>

                {/* Skill Tags */}
                {team.skills && team.skills.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1">
                    {team.skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700"
                      >
                        {skill}
                      </span>
                    ))}
                    {team.skills.length > 3 && (
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                        +{team.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Task Counter */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-600">
                      {memberActiveTasks} active tasks
                    </span>
                  </div>
                  {/* Calendar Sync */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCalendarClick(team.name, team.id);
                    }}
                    className="rounded-lg p-1.5 transition-colors hover:bg-blue-50"
                    title="View Team Calendar"
                  >
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                  </button>
                </div>

                {/* Progress Bar */}
                {taskCounts.total > 0 && (
                  <div className="mb-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{
                          width: `${Math.min((taskCounts.completed / taskCounts.total) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-xs text-gray-500">
                        {taskCounts.completed} completed
                      </span>
                      <span className="text-xs text-gray-500">
                        {taskCounts.total} total
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTeam(team);
                      setShowMemberModal(true);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 transition-colors hover:bg-gray-100"
                  >
                    <Plus className="h-4 w-4" />
                    Add Member
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTeam(team);
                      setShowTeamDetails(true);
                      setQuickTaskTitle('');
                      setQuickTaskAssigneeId(undefined);
                    }}
                    className="rounded-lg border px-3 py-2 hover:bg-gray-100"
                    title="Quick Add Task"
                  >
                    <FileText className="h-4 w-4 text-gray-600" />
                  </button>
                  {/* Direct Team Calendar Navigation */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTeamCalendarDirect(team.id);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200"
                    title="View Team Calendar"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    View Team Calendar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCommunicationClick('chat');
                    }}
                    className="rounded-lg border px-3 py-2 hover:bg-gray-100"
                    title="Team Chat"
                  >
                    <MessageSquare className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCommunicationClick('video');
                    }}
                    className="rounded-lg border px-3 py-2 hover:bg-gray-100"
                    title="Video Call"
                  >
                    <Video className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchiveTeam(team.id);
                    }}
                    className="rounded-lg border px-3 py-2 hover:bg-gray-100"
                    title={team.status === 'active' ? 'Archive' : 'Unarchive'}
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTeam(team.id);
                    }}
                    className="rounded-lg border px-3 py-2 text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberModal && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-xl font-bold">
              Add Member to {selectedTeam.name}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="member@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as any)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="admin">Admin</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="developer">Developer</option>
                  <option value="designer">Designer</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowMemberModal(false);
                    setSelectedTeam(null);
                  }}
                  className="rounded-lg border px-4 py-2 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMember}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Add Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Details Side Drawer */}
      {showTeamDetails && selectedTeam && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTeamDetails(false)}
          />
          <div className="relative ml-auto h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white p-6">
              <h2 className="text-xl font-bold">{selectedTeam.name}</h2>
              <button
                onClick={() => setShowTeamDetails(false)}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6 p-6">
              {/* Team Info */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-500">
                  Team Information
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Project:</span>
                    <span className="font-medium">
                      {selectedTeam.projectName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span
                      className={`rounded px-2 py-1 text-xs ${selectedTeam.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {selectedTeam.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span className="font-medium">
                      {new Date(selectedTeam.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Skills */}
              {selectedTeam.skills && selectedTeam.skills.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-500">
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTeam.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Members */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-500">
                  Members ({selectedTeam.members.length})
                </h3>
                {selectedTeam.members.length === 0 ? (
                  <p className="text-sm text-gray-500">No members yet</p>
                ) : (
                  <div className="space-y-3">
                    {selectedTeam.members.map((member) => {
                      const taskCounts = getMemberTaskCounts(
                        member.id,
                        selectedTeam.id
                      );
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 font-medium text-white">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-gray-500">
                              {member.email}
                            </div>
                            {taskCounts.total > 0 && (
                              <div className="mt-1 flex items-center gap-2 text-xs">
                                <span className="text-yellow-600">
                                  🟡 {taskCounts.inProgress} In Progress
                                </span>
                                <span className="text-green-600">
                                  🟢 {taskCounts.completed} Completed
                                </span>
                              </div>
                            )}
                          </div>
                          <span
                            className={`rounded px-2 py-1 text-xs ${getRoleColor(member.role)}`}
                          >
                            {member.role.replace('_', ' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Team Tasks */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-500">
                  Team Tasks
                </h3>
                {(() => {
                  const teamTasks = getTeamTasks(selectedTeam.id);
                  const total = teamTasks.length;
                  const completed = teamTasks.filter(
                    (task) =>
                      task.status === 'COMPLETED' || task.status === 'DONE'
                  ).length;
                  return (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Tasks:</span>
                        <span className="font-medium">{total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Completed:</span>
                        <span className="font-medium">{completed}</span>
                      </div>
                      {total > 0 && (
                        <div className="mt-2">
                          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{
                                width: `${Math.min((completed / total) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <div className="mt-1 text-right text-xs text-gray-500">
                            {Math.round((completed / total) * 100)}% complete
                          </div>
                        </div>
                      )}
                      {/* Quick Add Task Input */}
                      <div className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                        {/* Row 1: Task Title */}
                        <input
                          type="text"
                          placeholder="Task title..."
                          value={quickTaskTitle}
                          onChange={(e) => setQuickTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleQuickTaskCreate(quickTaskTitle);
                              setQuickTaskTitle('');
                              setTaskDueDate('');
                              setTaskPriority('MEDIUM');
                            }
                          }}
                          className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none"
                        />

                        {/* Row 2: Date Picker & Priority Selection */}
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={taskDueDate}
                            onChange={(e) => setTaskDueDate(e.target.value)}
                            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                          <select
                            value={taskPriority}
                            onChange={(e) => setTaskPriority(e.target.value)}
                            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                          </select>
                        </div>

                        {/* Row 3: Assignee Dropdown & Submit Action Button */}
                        <div className="flex gap-2">
                          <select
                            value={quickTaskAssigneeId || ''}
                            onChange={(e) =>
                              setQuickTaskAssigneeId(
                                e.target.value || undefined
                              )
                            }
                            className="h-10 flex-1 rounded-lg border border-neutral-200 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Assign to...</option>
                            {selectedTeam.members?.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              handleQuickTaskCreate(quickTaskTitle);
                              setQuickTaskTitle('');
                              setTaskDueDate('');
                              setTaskPriority('MEDIUM');
                            }}
                            className="flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      
                      {/* Task List with Checkboxes */}
                      {teamTasks.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <h4 className="text-xs font-medium text-gray-500 uppercase">
                            Task List
                          </h4>
                          {teamTasks.map((task) => (
                            <div
                              key={task._id}
                              className="flex items-center gap-2 rounded-lg border p-2 hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  task.status === 'DONE' ||
                                  task.status === 'COMPLETED'
                                }
                                onChange={() =>
                                  handleTaskStatusToggle(task._id)
                                }
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div
                                  className={`text-sm ${
                                    task.status === 'DONE' ||
                                    task.status === 'COMPLETED'
                                      ? 'text-gray-400 line-through'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  {task.title}
                                </div>
                                {task.assignedTo && (
                                  <div className="text-xs text-gray-500">
                                    Assigned to: {task.assignedTo}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`rounded px-2 py-0.5 text-xs ${
                                  task.status === 'DONE' ||
                                  task.status === 'COMPLETED'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {task.status === 'DONE' ||
                                task.status === 'COMPLETED'
                                  ? 'Done'
                                  : 'In Progress'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Quick Actions */}
              <div className="border-t pt-4">
                <button
                  onClick={() => {
                    setSelectedTeam(selectedTeam);
                    setShowMemberModal(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members Roster Modal */}
      <MembersRosterModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        members={teams.flatMap((team) =>
          team.members.map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role,
            teamName: team.name,
          }))
        )}
      />

      {/* Active Tasks Modal */}
      <ActiveTasksModal
        isOpen={isTasksModalOpen}
        onClose={() => setIsTasksModalOpen(false)}
        tasks={calendarTasks}
      />

      {/* Team Leaderboard Modal */}
      <TeamLeaderboardModal
        isOpen={isMostActiveModalOpen}
        onClose={() => setIsMostActiveModalOpen(false)}
        teams={teams.map((team) => {
          const teamTasks = calendarTasks.filter(
            (task) => task.teamId === team.id
          );
          const completedTasks = teamTasks.filter(
            (task) => task.status === 'DONE' || task.status === 'COMPLETED'
          ).length;
          const totalTasks = teamTasks.length;
          const activeTasks = totalTasks - completedTasks;
          const completionRate =
            totalTasks > 0
              ? Math.round((completedTasks / totalTasks) * 100)
              : 0;

          return {
            id: team.id,
            name: team.name,
            totalTasks,
            completedTasks,
            activeTasks,
            completionRate,
          };
        })}
      />
    </div>
  );
}
