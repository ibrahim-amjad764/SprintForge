// components/search/SearchBox.tsx

'use client';

import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/api';
import SearchResults from './SearchResults';

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (value: string) => {
    setQuery(value);

    if (!value || value.trim().length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest(`/api/search?q=${encodeURIComponent(value)}`);
      setResults(response.data);
    } catch (error) {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="relative w-full max-w-md">
      <input
        className="w-full rounded border border-gray-300 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Search..."
        value={query}
        onChange={(e) => search(e.target.value)}
        disabled={loading}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
        </div>
      )}
      {results && <SearchResults results={results} />}
    </div>
  );
}
