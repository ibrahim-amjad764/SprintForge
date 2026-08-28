// components/landing/Testimonials.tsx

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'Product Manager',
    company: 'TechCorp',
    text: 'SprintForge transformed how our team manages projects. The real-time collaboration features are incredible!',
  },
  {
    name: 'Michael Chen',
    role: 'Software Engineer',
    company: 'StartupXYZ',
    text: 'The Kanban boards and sprint analytics helped us ship features 40% faster. Highly recommended!',
  },
  {
    name: 'Emily Rodriguez',
    role: 'Team Lead',
    company: 'DigitalAgency',
    text: 'Simple, powerful, and exactly what we needed for our agile workflow. Best decision we made.',
  },
];

export default function Testimonials() {
  return (
    <section className="py-16">
      <h2 className="mb-12 text-center text-3xl font-bold">What Our Users Say</h2>
      <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto px-6">
        {testimonials.map((testimonial) => (
          <div key={testimonial.name} className="rounded border p-6 bg-white shadow-sm">
            <p className="mb-4 text-gray-700 italic">"{testimonial.text}"</p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                {testimonial.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{testimonial.name}</p>
                <p className="text-sm text-gray-500">{testimonial.role}, {testimonial.company}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
