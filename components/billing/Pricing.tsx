// components/billing/Pricing.tsx
'use client';

const plans = [
  {
    name: 'Free',

    price: '0',
  },

  {
    name: 'Pro',

    price: '20',
  },

  {
    name: 'Team',

    price: '50',
  },
];

export default function Pricing() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {plans.map((plan) => (
        <div
          key={plan.name}

          className="rounded border p-5"
        >
          <h2 className="font-bold">{plan.name}</h2>

          <p>${plan.price}/month</p>

          <button className="mt-3 rounded bg-black px-4 py-2 text-white">
            Choose
          </button>
        </div>
      ))}
    </div>
  );
}
