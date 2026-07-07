"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import type { User, Campaign, Goal } from "@/types/domain";

/** Live users, sellers, campaigns and goals for the Gestão screen. */
export function useManagement() {
  const users = useLiveQuery<User[]>(() => db.users.toArray(), []);
  const campaigns = useLiveQuery<Campaign[]>(() => db.campaigns.toArray(), []);
  const goals = useLiveQuery<Goal[]>(() => db.goals.toArray(), []);

  const list = users ?? [];
  return {
    users: [...list].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    sellers: list
      .filter((u) => u.role === "vendedora" && u.active)
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    campaigns: (campaigns ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    goals: goals ?? [],
    loading: users === undefined,
  };
}
