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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Button */}
      <div className="relative">
        <button
          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
            hasActiveFilters
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-blue-600 rounded-full" />
          )}
          <ChevronDown className="w-4 h-4" />
        </button>

        {/* Filter Dropdown */}
        {showFilterDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowFilterDropdown(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border shadow-xl z-20 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Filters</h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Priority Filter */}
              {showPriorityFilter && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Priority</h4>
                  <div className="space-y-2">
                    {priorityOptions.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPriorities.includes(option.value)}
                          onChange={() => togglePriority(option.value)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Filter */}
              {showStatusFilter && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Status</h4>
                  <div className="space-y-2">
                    {statusOptions.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(option.value)}
                          onChange={() => toggleStatus(option.value)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignee Filter */}
              {showAssigneeFilter && availableAssignees.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Assignee</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {availableAssignees.map((assignee) => (
                      <label key={assignee.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAssignees.includes(assignee.id)}
                          onChange={() => toggleAssignee(assignee.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{assignee.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {availableAssignees.length === 0 && showAssigneeFilter && (
                <p className="text-sm text-gray-500 italic">No assignees available</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
