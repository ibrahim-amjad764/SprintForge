'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Filter, X, ChevronDown } from 'lucide-react';

export interface FilterState {
  search: string;
  priority: string[];
  status: string[];
  assigneeId: string[];
}

interface GlobalFilterProps {
  onFilterChange: (filters: FilterState) => void;
  availableAssignees?: { id: string; name: string }[];
  showStatusFilter?: boolean;
  showPriorityFilter?: boolean;
  showAssigneeFilter?: boolean;
}

const priorityOptions = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
  { value: 'URGENT', label: 'Urgent' },
];

const statusOptions = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'REVIEW', label: 'In Review' },
  { value: 'DONE', label: 'Done' },
];

export default function GlobalFilter({
  onFilterChange,
  availableAssignees = [],
  showStatusFilter = true,
  showPriorityFilter = true,
  showAssigneeFilter = true,
}: GlobalFilterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>(
    searchParams.get('priority')?.split(',') || []
  );
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    searchParams.get('status')?.split(',') || []
  );
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    searchParams.get('assignee')?.split(',') || []
  );

  // Update URL and notify parent when filters change
  const updateFilters = () => {
    const params = new URLSearchParams();
    
    if (search) params.set('search', search);
    if (selectedPriorities.length > 0) params.set('priority', selectedPriorities.join(','));
    if (selectedStatuses.length > 0) params.set('status', selectedStatuses.join(','));
    if (selectedAssignees.length > 0) params.set('assignee', selectedAssignees.join(','));

    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    router.replace(newUrl, { scroll: false });

    onFilterChange({
      search,
      priority: selectedPriorities,
      status: selectedStatuses,
      assigneeId: selectedAssignees,
    });
  };

  const togglePriority = (value: string) => {
    setSelectedPriorities((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
    updateFilters();
  };

  const toggleStatus = (value: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
    updateFilters();
  };

  const toggleAssignee = (value: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
    updateFilters();
  };

  const clearAllFilters = () => {
    setSearch('');
    setSelectedPriorities([]);
    setSelectedStatuses([]);
    setSelectedAssignees([]);
    updateFilters();
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    updateFilters();
  };

  const hasActiveFilters =
    search || selectedPriorities.length > 0 || selectedStatuses.length > 0 || selectedAssignees.length > 0;

  return (
    <div className="flex items-center gap-3">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-muted/50 py-2 pr-4 pl-10 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Button */}
      <div className="relative">
        <button
          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            hasActiveFilters
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-card hover:bg-muted'
          }`}
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          )}
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Filter Dropdown */}
        {showFilterDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowFilterDropdown(false)}
            />
            <div className="animate-scale-in absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-border bg-popover p-4 shadow-popover">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Filters</h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:text-blue-300"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Priority Filter */}
              {showPriorityFilter && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">Priority</h4>
                  <div className="space-y-2">
                    {priorityOptions.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPriorities.includes(option.value)}
                          onChange={() => togglePriority(option.value)}
                          className="rounded border-border text-blue-600 dark:text-blue-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-foreground">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Filter */}
              {showStatusFilter && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">Status</h4>
                  <div className="space-y-2">
                    {statusOptions.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(option.value)}
                          onChange={() => toggleStatus(option.value)}
                          className="rounded border-border text-blue-600 dark:text-blue-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-foreground">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignee Filter */}
              {showAssigneeFilter && availableAssignees.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Assignee</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {availableAssignees.map((assignee) => (
                      <label key={assignee.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAssignees.includes(assignee.id)}
                          onChange={() => toggleAssignee(assignee.id)}
                          className="rounded border-border text-blue-600 dark:text-blue-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-foreground">{assignee.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {availableAssignees.length === 0 && showAssigneeFilter && (
                <p className="text-sm text-muted-foreground italic">No assignees available</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
