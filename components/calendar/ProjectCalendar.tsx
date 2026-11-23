// components/calendar/ProjectCalendar.tsx

'use client';

import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function ProjectCalendar({ tasks }: { tasks: any[] }) {
  const events = tasks.map((task) => ({
    title: task.title,
    start: new Date(task.dueDate),
    end: new Date(task.dueDate),
  }));

  return (
    <div className="rounded bg-card p-5">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{
          height: 700,
        }}
      />
    </div>
  );
}
