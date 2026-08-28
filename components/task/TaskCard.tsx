import { useState } from 'react';
import Link from 'next/link';
import { MoreVertical, ChevronUp, ChevronDown, Trash2, Edit2, Clock, CheckSquare } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface Props {
  title: string;
  status: string;
  priority: string;
  id: string;
  description?: string;
  createdAt?: string;
  href?: string;
  onTaskDeleted?: (taskId: string) => void;
  onTaskUpdated?: (task: any) => void;
  onMoveUp?: (taskId: string) => void;
  onMoveDown?: (taskId: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  searchQuery?: string;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'HIGH': return 'bg-red-100 text-red-800';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
    case 'LOW': return 'bg-green-100 text-green-800';
    case 'URGENT': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusBorder = (status: string) => {
  switch (status) {
    case 'COMPLETED': return 'border-green-300 bg-green-50';
    case 'IN_PROGRESS': return 'border-blue-300 bg-blue-50';
    case 'REVIEW': return 'border-yellow-300 bg-yellow-50';
    default: return 'border-gray-300 bg-white';
  }
};

const getRelativeTime = (dateString?: string) => {
  if (!dateString) return 'Just now';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

const highlightText = (text: string, query: string) => {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
};

export default function TaskCard({
  title,
  status,
  priority,
  id,
  description,
  createdAt,
  href = `/tasks/${id}`,
  onTaskDeleted,
  onTaskUpdated,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
  bulkMode = false,
  selected = false,
  onToggleSelect,
  searchQuery = '',
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      setLoading(true);
      await apiRequest(`/api/tasks/${id}`, { method: 'DELETE' });
      toast.success('Task deleted');
      if (onTaskDeleted) onTaskDeleted(id);
    } catch (err) {
      toast.error('Failed to delete task');
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  const handleEdit = () => {
    // Navigate to edit page or open edit modal
    if (onTaskUpdated) {
      // For now, just navigate to the task page
      window.location.href = href;
    }
    setMenuOpen(false);
  };

  const highlightedTitle = highlightText(title, searchQuery);

  return (
    <div className={`rounded-lg border p-4 transition ${getStatusBorder(status)} ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {/* Bulk Select Checkbox */}
            {bulkMode && (
              <button
                onClick={onToggleSelect}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <CheckSquare className={`w-4 h-4 ${selected ? 'text-blue-600' : 'text-gray-400'}`} />
              </button>
            )}

            {/* Move Up/Down Buttons */}
            {onMoveUp && !isFirst && !bulkMode && (
              <button
                onClick={() => onMoveUp(id)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Move up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            )}
            {onMoveDown && !isLast && !bulkMode && (
              <button
                onClick={() => onMoveDown(id)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Move down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            )}

            {/* Task Title with Link */}
            <Link href={href} className="flex-1">
              <h3 
                className={`font-bold ${status === 'COMPLETED' ? 'line-through text-gray-500' : ''}`}
                dangerouslySetInnerHTML={{ __html: highlightedTitle }}
              />
            </Link>

            {/* Priority Badge */}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(priority)}`}>
              {priority}
            </span>

            {/* Kebab Menu */}
            {!bulkMode && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-6 bg-white rounded-lg border shadow-lg z-10 p-2 min-w-32">
                    <button
                      onClick={handleEdit}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={loading}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status and Time */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="capitalize">{status.replace('_', ' ')}</span>
            {createdAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getRelativeTime(createdAt)}
              </span>
            )}
          </div>

          {/* Description Accordion */}
          {description && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
              {expanded && (
                <p className="mt-2 text-sm text-gray-600">{description}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
