// components/ui/WorkspaceHeroBanner.tsx
"use client";

import { Zap, Lock, Bot, Users, Shield, CheckCircle } from 'lucide-react';

interface WorkspaceHeroBannerProps {
  className?: string;
}

export function WorkspaceHeroBanner({ className = '' }: WorkspaceHeroBannerProps) {
  const features = [
    {
      icon: <Zap className="w-5 h-5 text-yellow-400" />,
      text: 'Auto-sync templates instantly',
    },
    {
      icon: <Lock className="w-5 h-5 text-blue-400" />,
      text: 'Enterprise domain restriction active',
    },
    {
      icon: <Bot className="w-5 h-5 text-purple-400" />,
      text: 'AI workspace automation ready',
    },
    {
      icon: <Users className="w-5 h-5 text-green-400" />,
      text: 'Collaborative team workspaces',
    },
    {
      icon: <Shield className="w-5 h-5 text-red-400" />,
      text: 'SOC2 & GDPR compliant',
    },
  ];

  return (
    <div className={`bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white ${className}`}>
      <h2 className="text-xl font-bold mb-2">What is SprintForge Workspace?</h2>
      <p className="text-gray-300 text-sm mb-6">
        A powerful collaborative platform designed for modern teams to manage projects, 
        track progress, and automate workflows with enterprise-grade security.
      </p>

      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-gray-200">Key Features:</h3>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-3 text-sm">
              <div className="flex-shrink-0">{feature.icon}</div>
              <span className="text-gray-300">{feature.text}</span>
              <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Trusted by enterprise teams worldwide</span>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>All systems operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}
