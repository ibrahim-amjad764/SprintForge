'use client';

import useAuth from '@/hooks/useAuth';
import { Mail, User } from 'lucide-react';

export default function ProfileContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4" aria-busy="true" aria-label="Loading profile">
        <div className="skeleton-shimmer h-24 rounded-2xl border border-border bg-card" />
        <div className="skeleton-shimmer h-40 rounded-2xl border border-border bg-card" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <p className="text-sm text-muted-foreground">Please log in to view your profile.</p>
      </div>
    );
  }

  const initials = (user.name || user.email || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-2xl space-y-5">
      {/* Identity card */}
      <div className="animate-enter flex items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 font-mono text-lg font-bold text-white shadow-glow">
          {initials}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold tracking-tight">{user.name}</h2>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* Details card */}
      <div className="animate-enter rounded-2xl border border-border bg-card p-6 shadow-card" style={{ '--i': 1 } as React.CSSProperties}>
        <h3 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          User Information
        </h3>
        <dl className="divide-y divide-border">
          <div className="flex items-center gap-3 py-3.5">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dt className="w-24 shrink-0 text-sm text-muted-foreground">Name</dt>
            <dd className="text-sm font-medium text-foreground">{user.name}</dd>
          </div>
          <div className="flex items-center gap-3 py-3.5">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dt className="w-24 shrink-0 text-sm text-muted-foreground">Email</dt>
            <dd className="truncate text-sm font-medium text-foreground">{user.email}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
