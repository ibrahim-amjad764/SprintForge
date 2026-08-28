// components/ui/VirtualizedList.tsx
"use client";

import { useRef, useEffect, useState, useCallback } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => 
            renderItem(item, startIndex + index)
          )}
        </div>
      </div>
    </div>
  );
}

// Specialized component for IdP group mapping
interface IdPGroup {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
}

interface VirtualizedIdPGroupListProps {
  groups: IdPGroup[];
  selectedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  height?: number;
}

export function VirtualizedIdPGroupList({
  groups,
  selectedGroups,
  onToggleGroup,
  height = 400,
}: VirtualizedIdPGroupListProps) {
  return (
    <VirtualizedList
      items={groups}
      itemHeight={60}
      containerHeight={height}
      renderItem={(group, index) => (
        <div
          key={group.id}
          className="flex items-center justify-between p-3 border-b hover:bg-gray-50 cursor-pointer"
          onClick={() => onToggleGroup(group.id)}
          style={{ height: 60 }}
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedGroups.has(group.id)}
              onChange={() => onToggleGroup(group.id)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
            <div>
              <p className="font-medium text-sm">{group.name}</p>
              {group.description && (
                <p className="text-xs text-gray-500">{group.description}</p>
              )}
            </div>
          </div>
          {group.memberCount !== undefined && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {group.memberCount} members
            </span>
          )}
        </div>
      )}
      className="border rounded-lg"
    />
  );
}
