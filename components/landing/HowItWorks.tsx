import type { CSSProperties } from 'react';
import { UserPlus, Rocket, FolderKanban } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    title: 'Create account',
    description: 'Sign up in seconds and spin up your first workspace.',
  },
  {
    icon: FolderKanban,
    title: 'Invite your team',
    description: 'Add members with role-based access and start collaborating instantly.',
  },
  {
    icon: Rocket,
    title: 'Run your sprint',
    description: 'Create projects, assign tasks, and track progress in real time.',
  },
];

export default function HowItWorks() {
  return (
    <section className="border-y border-border/60 bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Up and running in minutes
          </h2>
        </div>

        <div className="stagger relative mx-auto mt-14 grid max-w-4xl gap-10 md:grid-cols-3 md:gap-6">
          {steps.map((step, i) => (
            <div key={step.title} style={{ '--i': i } as CSSProperties} className="relative text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-card">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 font-mono text-xs font-medium text-muted-foreground">
                STEP {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-1.5 font-semibold tracking-tight">{step.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
