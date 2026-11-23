// components/ui/MemberInviteCard.tsx
"use client";

import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';

interface Member {
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
}

interface MemberInviteCardProps {
  members: Member[];
  onMembersChange: (members: Member[]) => void;
  disabled?: boolean;
}

export function MemberInviteCard({ members, onMembersChange, disabled = false }: MemberInviteCardProps) {
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [error, setError] = useState<string | null>(null);

  const addMember = () => {
    const email = emailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      setError('Email is required');
      return;
    }

    if (!emailRegex.test(email)) {
      setError('Invalid email format');
      return;
    }

    if (members.some(m => m.email === email)) {
      setError('Member already added');
      return;
    }

    onMembersChange([...members, { email, role: roleInput }]);
    setEmailInput('');
    setError(null);
  };

  const removeMember = (emailToRemove: string) => {
    onMembersChange(members.filter(m => m.email !== emailToRemove));
  };

  const updateMemberRole = (email: string, newRole: 'ADMIN' | 'EDITOR' | 'VIEWER') => {
    onMembersChange(
      members.map(m => m.email === email ? { ...m, role: newRole } : m)
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMember();
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Team Members</label>
      
      {/* Input Row */}
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter email address"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            disabled={disabled}
          />
        </div>
        
        <select
          value={roleInput}
          onChange={(e) => setRoleInput(e.target.value as any)}
          className="rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          disabled={disabled}
        >
          <option value="ADMIN">Admin</option>
          <option value="EDITOR">Editor</option>
          <option value="VIEWER">Viewer</option>
        </select>
        
        <button
          type="button"
          onClick={addMember}
          disabled={disabled}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          <UserPlus className="w-4 h-4" />
          Add
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
      )}

      {/* Members List */}
      {members.length > 0 && (
        <div className="border rounded-lg divide-y">
          {members.map((member) => (
            <div
              key={member.email}
              className="flex items-center justify-between p-3 bg-muted"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/15 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                    {member.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm">{member.email}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <select
                  value={member.role}
                  onChange={(e) => updateMemberRole(member.email, e.target.value as any)}
                  className="text-xs rounded border border-border px-2 py-1 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  disabled={disabled}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="EDITOR">Editor</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                
                <button
                  type="button"
                  onClick={() => removeMember(member.email)}
                  disabled={disabled}
                  className="text-muted-foreground hover:text-red-600 dark:text-red-300 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {members.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No members added yet. Add team members above.
        </p>
      )}
    </div>
  );
}
