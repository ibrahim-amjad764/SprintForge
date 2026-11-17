// components/admin/AdminDashboard.tsx
'use client';

import { useEffect, useState } from 'react';

/*
Admin Dashboard v2 — tabbed overview of the platform.

All data comes from /api/admin/* endpoints which independently
enforce DB-backed requireAdmin(). This component only renders;
it never decides authorization.

Tabs: Overview (stats) · Users (search/role mgmt) · Workspaces · Audit Log.
*/

type Tab = 'overview' | 'users' | 'workspaces' | 'audit';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatar?: string;
  createdAt?: string;
}

interface AdminWorkspace {
  _id: string;
  name: string;
  slug: string;
  owner?: { name?: string; email?: string } | string | null;
  memberCount: number;
  maxMembers?: number;
  createdAt?: string;
}

interface AuditEntry {
  _id: string;
  action: string;
  target: string;
  description: string;
  createdAt: string;
  user?: { name?: string; email?: string } | string | null;
}

interface AdminStats {
  totalUsers: number;
  adminUsers: number;
  totalWorkspaces: number;
  totalMembers: number;
  totalTasks: number;
  totalAuditLogs: number;
  newUsers30d: number;
  newWorkspaces30d: number;
}

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'forbidden' }
  | { status: 'unauthorized' }
  | { status: 'ready'; data: T };

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'audit', label: 'Audit Log' },
];

