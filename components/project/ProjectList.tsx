import ProjectCard from './ProjectCard';

interface Props {
  workspaceId: string;
  projects: Array<{
    _id: string;
    name: string;
    status: string;
    progress?: number;
  }>;
}

export default function ProjectList({ workspaceId, projects }: Props) {
  if (projects.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        No projects yet. Create your first project above.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-5">
      {projects.map((project) => (
        <ProjectCard
          key={project._id}
          workspaceId={workspaceId}
          projectId={project._id}
          name={project.name}
          status={project.status}
          progress={project.progress ?? 0}
        />
      ))}
    </div>
  );
}
