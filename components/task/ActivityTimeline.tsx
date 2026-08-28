// components/task/ActivityTimeline.tsx
export default function ActivityTimeline({
  activities,
}: {
  activities: any[];
}) {
  return (
    <div>
      <h2 className="mb-4 font-bold">Activity</h2>

      {activities.map((activity) => (
        <div key={activity._id} className="border-b py-3">
          {' '}
          <p>{activity.message}</p>
        </div>
      ))}
    </div>
  );
}
