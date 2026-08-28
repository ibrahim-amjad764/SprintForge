'use client';

import useAuth from '@/hooks/useAuth';

export default function ProfileContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-muted-foreground">Loading profile...</p>;
  }

  if (!user) {
    return <p className="text-muted-foreground">Please log in to view your profile.</p>;
  }

  return (
    <div className="max-w-2xl rounded-lg border p-6">
      <h2 className="mb-4 text-xl font-semibold">User Information</h2>
      <dl className="space-y-3">
        <div>
          <dt className="text-sm text-muted-foreground">Name</dt>
          <dd className="font-medium">{user.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Email</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
      </dl>
    </div>
  );
}
