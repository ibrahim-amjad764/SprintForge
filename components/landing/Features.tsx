import type { CSSProperties } from 'react';
import {
  BarChart3,
  CalendarDays,
  KanbanSquare,
  MessagesSquare,
  Sparkles,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: KanbanSquare,
    title: 'Visual Kanban boards',
    description: 'Drag tasks across customizable workflows so the whole team stays aligned.',
  },
  {
    icon: CalendarDays,
    title: 'Sprint planning',
    description: 'Plan sprints, manage backlogs, and ship releases with agile tools built in.',
  },
  {
    icon: MessagesSquare,
    title: 'Realtime collaboration',
    description: 'Chat, comment, and get live updates across every device instantly.',
  },
  {
    icon: BarChart3,
    title: 'Sprint analytics',
    description: 'Velocity, burndown, and delivery insights — not vanity metrics.',
  },
  {
    icon: Sparkles,
    title: 'AI task suggestions',
    description: 'Intelligent recommendations that accelerate your development workflow.',
  },
  {
    icon: Zap,
    title: 'Instant live sync',
    description: 'Changes propagate in real time so nobody ever works on stale data.',
  },
];

export default function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Capabilities
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Everything a sprint needs
        </h2>
        <p className="mt-4 text-muted-foreground">
          One workspace replaces the patchwork of tools your team juggles today.
        </p>
      </div>

      <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => (
          <div
            key={feature.title}
            style={{ '--i': i } as CSSProperties}
            className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-popover"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <feature.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-semibold tracking-tight">{feature.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