function useAdminFetch<T>(url: string) {
  const [reloadTick, setReloadTick] = useState(0);
  // Keyed result: loading is derived — a fetch "in flight" for a
  // different url/tick renders as loading without a sync setState
  // inside the effect (react-hooks/set-state-in-effect safe).
  const [result, setResult] = useState<{ key: string; state: LoadState<T> } | null>(null);
  const key = `${reloadTick}:${url}`;

  useEffect(() => {
    let cancelled = false;
    const requestKey = key;
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return;
        let next: LoadState<T>;
        if (res.status === 401) next = { status: 'unauthorized' };
        else if (res.status === 403) next = { status: 'forbidden' };
        else if (!res.ok) {
          next = { status: 'error', message: `Request failed (${res.status})` };
        } else {
          const body = await res.json();
          next = { status: 'ready', data: body?.data as T };
        }
        setResult({ key: requestKey, state: next });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            state: {
              status: 'error',
              message: 'Network error — could not reach the server.',
            },
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, reloadTick]);

  const state: LoadState<T> =
    result && result.key === key ? result.state : { status: 'loading' };

  return { state, reload: () => setReloadTick((t) => t + 1) };
}

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border bg-white p-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function StateMessage({
  kind,
  title,
  message,
  onRetry,
}: {
  kind: 'unauthorized' | 'forbidden' | 'error' | 'empty';
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  const styles = {
    unauthorized: 'border-amber-200 bg-amber-50 text-amber-900',
    forbidden: 'border-red-200 bg-red-50 text-red-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    empty: 'border-gray-200 bg-white text-gray-900',
  }[kind];

  return (
    <div className={`rounded-xl border p-8 text-center ${styles}`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {message && <p className="mt-2 text-sm opacity-80">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function PaginationBar({
  pagination,
  onPage,
}: {
  pagination: Pagination;
  onPage: (page: number) => void;
}) {
  if (pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t px-6 py-3 text-sm text-gray-600">
      <span>
        Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
      </span>
      <div className="flex gap-2">
        <button
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
          className="rounded-md border px-3 py-1 disabled:opacity-40 hover:bg-gray-50"
        >
          Previous
        </button>
        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
          className="rounded-md border px-3 py-1 disabled:opacity-40 hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
    />
  );
}

// ---------- Overview tab ----------

function OverviewTab() {
  const { state, reload } = useAdminFetch<AdminStats>('/api/admin/stats');

  if (state.status === 'loading') return <LoadingSpinner label="Loading stats" />;
  if (state.status === 'unauthorized')
    return <StateMessage kind="unauthorized" title="Session expired" message="Please log in again to continue." />;
  if (state.status === 'forbidden')
    return <StateMessage kind="forbidden" title="Access denied" message="Your account does not have permission to view this page." />;
  if (state.status === 'error')
    return <StateMessage kind="error" title="Something went wrong" message={state.message} onRetry={reload} />;

  const s = state.data;
  const cards: { label: string; value: number; hint?: string }[] = [
    { label: 'Total Users', value: s.totalUsers, hint: `+${s.newUsers30d} in 30d` },
    { label: 'Administrators', value: s.adminUsers },
    { label: 'Workspaces', value: s.totalWorkspaces, hint: `+${s.newWorkspaces30d} in 30d` },
    { label: 'Workspace Members', value: s.totalMembers },
    { label: 'Tasks', value: s.totalTasks },
    { label: 'Audit Events', value: s.totalAuditLogs },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">{c.label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{c.value.toLocaleString()}</p>
          {c.hint && <p className="mt-1 text-xs text-gray-400">{c.hint}</p>}
        </div>
      ))}
    </div>
  );
}

// ---------- Users tab ----------

function UsersTab() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debouncedSearch) params.set('q', debouncedSearch);
  if (roleFilter) params.set('role', roleFilter);
  const url = `/api/admin/users?${params.toString()}`;

  const { state, reload } = useAdminFetch<{ users: AdminUser[]; pagination: Pagination }>(url);

  // Filter change → back to page 1 (render-phase adjustment).
  const filterKey = `${debouncedSearch}|${roleFilter}`;
  const [seenFilterKey, setSeenFilterKey] = useState(filterKey);
  if (filterKey !== seenFilterKey) {
    setSeenFilterKey(filterKey);
    setPage(1);
  }

  async function changeRole(user: AdminUser, newRole: 'USER' | 'ADMIN') {
    if (user.role === newRole) return;
    if (
      !window.confirm(
        `Change ${user.email} from ${user.role} to ${newRole}? This takes effect immediately.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/users/${user._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      reload();
    } else {
      const body = await res.json().catch(() => null);
      window.alert(body?.message || 'Role update failed');
    }
  }

  if (state.status === 'loading') return <LoadingSpinner label="Loading users" />;
  if (state.status === 'unauthorized')
    return <StateMessage kind="unauthorized" title="Session expired" message="Please log in again to continue." />;
  if (state.status === 'forbidden')
    return <StateMessage kind="forbidden" title="Access denied" message="Your account does not have permission to view this page." />;
  if (state.status === 'error')
    return <StateMessage kind="error" title="Something went wrong" message={state.message} onRetry={reload} />;

  const { users, pagination } = state.data;

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>

      {users.length === 0 ? (
        <StateMessage kind="empty" title="No users found" message="Try adjusting your search or filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Role</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">Joined</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                            {(user.name || user.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                          <p className="truncate text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-gray-500 sm:table-cell">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user, e.target.value as 'USER' | 'ADMIN')}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                        aria-label={`Change role for ${user.email}`}
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar pagination={pagination} onPage={setPage} />
        </div>
      )}
    </Shell>
  );
}

// ---------- Workspaces tab ----------

function WorkspacesTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debouncedSearch) params.set('q', debouncedSearch);

  const { state, reload } = useAdminFetch<{ workspaces: AdminWorkspace[]; pagination: Pagination }>(
    `/api/admin/workspaces?${params.toString()}`
  );

  const [seenSearch, setSeenSearch] = useState(debouncedSearch);
  if (debouncedSearch !== seenSearch) {
    setSeenSearch(debouncedSearch);
    setPage(1);
  }

  if (state.status === 'loading') return <LoadingSpinner label="Loading workspaces" />;
  if (state.status === 'unauthorized')
    return <StateMessage kind="unauthorized" title="Session expired" message="Please log in again to continue." />;
  if (state.status === 'forbidden')
    return <StateMessage kind="forbidden" title="Access denied" message="Your account does not have permission to view this page." />;
  if (state.status === 'error')
    return <StateMessage kind="error" title="Something went wrong" message={state.message} onRetry={reload} />;

  const { workspaces, pagination } = state.data;

  return (
    <Shell>
      <SearchInput value={search} onChange={setSearch} placeholder="Search name or slug…" />
      {workspaces.length === 0 ? (
        <StateMessage kind="empty" title="No workspaces found" message="Try a different search." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Workspace</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Members</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {workspaces.map((w) => {
                  const owner = typeof w.owner === 'object' && w.owner !== null ? w.owner : null;
                  return (
                    <tr key={w._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{w.name}</p>
                        <p className="text-sm text-gray-500">/{w.slug}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {owner ? owner.name || owner.email : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {w.memberCount}
                        {w.maxMembers ? ` / ${w.maxMembers}` : ''}
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-gray-500 sm:table-cell">
                        {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar pagination={pagination} onPage={setPage} />
        </div>
      )}
    </Shell>
  );
}

// ---------- Audit tab ----------

function AuditTab() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const debouncedAction = useDebounced(actionFilter, SEARCH_DEBOUNCE_MS);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debouncedSearch) params.set('q', debouncedSearch);
  if (debouncedAction) params.set('action', debouncedAction);

  const { state, reload } = useAdminFetch<{ logs: AuditEntry[]; pagination: Pagination }>(
    `/api/admin/logs?${params.toString()}`
  );

  const filterKey = `${debouncedSearch}|${debouncedAction}`;
  const [seenFilter, setSeenFilter] = useState(filterKey);
  if (filterKey !== seenFilter) {
    setSeenFilter(filterKey);
    setPage(1);
  }

  if (state.status === 'loading') return <LoadingSpinner label="Loading audit log" />;
  if (state.status === 'unauthorized')
    return <StateMessage kind="unauthorized" title="Session expired" message="Please log in again to continue." />;
  if (state.status === 'forbidden')
    return <StateMessage kind="forbidden" title="Access denied" message="Your account does not have permission to view this page." />;
  if (state.status === 'error')
    return <StateMessage kind="error" title="Something went wrong" message={state.message} onRetry={reload} />;

  const { logs, pagination } = state.data;

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search action, target, description…" />
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action (e.g. ADMIN_ROLE_CHANGE)"
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {logs.length === 0 ? (
        <StateMessage kind="empty" title="No audit entries" message="Administrative actions will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">When</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Target</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {logs.map((log) => {
                  const actor = typeof log.user === 'object' && log.user !== null ? log.user : null;
                  return (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {actor ? actor.name || actor.email : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">{log.target}</td>
                      <td className="hidden max-w-xs truncate px-6 py-4 text-sm text-gray-500 lg:table-cell">
                        {log.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar pagination={pagination} onPage={setPage} />
        </div>
      )}
    </Shell>
  );
}

// ---------- Root ----------

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-lg border bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'workspaces' && <WorkspacesTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}
