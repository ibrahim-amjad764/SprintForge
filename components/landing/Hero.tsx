import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, CheckCircle2, Circle, Clock, Zap } from 'lucide-react';
import AnimatedStat from './AnimatedStat';

const stats = [
  { value: 40, suffix: '%', label: 'faster sprint delivery', decimals: 0 },
  { value: 12, suffix: 'k+', label: 'tasks shipped weekly', decimals: 0 },
  { value: 99.9, suffix: '%', label: 'uptime SLA', decimals: 1 },
];

const previewTasks = [
  { title: 'Ship checkout revamp', tag: 'In Progress', tone: 'bg-primary/15 text-primary', dot: 'bg-primary' },
  { title: 'Fix auth token rotation', tag: 'Review', tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  { title: 'Dashboard KPI cards', tag: 'Done', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Depth stack: dot-grid texture → mesh → ambient glow */}
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="mesh-gradient pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[50rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{ background: 'var(--glow-primary)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-48 -right-40 h-[26rem] w-[26rem] rounded-full opacity-40 blur-3xl"
        style={{ background: 'var(--glow-accent)' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-24 text-center sm:pt-32">
        {/* Choreographed entrance — badge → headline → subtext → CTAs → stats */}
        <div style={{ '--i': 0 } as CSSProperties} className="animate-enter">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary shadow-card">
            <Zap className="h-3 w-3" aria-hidden="true" />
            Now with AI-powered task suggestions
          </span>
        </div>

        <h1
          style={{ '--i': 1 } as CSSProperties}
          className="animate-enter mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl"
        >
          Build better software
          <br />
          <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
            teams, together.
          </span>
        </h1>

        <p
          style={{ '--i': 2 } as CSSProperties}
          className="animate-enter mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          SprintForge is the all-in-one workspace for agile teams — plan
          sprints, track tasks, and ship faster with real-time collaboration.
        </p>

        <div
          style={{ '--i': 3 } as CSSProperties}
          className="animate-enter mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/register"
            className="btn-sheen group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-glow"
          >
            Start building free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            href="/login"
            className="btn-sheen inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-card hover:bg-muted"
          >
            Sign in
          </Link>
        </div>

        {/* Stats strip — hairline-separated, counts up on scroll */}
        <div
          style={{ '--i': 4 } as CSSProperties}
          className="animate-enter mx-auto mt-16 flex max-w-2xl items-stretch divide-x divide-border/70"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="flex-1 px-4 text-center first:pl-0 last:pr-0">
              <AnimatedStat value={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Product preview — mini-UI with glass chrome, task pills, hover glow */}
        <div style={{ '--i': 5 } as CSSProperties} className="animate-enter mx-auto mt-16 max-w-4xl">
          <div className="group relative rounded-2xl border border-border/80 bg-card/70 p-1.5 shadow-popover backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-glow">
            {/* Window chrome */}
            <div className="flex items-center gap-1.5 px-3 pt-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
              <span className="ml-3 rounded-md border border-border/60 bg-muted/50 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                sprintforge.app/workspace/acme
              </span>
            </div>

            <div className="mt-3 grid gap-3 p-3 sm:grid-cols-[180px_1fr]">
              {/* Sidebar rail */}
              <div className="hidden flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-3 sm:flex">
                {['Board', 'List', 'Calendar', 'Analytics'].map((item, i) => (
                  <div
                    key={item}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                      i === 0 ? 'bg-primary/15 font-medium text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                    {item}
                  </div>
                ))}
              </div>

              {/* Task list */}
              <div className="space-y-2">
                {previewTasks.map((task) => (
                  <div
                    key={task.title}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3.5 py-2.5 transition-colors hover:border-primary/25 hover:bg-muted/40"
                  >
                    <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium sm:text-sm">{task.title}</span>
                    <span className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${task.tone}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${task.dot}`} />
                      {task.tag}
                    </span>
                  </div>
                ))}
                {/* Mini stat chips */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                    12 done
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3 text-amber-500" aria-hidden="true" />
                    3 due Friday
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                    <Zap className="h-3 w-3 text-primary" aria-hidden="true" />
                    AI: 4 suggestions
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
