// components/task/TaskFilters.tsx

'use client';

export default function TaskFilters({
  onFilter,
}: {
  onFilter: (data: any) => void;
}) {
  return (
    <div className="flex gap-3">
      <select
        className="border p-2"
        onChange={(e) =>
          onFilter({
            status: e.target.value,
          })
        }
      >
        <option value="">Status</option>

        <option>TODO</option>

        <option>IN_PROGRESS</option>

        <option>REVIEW</option>

        <option>COMPLETED</option>
      </select>

      <select
        className="border p-2"
        onChange={(e) =>
          onFilter({
            priority: e.target.value,
          })
        }
      >
        <option value="">Priority</option>

        <option>LOW</option>

        <option>MEDIUM</option>

        <option>HIGH</option>

        <option>URGENT</option>
      </select>
    </div>
  );
}