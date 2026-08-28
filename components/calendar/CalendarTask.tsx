// components/calendar/CalendarTask.tsx

export default function CalendarTask({ title }: { title: string }) {
  return (
    <div className="rounded bg-blue-500 p-1 text-sm text-white">{title}</div>
  );
}
