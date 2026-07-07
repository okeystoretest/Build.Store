import type { User, Campaign, Goal } from "@/types/domain";

/**
 * Management seed — a few sellers, campaigns and goals so Gestão and Dashboard
 * have content on first run. Real records created in the UI behave identically.
 */

export const SEED_USERS: User[] = [
  {
    id: "u-elena",
    fullName: "Elena Rossi",
    birthDate: "1990-04-12",
    role: "vendedora",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-carla",
    fullName: "Carla Mendes",
    birthDate: "1994-09-03",
    role: "vendedora",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-lojista",
    fullName: "Beatriz (Lojista)",
    birthDate: "1985-01-20",
    role: "lojista",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-admin",
    fullName: "Administrador",
    birthDate: null,
    role: "admin",
    active: true,
    createdAt: new Date().toISOString(),
  },
];

export const SEED_CAMPAIGNS: Campaign[] = [
  { id: "c-natal", name: "Natal 2026", active: true, createdAt: new Date().toISOString() },
  { id: "c-verao", name: "Coleção Verão", active: true, createdAt: new Date().toISOString() },
];

export const SEED_GOALS: Goal[] = [
  {
    id: "g-elena-general",
    sellerId: "u-elena",
    type: "general",
    campaignId: null,
    targetCents: 500000, // R$ 5.000,00
    targetQuantity: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "g-elena-natal",
    sellerId: "u-elena",
    type: "campaign",
    campaignId: "c-natal",
    targetCents: null,
    targetQuantity: 50,
    createdAt: new Date().toISOString(),
  },
  {
    id: "g-carla-general",
    sellerId: "u-carla",
    type: "general",
    campaignId: null,
    targetCents: 300000, // R$ 3.000,00
    targetQuantity: null,
    createdAt: new Date().toISOString(),
  },
];
