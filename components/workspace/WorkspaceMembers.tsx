// components/workspace/WorkspaceMembers.tsx
'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface Member {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
  };
  role: string;
}

interface WorkspaceMembersProps {
  workspaceId: string;
  currentUserId: string;
}

export default function WorkspaceMembers({ workspaceId, currentUserId }: WorkspaceMembersProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  async function fetchMembers() {
    try {
      setLoading(true);
      const response = await apiRequest(`/api/workspaces/${workspaceId}/members`);
      setMembers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      setInviting(true);
      
      // First find user by email
      const userResponse = await apiRequest(`/api/users?email=${inviteEmail}`);
      if (!userResponse.data || userResponse.data.length === 0) {
        alert('User not found with this email');
        return;
      }

      const user = userResponse.data[0];
      
      await apiRequest(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          user: user._id,
          role: inviteRole,
        }),
      });

      setInviteEmail('');
      setInviteRole('MEMBER');
      fetchMembers();
    } catch (error: any) {
      alert(error.message || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      await apiRequest(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      fetchMembers();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Are you sure you want to remove this member?')) return;
    
    try {
      await apiRequest(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
      });
      fetchMembers();
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  }

  if (loading) {
    return <p>Loading members...</p>;
  }

  return (
    <div className="max-w-4xl">
      <h2 className="mb-6 text-xl font-semibold tracking-tight">Workspace Members</h2>

      {/* Invite Form */}
      <form onSubmit={handleInvite} className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold">Invite Member</h3>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Send an invitation by email</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="email"
            className="w-full flex-1 rounded-lg border border-input bg-muted/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/25 focus:outline-none sm:w-auto"
            placeholder="User email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <select
            className="rounded-lg border border-input bg-muted/50 px-3 py-2.5 text-sm transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/25 focus:outline-none"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="btn-sheen rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {inviting ? 'Inviting...' : 'Invite'}
          </button>
        </div>
      </form>

      {/* Members List */}
      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member._id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
                {member.user.name?.charAt(0) || member.user.email.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{member.user.name || member.user.email}</p>
                <p className="text-sm text-muted-foreground">{member.user.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={member.role}
                onChange={(e) => handleRoleChange(member._id, e.target.value)}
                disabled={member.user._id === currentUserId || member.role === 'OWNER'}
                className="rounded-lg border border-input bg-muted/50 px-3 py-1.5 text-sm transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
              </select>

              {member.user._id !== currentUserId && member.role !== 'OWNER' && (
                <button
                  onClick={() => handleRemove(member._id)}
                  className="text-sm font-medium text-red-600 transition-colors hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
