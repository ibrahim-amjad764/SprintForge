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
      <h2 className="text-2xl font-bold mb-6">Workspace Members</h2>

      {/* Invite Form */}
      <form onSubmit={handleInvite} className="bg-gray-50 p-6 rounded-lg mb-6">
        <h3 className="font-semibold mb-4">Invite Member</h3>
        <div className="flex gap-4">
          <input
            type="email"
            className="flex-1 border rounded-lg p-3"
            placeholder="User email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <select
            className="border rounded-lg p-3"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50"
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
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {member.user.name?.charAt(0) || member.user.email.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{member.user.name || member.user.email}</p>
                <p className="text-sm text-gray-500">{member.user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <select
                value={member.role}
                onChange={(e) => handleRoleChange(member._id, e.target.value)}
                disabled={member.user._id === currentUserId || member.role === 'OWNER'}
                className="border rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
              </select>

              {member.user._id !== currentUserId && member.role !== 'OWNER' && (
                <button
                  onClick={() => handleRemove(member._id)}
                  className="text-red-600 hover:text-red-800 text-sm"
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
