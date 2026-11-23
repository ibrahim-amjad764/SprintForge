import type { CSSProperties } from 'react';
import { Quote } from 'lucide-react';

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

const avatarTones = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-blue-600',
];

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Customers
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Teams that ship with SprintForge
        </h2>
      </div>

      <div className="stagger mt-14 grid gap-5 md:grid-cols-3">
        {testimonials.map((testimonial, i) => (
          <figure
            key={testimonial.name}
            style={{ '--i': i } as CSSProperties}
            className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-popover"
          >
            <Quote className="h-5 w-5 text-primary/50" aria-hidden="true" />
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground/90">
              &ldquo;{testimonial.text}&rdquo;
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${avatarTones[i]} text-xs font-bold text-white`}
                aria-hidden="true"
              >
                {testimonial.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{testimonial.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {testimonial.role}, {testimonial.company}
                </p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
