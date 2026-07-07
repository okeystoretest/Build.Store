"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import type { User, Campaign } from "@/types/domain";

/**
 * Live sellers + active campaigns for the checkout meta selectors. Reads Dexie
 * directly via live queries so newly created sellers/campaigns (Gestão, Fase D)
 * appear in the PDV without a refresh.
 */
export function useSaleMeta() {
  const sellers = useLiveQuery<User[]>(
    () => db.users.where("role").equals("vendedora").toArray(),
    [],
  );

  const campaigns = useLiveQuery<Campaign[]>(
    () => db.campaigns.toArray(),
    [],
  );

  return {
    sellers: (sellers ?? [])
      .filter((s) => s.active)
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    campaigns: (campaigns ?? [])
      .filter((c) => c.active)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
