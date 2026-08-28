// components/landing/Features.tsx

const features = [
  {
    title: 'Visual Kanban Boards',
    description: 'Drag and drop your tasks across customized workflows to keep your team aligned.',
  },
  {
    title: 'Agile Project Tracking',
    description: 'Manage sprints, backlogs, and releases with powerful agile tools.',
  },
  {
    title: 'Realtime Team Chat',
    description: 'Collaborate instantly with your team through built-in messaging.',
  },
  {
    title: 'Advanced Sprint Analytics',
    description: 'Track progress with detailed insights and performance metrics.',
  },
  {
    title: 'AI-Powered Code Assistant',
    description: 'Get intelligent suggestions to accelerate your development workflow.',
  },
  {
    title: 'Instant Live Syncing',
    description: 'Stay updated with real-time synchronization across all devices.',
  },
];

export default function Features() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {features.map((feature) => (
        <div
          key={feature.title}
          className="rounded border p-5 hover:shadow-lg transition-shadow"
        >
          <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
          <p className="text-sm text-gray-600">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}
