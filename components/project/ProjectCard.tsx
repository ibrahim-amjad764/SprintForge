import Link from 'next/link';

interface Props {
  workspaceId: string;
  projectId: string;
  name: string;
  status: string;
  progress: number;
}

export default function ProjectCard({
  workspaceId,
  projectId,
  name,
  status,
  progress,
}: Props) {
  const base = `/workspace/${workspaceId}/projects/${projectId}`;

  return (
    <div className="rounded-lg border p-5">
      <h2 className="text-xl font-bold">{name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Status: {status}</p>
      <p className="text-sm text-muted-foreground">Progress: {progress ?? 0}%</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`${base}/board`}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Board
        </Link>
        <Link
          href={`${base}/tasks`}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Tasks
        </Link>
        <Link
          href={`${base}/calendar`}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Calendar
        </Link>
      </div>
    </div>
  );
}
