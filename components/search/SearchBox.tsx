// components/search/SearchBox.tsx

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import SearchResults, { type SearchResultsData } from './SearchResults';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultsData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const search = useCallback(async (value: string) => {
    const trimmed = value.trim();
    setQuery(value);

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const seq = ++requestSeq.current;
    try {
      const response = await apiRequest(
        `/api/search?q=${encodeURIComponent(trimmed)}`
      );
      // Ignore stale responses from earlier keystrokes
      if (seq === requestSeq.current) {
        setResults(response.data);
        setOpen(true);
      }
    } catch {
      if (seq === requestSeq.current) {
        setResults(null);
        setOpen(false);
      }
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  const onChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value), DEBOUNCE_MS);
    },
    [search]
  );

  const close = useCallback(() => {
    setOpen(false);
    setResults(null);
  }, []);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [close]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        type="search"
        className="w-full rounded border border-border bg-card p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Search tasks, projects, people..."
        aria-label="Search tasks, projects and people"
        aria-expanded={open}
        aria-controls="global-search-results"
        role="combobox"
        aria-autocomplete="list"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
        disabled={loading}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div
            className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-blue-500"
            role="status"
            aria-label="Searching"
          />
        </div>
      )}
      {open && results && (
        <SearchResults
          results={results}
          query={query.trim()}
          onClose={close}
        />
      )}
    </div>
  );
}
