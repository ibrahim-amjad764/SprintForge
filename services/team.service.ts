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

interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/*
 * Deterministic createdAt-desc ordering for stable offset pages.
 * `search` filters team names server-side so pagination stays
 * correct when the UI search box is active.
 */
export async function getTeamsPaginated(
  workspace: string,
  pagination: PaginationInput,
  search?: string,
): Promise<PaginatedResult<unknown>> {
  const { page, limit, skip } = pagination;

  const filter: Record<string, unknown> = { workspace };
  if (search && search.trim()) {
    filter.name = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    Team.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Team.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
  };
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
