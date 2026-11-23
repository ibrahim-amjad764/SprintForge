'use client';

import { X, Trophy } from 'lucide-react';

interface TeamStats {
  id: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  completionRate: number;
}

interface TeamLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: TeamStats[];
}

export default function TeamLeaderboardModal({ isOpen, onClose, teams }: TeamLeaderboardModalProps) {
  if (!isOpen) return null;

  // Find the team with highest completion rate
  const topTeam = teams.reduce((max, team) => 
    team.completionRate > max.completionRate ? team : max, teams[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Team Performance Leaderboard</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {teams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No teams found
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className={`p-4 rounded-lg transition-colors ${
                    team.id === topTeam?.id
                      ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 dark:border-yellow-500/40'
                      : 'bg-muted hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* Team Name and Trophy */}
                    <div className="flex items-center gap-3">
                      {team.id === topTeam?.id && (
                        <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-300">
                          <Trophy className="w-5 h-5" />
                          <span className="text-sm font-medium">Top Performer</span>
                        </div>
                      )}
                      <div className="font-semibold text-foreground">{team.name}</div>
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-medium text-foreground">{team.totalTasks}</div>
                        <div className="text-muted-foreground text-xs">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-green-600 dark:text-green-300">{team.completedTasks}</div>
                        <div className="text-muted-foreground text-xs">Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-blue-600 dark:text-blue-300">{team.activeTasks}</div>
                        <div className="text-muted-foreground text-xs">Active</div>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <div className="font-medium text-foreground">{team.completionRate}%</div>
                        <div className="text-muted-foreground text-xs">Velocity</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          team.id === topTeam?.id ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${team.completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
