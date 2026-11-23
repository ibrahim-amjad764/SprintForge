import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      '1 workspace',
      'Up to 5 team members',
      'Basic Kanban boards',
      'Task management',
      'Email support',
    ],
    cta: 'Get started',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    features: [
      'Unlimited workspaces',
      'Unlimited team members',
      'Advanced Kanban boards',
      'Sprint analytics',
      'Real-time collaboration',
      'Priority support',
      'AI-powered suggestions',
      'Custom workflows',
    ],
    cta: 'Get Pro plan',
    popular: true,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="border-t border-border/60 bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free, upgrade when you need more. Cancel anytime.
          </p>
        </div>

        <div className="stagger mx-auto mt-14 grid max-w-3xl gap-6 md:grid-cols-2">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              style={{ '--i': i } as CSSProperties}
              className={`relative rounded-2xl border p-8 transition-all duration-200 ${
                plan.popular
                  ? 'border-primary/40 bg-card shadow-glow md:-translate-y-2'
                  : 'border-border bg-card shadow-card hover:-translate-y-0.5 hover:shadow-popover'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-glow">
                  Most popular
                </span>
              )}

              <h3 className="font-semibold tracking-tight">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-4xl font-bold tracking-tight">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="mt-7 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${plan.popular ? 'text-primary' : 'text-success'}`}
                      aria-hidden="true"
                    />
                    <span className="text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`mt-8 block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                  plan.popular
                    ? 'btn-sheen bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-glow hover:brightness-110'
                    : 'border border-border bg-card text-foreground shadow-card hover:bg-muted'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
