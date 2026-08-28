// components/ui/PrivacyRadioCards.tsx
"use client";

import { Globe, Lock } from 'lucide-react';

interface PrivacyRadioCardsProps {
  visibility: 'private' | 'organization';
  onVisibilityChange: (visibility: 'private' | 'organization') => void;
  disabled?: boolean;
}

export function PrivacyRadioCards({ visibility, onVisibilityChange, disabled = false }: PrivacyRadioCardsProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Workspace Visibility</label>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Private Card */}
        <div
          className={`
            relative p-4 rounded-lg border-2 cursor-pointer transition-all
            ${visibility === 'private'
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
              : 'border-gray-200 bg-white hover:border-gray-300'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={() => !disabled && onVisibilityChange('private')}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${visibility === 'private' ? 'bg-blue-500' : 'bg-gray-200'}`}>
              <Lock className={`w-5 h-5 ${visibility === 'private' ? 'text-white' : 'text-gray-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Private / Restricted</h3>
              <p className="text-xs text-gray-600 mt-1">
                Only invited or approved members can view and access
              </p>
            </div>
          </div>
          
          {visibility === 'private' && (
            <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}
        </div>

        {/* Organization Card */}
        <div
          className={`
            relative p-4 rounded-lg border-2 cursor-pointer transition-all
            ${visibility === 'organization'
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
              : 'border-gray-200 bg-white hover:border-gray-300'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={() => !disabled && onVisibilityChange('organization')}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${visibility === 'organization' ? 'bg-blue-500' : 'bg-gray-200'}`}>
              <Globe className={`w-5 h-5 ${visibility === 'organization' ? 'text-white' : 'text-gray-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Public / Organization-wide</h3>
              <p className="text-xs text-gray-600 mt-1">
                Anyone in your corporate domain can search and join
              </p>
            </div>
          </div>
          
          {visibility === 'organization' && (
            <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
