'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Filter,
  Bell,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export type ViewType = 'month' | 'week' | 'day' | 'agenda';

// Get category color (defined outside component for shared use)
const getCategoryColor = (category?: string) => {
  switch (category) {
    case 'bug':
      return 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 border-red-300 dark:border-red-500/40';
    case 'milestone':
      return 'bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/40';
    case 'deployment':
      return 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/40';
    case 'meeting':
      return 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-500/40';
    default:
      return 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300 border-green-300 dark:border-green-500/40';
  }
};

// Get initials from name
const getInitials = (name?: string) => {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Generate consistent hash-based color from string
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, 70%, 50%)`;
};

// Get team color with fallback to hash-based generation
const getTeamColor = (teamId?: string, teamData?: any) => {
  if (!teamId) return '#9CA3AF'; // Neutral gray for no team
  
  // Check if team has explicit color
  if (teamData?.color) return teamData.color;
  
  // Fallback to hash-based color from teamId
  return stringToColor(teamId);
};

// Get avatar color from assignee name
const getAvatarColorHash = (name?: string) => {
  if (!name) return '#9CA3AF'; // Neutral gray
  return stringToColor(name);
};

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  category?: 'bug' | 'milestone' | 'deployment' | 'meeting' | 'task';
  assignee?:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
        fullName?: string;
        email?: string;
      };
  assignedTo?:
    | string
    | {
        name?: string;
        fullName?: string;
        email?: string;
      };
  assignedToId?: string;
  completedAt?: string;
  teamId?: string | { _id?: string; id?: string; name?: string };
  projectId?: string;
}

interface CalendarProps {
  tasks: Task[];
  onTaskCreated?: (task: Task) => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
}

export default function Calendar({
  tasks,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
}: CalendarProps) {
  const pathname = usePathname();
  // /workspace/[workspaceId]/projects/[projectId]/...
  const currentProjectId = pathname?.split('/')[4] || undefined;
  const [currentTeamId, setCurrentTeamId] = useState<string | undefined>(
    undefined
  );

  // Check URL for team query parameter
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const teamParam = urlParams.get('team');
      if (teamParam) {
        // Find team by slug and get its ID
        try {
          const workspaceId = window.location.pathname.split('/')[2];
          const storedTeams = localStorage.getItem(`teams_${workspaceId}`);
          if (storedTeams) {
            const teams = JSON.parse(storedTeams);
            const team = teams.find(
              (t: any) => t.name.toLowerCase().replace(/\s+/g, '-') === teamParam
            );
            if (team) {
              setCurrentTeamId(team.id);
            }
          }
        } catch (error) {
          console.error('Error finding team from URL:', error);
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    assignee: 'all',
    team: 'all',
  });
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [showOverflowModal, setShowOverflowModal] = useState(false);
  const [overflowTasks, setOverflowTasks] = useState<Task[]>([]);
  const [dbTeams, setDbTeams] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [assigneesList, setAssigneesList] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<any[]>([]);

  const resolveTaskTeamId = (teamId?: Task['teamId']) => {
    if (!teamId) return undefined;
    return typeof teamId === 'string' ? teamId : teamId._id || teamId.id;
  };

  const resolveTaskAssigneeName = (
    assignee?: Task['assignee'] | Task['assignedTo']
  ) => {
    if (!assignee) return undefined;
    return typeof assignee === 'string'
      ? assignee
      : assignee.name || assignee.fullName || assignee.email;
  };

  // Load tasks from API on mount
  useEffect(() => {
    async function loadTasks() {
      console.log('📆 Calendar: Loading tasks...');
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const teamParam = urlParams.get('team');
        const workspaceId = window.location.pathname.split('/')[2];

        console.log('📆 Calendar: URL params - team:', teamParam, 'workspace:', workspaceId, 'project:', currentProjectId);

        if (teamParam && workspaceId) {
          // Global team view - fetch workspace-scoped tasks
          console.log('📆 Calendar: Fetching workspace-scoped tasks');
          const response = await fetch(
            `/api/tasks?workspace=${workspaceId}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              console.log('📆 Calendar tasks received:', data.data.length);
              // Transform DB tasks to match Task interface
              const transformedTasks = data.data.map((dbTask: any) => {
                console.log('📅 Calendar task date:', dbTask.dueDate);
                console.log('👤 Calendar task assignee:', dbTask.assignee);
                console.log('👥 Calendar task teamId:', dbTask.teamId);
                
                return {
                  _id: dbTask._id,
                  title: dbTask.title,
                  description: dbTask.description,
                  projectId: dbTask.project,
                  assignedToId: dbTask.assignee?._id || dbTask.assignee,
                  assignedTo: dbTask.assignee?.name || dbTask.assignee,
                  assignee: dbTask.assignee,
                  status: dbTask.status,
                  priority: dbTask.priority,
                  dueDate: dbTask.dueDate,
                  createdAt: dbTask.createdAt,
                  updatedAt: dbTask.updatedAt,
                  teamId: dbTask.teamId,
                };
              });
              setLocalTasks(transformedTasks);
              console.log('📆 Calendar: Tasks transformed and set');
            }
          }
        } else if (currentProjectId) {
          // Project view - fetch project-scoped tasks
          console.log('📆 Calendar: Fetching project-scoped tasks for project:', currentProjectId);
          const response = await fetch(
            `/api/tasks?project=${currentProjectId}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              console.log('📆 Calendar tasks received:', data.data.length);
              // Transform DB tasks to match Task interface
              const transformedTasks = data.data.map((dbTask: any) => {
                console.log('📅 Calendar task date:', dbTask.dueDate);
                console.log('👤 Calendar task assignee:', dbTask.assignee);
                console.log('👥 Calendar task teamId:', dbTask.teamId);
                
                return {
                  _id: dbTask._id,
                  title: dbTask.title,
                  description: dbTask.description,
                  projectId: dbTask.project,
                  assignedToId: dbTask.assignee?._id || dbTask.assignee,
                  assignedTo: dbTask.assignee?.name || dbTask.assignee,
                  assignee: dbTask.assignee,
                  status: dbTask.status,
                  priority: dbTask.priority,
                  dueDate: dbTask.dueDate,
                  createdAt: dbTask.createdAt,
                  updatedAt: dbTask.updatedAt,
                  teamId: dbTask.teamId,
                };
              });
              setLocalTasks(transformedTasks);
              console.log('📆 Calendar: Tasks transformed and set');
            }
          }
        }
      } catch (error) {
        console.error('❌ Calendar: Error loading tasks from API:', error);
      }
    }

    loadTasks();
  }, [currentProjectId]);

  // Load teams for metrics mapping
  useEffect(() => {
    const workspaceId = window.location.pathname.split('/')[2];
    if (!workspaceId) return;
    fetch(`/api/teams?workspace=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => setTeamsList(data?.data || data || []))
      .catch((err) =>
        console.error('Error loading teams for metrics mapping:', err)
      );
  }, []);

  // Load teams and assignees from API
  useEffect(() => {
    async function loadTeamsAndAssignees() {
      try {
        const workspaceId = window.location.pathname.split('/')[2];
        if (workspaceId) {
          const teamsResponse = await fetch(
            `/api/teams?workspace=${workspaceId}`
          );
          if (teamsResponse.ok) {
            const teamsData = await teamsResponse.json();
            const teamRecords = teamsData?.data || teamsData || [];
            setDbTeams(teamRecords);

            // Parse members robustly - handle both objects and strings
            const membersMap: { [key: string]: string } = {};
            teamRecords.forEach((team: any) => {
              team.members?.forEach((m: any) => {
                const mId = typeof m === 'object' ? (m._id || m.id) : m;
                const mName = typeof m === 'object' ? m.name : m;
                if (mId && mName) {
                  membersMap[mId] = mName;
                }
              });
            });

            const uniqueAssignees = Array.from(new Set(Object.values(membersMap)));
            setAssigneesList(uniqueAssignees);
          }
        }
      } catch (error) {
        console.error('Error loading teams and assignees:', error);
      }
    }

    loadTeamsAndAssignees();
  }, []);

  // Resolve team URL slug to team ID for global team view
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const teamParam = urlParams.get('team');

      if (teamParam && teamsList.length > 0) {
        const matchedTeam = teamsList.find(
          (team) =>
            team.name?.toLowerCase().replace(/\s+/g, '-') ===
            teamParam.toLowerCase()
        );

        if (matchedTeam?._id) {
          setFilters((prev) => ({
            ...prev,
            team: String(matchedTeam._id),
          }));
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [teamsList]);

  // Navigation functions
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToPrevious = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (view === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else if (view === 'week') {
        newDate.setDate(newDate.getDate() - 7);
      } else if (view === 'day') {
        newDate.setDate(newDate.getDate() - 1);
      }
      return newDate;
    });
  };

  const goToNext = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (view === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (view === 'week') {
        newDate.setDate(newDate.getDate() + 7);
      } else if (view === 'day') {
        newDate.setDate(newDate.getDate() + 1);
      }
      return newDate;
    });
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-green-500';
      case 'URGENT':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  //  Naya Fixed Filtering Logic
  const filteredTasks = localTasks.filter((task) => {
    // Determine if we're in global team view
    const urlParams = new URLSearchParams(window.location.search);
    const teamParam = urlParams.get('team');
    const isGlobalTeamView = teamParam !== null;

    // Project filtering: Only apply in project view, not in global team view
    if (!isGlobalTeamView && currentProjectId) {
      if (String(task.projectId) !== String(currentProjectId)) {
        return false;
      }
    }

    // 2. Safe Filter Check (Status)
    if (
      filters.status &&
      filters.status !== 'all' &&
      task.status !== filters.status
    ) {
      return false;
    }

    // 3. Safe Filter Check (Priority)
    if (
      filters.priority &&
      filters.priority !== 'all' &&
      task.priority !== filters.priority
    ) {
      return false;
    }

    // 4. BULLETPROOF TEAM FILTER MATCHING
    if (filters.team && filters.team !== 'all') {
      // Extract the raw team ID string from the task document object safely
      const taskTeamId = task.teamId && typeof task.teamId === 'object' 
        ? (task.teamId._id || task.teamId.id) 
        : task.teamId;

      // Direct structural type-string matching configuration
      if (String(taskTeamId) !== String(filters.team)) {
        return false;
      }
    }

    // 5. Existing Assignee Filter
    if (filters.assignee && filters.assignee !== 'all') {
      const taskAssigneeId = task.assignee && typeof task.assignee === 'object'
        ? (task.assignee._id || task.assignee.id)
        : task.assignee;
      if (String(taskAssigneeId) !== String(filters.assignee)) return false;
    }

    return true;
  });

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    // 1. ISO String direct use karne ke bajaye local string format nikalain
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`; // Yeh hamesha pure '2026-08-22' banayega

    const tasksForDate = filteredTasks.filter((task) => {
      if (!task.dueDate) return false;

      // 2. Task ki dueDate ko bhi split kar ke saaf check karein
      let taskDateStr: string;
      
      if (typeof task.dueDate === 'string') {
        taskDateStr = task.dueDate.split('T')[0];
      } else if (task.dueDate && typeof task.dueDate === 'object' && 'getFullYear' in task.dueDate) {
        const taskDate = task.dueDate as Date;
        const taskYear = taskDate.getFullYear();
        const taskMonth = String(taskDate.getMonth() + 1).padStart(2, '0');
        const taskDay = String(taskDate.getDate()).padStart(2, '0');
        taskDateStr = `${taskYear}-${taskMonth}-${taskDay}`;
      } else {
        return false;
      }

      return taskDateStr === dateStr;
    });

    console.log(
      `📆 Calendar: Tasks for date ${dateStr} (project: ${currentProjectId})`,
      tasksForDate
    );
    return tasksForDate;
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Check if date is weekend
  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  // Handle task pill click
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

  // Handle overflow click
  const handleOverflowClick = (date: Date) => {
    const dayTasks = getTasksForDate(date);
    setOverflowTasks(dayTasks);
    setShowOverflowModal(true);
  };

  // Month View
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(
        <div
          key={`empty-${i}`}
          className="min-h-24 border border-border bg-muted"
        ></div>
      );
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const dayTasks = getTasksForDate(date);
      const today = isToday(date);
      const weekend = isWeekend(date);

      days.push(
        <div
          key={day}
          onClick={(e) => {
            // Don't trigger modal if clicking on task pill
            if ((e.target as HTMLElement).closest('.task-pill')) return;
            setSelectedDate(date);
            setShowModal(true);
          }}
          className={`min-h-24 cursor-pointer border border-border p-1.5 transition-colors hover:bg-muted/60 ${
            today
              ? 'border-primary/30 bg-primary/5'
              : weekend
                ? 'bg-muted/30'
                : 'bg-card'
          }`}
        >
          <div className="mb-1 flex items-center justify-between">
            {today ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground tabular-nums">
                {day}
              </span>
            ) : (
              <span className="text-sm font-medium text-foreground">{day}</span>
            )}
          </div>
          <div className="space-y-1">
            {dayTasks.slice(0, 3).map((task) => {
              const taskTeamId = typeof task.teamId === 'object' ? task.teamId?._id || task.teamId?.id : task.teamId;
              const teamData = teamsList.find(t => String(t._id) === String(taskTeamId));
              const taskTeamColor = getTeamColor(taskTeamId, teamData);
              const assigneeName = typeof task.assignee === 'object' ? task.assignee?.name : task.assignee;
              const assigneeInitials = getInitials(assigneeName);
              const assigneeAvatarColor = getAvatarColorHash(assigneeName);
              const teamName = typeof task.teamId === 'object' 
                ? task.teamId?.name 
                : (teamsList.find(t => String(t._id) === String(task.teamId))?.name || 'Team');
              
              return (
                <div
                  key={task._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTaskClick(task);
                  }}
                  style={{ borderLeft: `4px solid ${taskTeamColor}` }}
                  className="task-pill mb-1 flex min-h-[45px] cursor-pointer flex-col justify-between rounded-md border border-border bg-card p-1.5 pl-2 text-foreground shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-popover"
                  title={task.title}
                >
                  <div className="font-medium text-[11px] text-foreground truncate pr-4">
                    {task.title}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[9px]">
                    {task.teamId && (
                      <span 
                        style={{ backgroundColor: `${taskTeamColor}20`, color: taskTeamColor }} 
                        className="px-1 py-0.5 rounded font-medium max-w-[65%] truncate"
                      >
                        👥 {teamName}
                      </span>
                    )}
                    {task.assignee && (
                      <div
                        title={assigneeName}
                        style={{ backgroundColor: assigneeAvatarColor }}
                        className="w-4 h-4 rounded-full text-white font-bold flex items-center justify-center absolute bottom-1 right-1 shadow-sm"
                      >
                        {assigneeInitials}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {dayTasks.length > 3 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleOverflowClick(date);
                }}
                className="cursor-pointer text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                +{dayTasks.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  // Week View
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayTasks = getTasksForDate(date);
      const today = isToday(date);
      const weekend = isWeekend(date);

      days.push(
        <div
          key={i}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('.task-pill')) return;
            setSelectedDate(date);
            setShowModal(true);
          }}
          className={`min-h-96 cursor-pointer border border-border p-4 transition-colors hover:bg-muted/60 ${
            today
              ? 'border-primary/30 bg-primary/5'
              : weekend
                ? 'bg-muted/30'
                : 'bg-card'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              {today ? (
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono text-sm font-semibold text-primary-foreground tabular-nums">
                    {date.getDate()}
                  </span>
                  <span className="text-lg font-medium text-foreground">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="text-xs font-medium text-primary">
                    (Today)
                  </span>
                </div>
              ) : (
                <span className="text-lg font-medium text-foreground">
                  {date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {dayTasks.map((task) => {
              const taskTeamId = typeof task.teamId === 'object' ? task.teamId?._id || task.teamId?.id : task.teamId;
              const teamData = teamsList.find(t => String(t._id) === String(taskTeamId));
              const taskTeamColor = getTeamColor(taskTeamId, teamData);
              const assigneeName = typeof task.assignee === 'object' ? task.assignee?.name : task.assignee;
              
              return (
                <div
                  key={task._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTaskClick(task);
                  }}
                  className={`task-pill rounded border-r-4 border-l-4 p-2 pl-3 text-sm ${getCategoryColor(task.category)} cursor-pointer hover:opacity-80`}
                  style={{ 
                    borderLeftColor: taskTeamColor,
                    borderRightColor: taskTeamColor
                  }}
                >
                  <div className="font-medium">{task.title}</div>
                  {task.description && (
                    <div className="mt-1 text-xs opacity-75">
                      {task.description}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-2">
                    {task.teamId && teamData && (
                      <span 
                        className="inline-block max-w-[60%] truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ 
                          backgroundColor: `${taskTeamColor}20`,
                          color: taskTeamColor
                        }}
                      >
                        {teamData.name}
                      </span>
                    )}
                    {assigneeName && (
                      <div 
                        title={assigneeName}
                        className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: getAvatarColorHash(assigneeName) }}
                      >
                        {getInitials(assigneeName)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return days;
  };

  // Day View
  const renderDayView = () => {
    const dayTasks = getTasksForDate(currentDate);
    const today = isToday(currentDate);

    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <div
          className={`border-b p-4 ${today ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/50'}`}
        >
          <div className="flex items-center justify-between">
            {today ? (
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-mono text-lg font-semibold text-primary-foreground tabular-nums">
                  {currentDate.getDate()}
                </span>
                <div>
                  <span className="text-xl font-medium text-foreground">
                    {currentDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                    })}
                  </span>
                  <span className="ml-2 text-sm font-medium text-primary">
                    (Today)
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-xl font-medium text-foreground">
                {currentDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-3 p-4">
          {dayTasks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No tasks for this day
            </div>
          ) : (
            dayTasks.map((task) => {
              const taskTeamId = typeof task.teamId === 'object' ? task.teamId?._id || task.teamId?.id : task.teamId;
              const teamData = teamsList.find(t => String(t._id) === String(taskTeamId));
              const taskTeamColor = getTeamColor(taskTeamId, teamData);
              const assigneeName = typeof task.assignee === 'object' ? task.assignee?.name : task.assignee;
              
              return (
                <div
                  key={task._id}
                  className={`rounded-lg border-r-4 border-l-4 p-4 pl-5 ${getCategoryColor(task.category)}`}
                  style={{ 
                    borderLeftColor: taskTeamColor,
                    borderRightColor: taskTeamColor
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-lg font-medium">{task.title}</div>
                      {task.description && (
                        <div className="mt-1 text-sm opacity-75">
                          {task.description}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded bg-card/50 px-2 py-1 text-xs">
                          {task.priority}
                        </span>
                        <span className="rounded bg-card/50 px-2 py-1 text-xs">
                          {task.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        {task.teamId && teamData && (
                          <span 
                            className="inline-block max-w-[60%] truncate rounded px-2 py-1 text-xs font-medium"
                            style={{ 
                              backgroundColor: `${taskTeamColor}20`,
                              color: taskTeamColor
                            }}
                          >
                            {teamData.name}
                          </span>
                        )}
                        {assigneeName && (
                          <div 
                            title={assigneeName}
                            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                            style={{ backgroundColor: getAvatarColorHash(assigneeName) }}
                          >
                            {getInitials(assigneeName)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className={`h-3 w-3 rounded-full ${getPriorityColor(task.priority)}`}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Agenda View
  const renderAgendaView = () => {
    const sortedTasks = [...filteredTasks].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return (
      <div className="space-y-3">
        {sortedTasks.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No upcoming tasks
          </div>
        ) : (
          sortedTasks.map((task) => {
            const taskTeamId = typeof task.teamId === 'object' ? task.teamId?._id || task.teamId?.id : task.teamId;
            const teamData = teamsList.find(t => String(t._id) === String(taskTeamId));
            const taskTeamColor = getTeamColor(taskTeamId, teamData);
            const assigneeName = typeof task.assignee === 'object' ? task.assignee?.name : task.assignee;
            
            return (
              <div
                key={task._id}
                className={`rounded-lg border-r-4 border-l-4 p-4 pl-5 ${getCategoryColor(task.category)} cursor-pointer transition-shadow hover:shadow-md`}
                style={{ 
                  borderLeftColor: taskTeamColor,
                  borderRightColor: taskTeamColor
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{task.title}</div>
                    {task.description && (
                      <div className="mt-1 text-sm opacity-75">
                        {task.description}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      <span className="rounded bg-card/50 px-2 py-1 text-xs">
                        {task.priority}
                      </span>
                      <span className="rounded bg-card/50 px-2 py-1 text-xs">
                        {task.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {task.teamId && teamData && (
                        <span 
                          className="inline-block max-w-[60%] truncate rounded px-2 py-1 text-xs font-medium"
                          style={{ 
                            backgroundColor: `${taskTeamColor}20`,
                            color: taskTeamColor
                          }}
                        >
                          {teamData.name}
                        </span>
                      )}
                      {assigneeName && (
                        <div 
                          title={assigneeName}
                          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                          style={{ backgroundColor: getAvatarColorHash(assigneeName) }}
                        >
                          {getInitials(assigneeName)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`h-3 w-3 rounded-full ${getPriorityColor(task.priority)}`}
                  ></div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {currentDate.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={goToToday}
              className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground shadow-glow transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
            >
              Today
            </button>
            <button
              onClick={goToPrevious}
              aria-label="Previous period"
              className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={goToNext}
              aria-label="Next period"
              className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
            {(['month', 'week', 'day', 'agenda'] as ViewType[]).map(
              (viewType) => (
                <button
                  key={viewType}
                  onClick={() => setView(viewType)}
                  aria-pressed={view === viewType}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    view === viewType
                      ? 'bg-card text-foreground shadow-card'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {viewType}
                </button>
              )
            )}
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Toggle filters"
            aria-expanded={showFilters}
            className={`rounded-lg border p-2 transition-colors ${
              showFilters
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Add Task Button */}
          <button
            onClick={() => {
              setSelectedDate(new Date());
              setShowModal(true);
            }}
            className="btn-sheen flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-glow transition-all duration-150"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Task
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="animate-scale-in fixed top-0 right-0 z-50 h-full w-80 overflow-y-auto border-l border-border bg-card p-6 shadow-popover">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              aria-label="Close filters"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">Review</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Priority
              </label>
              <select
                value={filters.priority}
                onChange={(e) =>
                  setFilters({ ...filters, priority: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Assignee
              </label>
              <select
                value={filters.assignee}
                onChange={(e) =>
                  setFilters({ ...filters, assignee: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
              >
                <option value="all">All Members</option>
                {assigneesList.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Team
              </label>
              <select
                value={filters.team}
                onChange={(e) =>
                  setFilters({ ...filters, team: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
              >
                <option value="all">All Teams</option>
                {dbTeams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() =>
                setFilters({
                  status: 'all',
                  priority: 'all',
                  assignee: 'all',
                  team: 'all',
                })
              }
              className="w-full rounded-lg border border-border px-4 py-2 hover:bg-muted"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      {view === 'month' && (
        <div>
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-px border border-border bg-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="bg-muted p-2 text-center text-sm font-medium text-foreground"
              >
                {day}
              </div>
            ))}
          </div>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px border border-border bg-muted">
            {renderMonthView()}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="grid grid-cols-7 gap-px border border-border bg-muted">
          {renderWeekView()}
        </div>
      )}

      {view === 'day' && <div>{renderDayView()}</div>}

      {view === 'agenda' && <div>{renderAgendaView()}</div>}

      {/* Event Creation Modal */}
      {showModal && (
        <EventModal
          date={selectedDate || new Date()}
          onClose={() => setShowModal(false)}
          teamId={currentTeamId}
          onTaskCreated={async (task) => {
            try {
              // Transform to DB format
              const dbTask = {
                title: task.title,
                description: task.description,
                project: currentProjectId,
                assignee: task.assignedToId,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
              };

              const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbTask),
              });

              if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                  // Transform back to Task interface
                  const transformedTask = {
                    _id: data.data._id,
                    title: data.data.title,
                    description: data.data.description,
                    projectId: data.data.project,
                    assignedToId: data.data.assignee?._id || data.data.assignee,
                    status: data.data.status,
                    priority: data.data.priority,
                    dueDate: data.data.dueDate,
                    createdAt: data.data.createdAt,
                    updatedAt: data.data.updatedAt,
                  };

                  // Update local state for instant preview
                  setLocalTasks((prev) => [...prev, transformedTask]);

                  // Call parent callback if provided
                  if (onTaskCreated) {
                    onTaskCreated(transformedTask);
                  }

                  setShowModal(false);
                }
              }
            } catch (error) {
              console.error('Error creating task:', error);
            }
          }}
        />
      )}

      {/* Task Detail Modal */}
      {showTaskDetail && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => {
            setShowTaskDetail(false);
            setSelectedTask(null);
          }}
          onTaskUpdated={async (updatedTask) => {
            try {
              // Transform to DB format
              const dbTask = {
                title: updatedTask.title,
                description: updatedTask.description,
                project: updatedTask.projectId,
                assignee: updatedTask.assignedToId,
                status: updatedTask.status,
                priority: updatedTask.priority,
                dueDate: updatedTask.dueDate,
              };

              const response = await fetch(`/api/tasks/${updatedTask._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbTask),
              });

              if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                  // Transform back to Task interface
                  const transformedTask = {
                    _id: data.data._id,
                    title: data.data.title,
                    description: data.data.description,
                    projectId: data.data.project,
                    assignedToId: data.data.assignee?._id || data.data.assignee,
                    status: data.data.status,
                    priority: data.data.priority,
                    dueDate: data.data.dueDate,
                    createdAt: data.data.createdAt,
                    updatedAt: data.data.updatedAt,
                  };
                  setLocalTasks((prev) =>
                    prev.map((t) =>
                      t._id === updatedTask._id ? transformedTask : t
                    )
                  );
                  if (onTaskUpdated) onTaskUpdated(transformedTask);
                }
              }
            } catch (error) {
              console.error('Error updating task:', error);
            }
          }}
          onTaskDeleted={async (taskId) => {
            try {
              const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                setLocalTasks((prev) => prev.filter((t) => t._id !== taskId));
                if (onTaskDeleted) onTaskDeleted(taskId);
              }
            } catch (error) {
              console.error('Error deleting task:', error);
            }
          }}
        />
      )}

      {/* Overflow Modal */}
      {showOverflowModal && (
        <OverflowModal
          tasks={overflowTasks}
          onClose={() => {
            setShowOverflowModal(false);
            setOverflowTasks([]);
          }}
          onTaskClick={handleTaskClick}
        />
      )}
    </div>
  );
}

// Task Detail Modal Component
interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

function TaskDetailModal({
  task,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task>(task);

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this task?')) {
      onTaskDeleted(task._id);
      onClose();
      toast.success('Task deleted');
    }
  };

  const handleSave = () => {
    onTaskUpdated(editedTask);
    setIsEditing(false);
    toast.success('Task updated');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md animate-modal-in rounded-2xl border border-border bg-card p-6 shadow-popover">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">Task Details</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted"
          >
            ✕
          </button>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Title
              </label>
              <input
                type="text"
                value={editedTask.title}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, title: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Description
              </label>
              <textarea
                value={editedTask.description || ''}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, description: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
                rows={3}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Priority
              </label>
              <select
                value={editedTask.priority}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, priority: e.target.value })
                }
                className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="rounded-lg border px-4 py-2 hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold">{task.title}</h4>
              {task.description && (
                <p className="mt-2 text-muted-foreground">{task.description}</p>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="rounded-full bg-muted px-3 py-1">
                {task.priority}
              </span>
              <span className="rounded-full bg-muted px-3 py-1">
                {task.status}
              </span>
              {task.category && (
                <span className="rounded-full bg-muted px-3 py-1 capitalize">
                  {task.category}
                </span>
              )}
            </div>
            {task.dueDate && (
              <div className="text-sm text-muted-foreground">
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg border px-4 py-2 hover:bg-muted"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Overflow Modal Component
interface OverflowModalProps {
  tasks: Task[];
  onClose: () => void;
  onTaskClick: (task: Task) => void;
}

function OverflowModal({ tasks, onClose, onTaskClick }: OverflowModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-h-96 w-full max-w-md animate-modal-in overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-popover">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">All Tasks ({tasks.length})</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted"
          >
            ✕
          </button>
        </div>
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task._id}
              onClick={() => {
                onTaskClick(task);
                onClose();
              }}
              className={`cursor-pointer rounded-lg border p-3 hover:opacity-80 ${getCategoryColor(task.category)}`}
            >
              <div className="font-medium">{task.title}</div>
              {task.description && (
                <div className="mt-1 text-xs opacity-75">
                  {task.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Event Modal Component
interface EventModalProps {
  date: Date;
  onClose: () => void;
  onTaskCreated: (task: Task) => void;
  teamId?: string;
}

function EventModal({ date, onClose, onTaskCreated, teamId }: EventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [category, setCategory] = useState<
    'bug' | 'milestone' | 'deployment' | 'meeting' | 'task'
  >('task');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedToId, setAssignedToId] = useState<string | undefined>(
    undefined
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(
    teamId
  );
  const [memberTeams, setMemberTeams] = useState<Record<string, string>>({});
  const [availableMembers, setAvailableMembers] = useState<
    { id: string; name: string; teamId: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  // Load members from teams LocalStorage with team mapping
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const workspaceId = window.location.pathname.split('/')[2];
        const storedTeams = localStorage.getItem(`teams_${workspaceId}`);
        if (storedTeams) {
          const teams = JSON.parse(storedTeams);
          const memberToTeamMap: Record<string, string> = {};
          const members: { id: string; name: string; teamId: string }[] = [];

          teams.forEach((team: any) => {
            team.members.forEach((member: any) => {
              if (!memberToTeamMap[member.name]) {
                memberToTeamMap[member.name] = team.id;
                members.push({
                  id: member.id,
                  name: member.name,
                  teamId: team.id,
                });
              }
            });
          });

          setMemberTeams(memberToTeamMap);
          setAvailableMembers(members);
        }
      } catch (error) {
        console.error('Error loading members from teams:', error);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  // Auto-extract team ID when member is selected
  const handleMemberChange = (memberId: string) => {
    const selectedMember = availableMembers.find((m) => m.id === memberId);
    if (selectedMember) {
      setAssignedTo(selectedMember.name);
      setAssignedToId(selectedMember.id);
      setSelectedTeamId(selectedMember.teamId);
      console.log(
        'Auto-extracted team ID for member:',
        selectedMember.name,
        '->',
        selectedMember.teamId
      );
    } else {
      setAssignedTo('');
      setAssignedToId(undefined);
      setSelectedTeamId(teamId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('EventModal: Submit form started', {
      title,
      description,
      priority,
      category,
      date,
    });

    if (!title.trim()) {
      toast.error('Title is required');
      console.error('EventModal: Title is required');
      return;
    }

    setLoading(true);

    // Create task object with ISO date format
    const dueDate = date.toISOString().split('T')[0];
    console.log('EventModal: Due date in ISO format', dueDate);

    // Auto-extract projectId from URL
    const pathParts = window.location.pathname.split('/');
    const projectId = pathParts[4] || undefined; // /workspace/[workspaceId]/projects/[projectId]/...

    const newTask: Task = {
      _id: `temp-${Date.now()}`,
      title,
      description,
      status: 'TODO',
      priority,
      category,
      dueDate,
      assignedTo: assignedTo || undefined,
      assignedToId: assignedToId || undefined,
      teamId: selectedTeamId || undefined,
      projectId: projectId,
    };

    console.log('EventModal: New task object created', newTask);

    // Call parent callback
    onTaskCreated(newTask);
    toast.success('Task created successfully');
    setLoading(false);
    console.log('EventModal: Task creation completed');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md animate-modal-in rounded-2xl border border-border bg-card p-6 shadow-popover">
        <h3 className="mb-4 text-xl font-bold">Create Task</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
              placeholder="Task title"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
              rows={3}
              placeholder="Task description"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Due Date
            </label>
            <input
              type="date"
              value={date.toISOString().split('T')[0]}
              className="w-full rounded-lg border bg-muted px-3 py-2"
              disabled
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
            >
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="milestone">Milestone</option>
              <option value="deployment">Deployment</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Assign To
            </label>
            <select
              value={assignedToId || ''}
              onChange={(e) => handleMemberChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {availableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-sheen rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all duration-150 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
