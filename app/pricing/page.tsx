import { Suspense } from 'react';
import Pricing from '@/components/billing/Pricing';
import BillingDashboard from '@/components/billing/BillingDashboard';

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16 sm:py-20">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Pricing
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Start free and scale as your team grows. Upgrade or cancel anytime.
        </p>
      </div>
      <BillingDashboard />
      <Suspense
        fallback={
          <div className="grid gap-5 md:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer h-80 rounded-2xl border border-border bg-card" />
            ))}
          </div>
        }
      >
        <Pricing />
      </Suspense>
    </div>
  );
}
