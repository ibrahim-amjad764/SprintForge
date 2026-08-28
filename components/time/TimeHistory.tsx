// components/time/TimeHistory.tsx

export default function TimeHistory({ entries }: { entries: any[] }) {
  return (
    <div>
      <h2 className="font-bold">Time History</h2>

      {entries.map((entry) => (
        <div
          key={entry._id}

          className="border-b py-2"
        >
          Duration:
          {Math.floor(entry.duration / 60)}
          minutes
        </div>
      ))}
    </div>
  );
}
