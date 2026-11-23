// components/search/SearchResults.tsx

'use client';

import Link from 'next/link';

export interface SearchResultsData {
  tasks: Array<{
    _id: string;
    title: string;
    status: string;
    project: string;
    snippet: string;
  }>;
  projects: Array<{
    _id: string;
    name: string;
    workspace: string;
    snippet: string;
  }>;
  users: Array<{ _id: string; name: string; email?: string; avatar?: string }>;
}

interface SearchResultsProps {
  results: SearchResultsData;
  query: string;
  onClose: () => void;
}

function hasAny(results: SearchResultsProps['results']): boolean {
  return (
    results.tasks.length > 0 ||
    results.projects.length > 0 ||
    results.users.length > 0
  );
}

function ResultLink({
  href,
  children,
  onClose,
}: {
  href: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="block rounded px-2 py-1.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  );
}

export default function SearchResults({ results, query, onClose }: SearchResultsProps) {
  return (
    <div
      id="global-search-results"
      role="region"
      aria-label="Search results"
      className="absolute z-50 mt-2 w-full max-h-[28rem] overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-lg"
    >
      {!hasAny(results) ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">
          No results for &ldquo;{query}&rdquo;
        </p>
      ) : (
        <>
          {results.tasks.length > 0 && (
            <section aria-label="Task results">
              <h3 className="px-2 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tasks ({results.tasks.length})
              </h3>
              {results.tasks.map((task) => (
                <ResultLink
                  key={task._id}
                  href={`/tasks/${task._id}`}
                  onClose={onClose}
                >
                  <span className="block truncate text-sm font-medium text-foreground">
                    {task.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {task.snippet || task.status.replace(/_/g, ' ')}
                  </span>
                </ResultLink>
              ))}
            </section>
          )}

          {results.projects.length > 0 && (
            <section aria-label="Project results">
              <h3 className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Projects ({results.projects.length})
              </h3>
              {results.projects.map((project) => (
                <ResultLink
                  key={project._id}
                  href={`/workspace/${project.workspace}/projects/${project._id}`}
                  onClose={onClose}
                >
                  <span className="block truncate text-sm font-medium text-foreground">
                    {project.name}
                  </span>
                  {project.snippet && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {project.snippet}
                    </span>
                  )}
                </ResultLink>
              ))}
            </section>
          )}

          {results.users.length > 0 && (
            <section aria-label="People results">
              <h3 className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                People ({results.users.length})
              </h3>
              {results.users.map((user) => (
                <div key={user._id} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {user.name}
                    </span>
                    {user.email && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
