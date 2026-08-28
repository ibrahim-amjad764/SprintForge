// services/plan.service.ts
export function canCreateProject(plan: string) {
  if (plan === 'FREE') {
    return false;
  }

  return true;
}
