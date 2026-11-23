// components/ui/WorkspaceHeroBanner.tsx
"use client";

import { Zap, Lock, Bot, Users, Shield, CheckCircle } from 'lucide-react';

interface WorkspaceHeroBannerProps {
  className?: string;
}

export function WorkspaceHeroBanner({ className = '' }: WorkspaceHeroBannerProps) {
  const features = [
    {
      icon: <Zap className="h-4 w-4 text-amber-400" />,
      text: 'Auto-sync templates instantly',
    },
    {
      icon: <Lock className="h-4 w-4 text-sky-400" />,
      text: 'Enterprise domain restriction active',
    },
    {
      icon: <Bot className="h-4 w-4 text-violet-400" />,
      text: 'AI workspace automation ready',
    },
    {
      icon: <Users className="h-4 w-4 text-emerald-400" />,
      text: 'Collaborative team workspaces',
    },
    {
      icon: <Shield className="h-4 w-4 text-rose-400" />,
      text: 'SOC2 & GDPR compliant',
    },
  ];

  return (
    <div className={`mesh-gradient relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-foreground shadow-card ${className}`}>
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />

      <h2 className="relative text-lg font-bold tracking-tight">What is SprintForge Workspace?</h2>
      <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
        A powerful collaborative platform designed for modern teams to manage projects,
        track progress, and automate workflows with enterprise-grade security.
      </p>

      <div className="relative mt-5 space-y-3">
        <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Key Features
        </h3>
        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature.text} className="flex items-center gap-3 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60">
                {feature.icon}
              </span>
              <span className="text-foreground/90">{feature.text}</span>
              <CheckCircle className="ml-auto h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-6 border-t border-border pt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Trusted by enterprise teams worldwide</span>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
            <span>All systems operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}
