export interface HouseholdSummary {
  id: string;
  name: string;
  memberCount: number;
}

export class HouseholdsService {
  // Placeholder for repository-backed implementation (Postgres + Drizzle or Prisma).
  listForUser(userId: string): HouseholdSummary[] {
    return [
      {
        id: `demo-${userId}`,
        name: 'Default Household',
        memberCount: 1,
      },
    ];
  }
}
