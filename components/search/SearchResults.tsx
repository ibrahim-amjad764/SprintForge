// components/search/SearchResults.tsx

export default function SearchResults({ results }: { results: any }) {
  return (
    <div className="absolute z-50 mt-2 w-full rounded border bg-white p-4">
      <h3 className="font-bold">Tasks</h3>

      {results.tasks.map((task: any) => (
        <p key={task._id} className="py-1">
          {task.title}
        </p>
      ))}

      <h3 className="mt-3 font-bold">Projects</h3>

      {results.projects.map((project: any) => (
        <p key={project._id}>{project.name}</p>
      ))}

      <h3 className="mt-3 font-bold">Users</h3>

      {results.users.map((user: any) => (
        <p key={user._id}>{user.name}</p>
      ))}
    </div>
  );
}