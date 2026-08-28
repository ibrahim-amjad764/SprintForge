import Team from "@/models/Team";

/*
 Team Database Operations

 Keeps API routes clean.

*/

export async function createTeam(data: {
  name: string;
  description?: string;
  workspace: string;
}) {
  return Team.create({
    name: data.name,

    description: data.description,

    workspace: data.workspace,
  });
}

export async function getTeams(workspace: string) {
  return Team.find({
    workspace,
  });
}

export async function updateTeam(
  id: string,

  data: any,
) {
  return Team.findByIdAndUpdate(
    id,

    data,

    {
      new: true,
    },
  );
}

export async function deleteTeam(id: string) {
  return Team.findByIdAndDelete(id);
}
