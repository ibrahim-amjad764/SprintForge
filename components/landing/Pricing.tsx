// components/landing/Pricing.tsx
import Link from 'next/link';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      '1 Workspace',
      'Up to 5 team members',
      'Basic Kanban boards',
      'Task management',
      'Email support',
    ],
    cta: 'Get Started',
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
    cta: 'Get Pro Plan',
    popular: true,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-16 bg-gray-50">
      <h2 className="mb-4 text-center text-3xl font-bold">Simple Pricing</h2>
      <p className="mb-12 text-center text-gray-600">Start free, upgrade when you need more</p>
      <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-lg border p-8 ${
              plan.popular 
                ? 'border-black shadow-xl transform scale-105' 
                : 'border-gray-200 bg-white'
            }`}
          >
            {plan.popular && (
              <div className="mb-4 inline-block rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                MOST POPULAR
              </div>
            )}
            <h3 className="mb-2 text-2xl font-bold">{plan.name}</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold">{plan.price}</span>
              <span className="text-gray-600">{plan.period}</span>
            </div>
            <ul className="mb-8 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className={`block w-full rounded-lg py-3 font-semibold text-center transition-colors ${
                plan.popular
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'border border-black text-black hover:bg-gray-100'
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
