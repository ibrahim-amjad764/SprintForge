// components/landing/HowItWorks.tsx

const steps = [
  {
    number: '1',
    title: 'Create Account',
    description: 'Sign up in seconds and set up your first workspace.',
  },
  {
    number: '2',
    title: 'Invite Team',
    description: 'Add your team members and start collaborating instantly.',
  },
  {
    number: '3',
    title: 'Start Sprints',
    description: 'Create projects, assign tasks, and track progress in real-time.',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-16 bg-gray-50">
      <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
      <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
        {steps.map((step) => (
          <div key={step.number} className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-black text-white text-2xl font-bold">
              {step.number}
            </div>
            <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
            <p className="text-gray-600">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
