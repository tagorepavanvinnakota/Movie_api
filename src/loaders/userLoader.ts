import DataLoader from "dataloader";
import { prisma } from "../config/db-adapter";

/**
 * Batch function to load users by their IDs in a single DB query.
 * This solves the N+1 problem for user lookups in GraphQL resolvers.
 */
export const createUserLoader = () =>
  new DataLoader<string, {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null>(async (userIds: any) => {
    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    });

    // Map users by ID for quick lookup
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Return results in the same order as requested IDs
    return userIds.map((id: any) => userMap.get(id) ?? null);
  });
