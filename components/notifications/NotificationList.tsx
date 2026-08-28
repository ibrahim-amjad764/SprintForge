// components/notifications/NotificationList.tsx

export default function NotificationList({
  notifications,
}: {
  notifications: any[];
}) {
  return (
    <div>
      {notifications.map((item) => (
        <div
          key={item._id}

          className="border p-3"
        >
          <h3 className="font-bold">{item.title}</h3>

          <p>{item.message}</p>
        </div>
      ))}
    </div>
  );
}
