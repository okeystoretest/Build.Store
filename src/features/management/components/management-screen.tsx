"use client";

import { useState } from "react";
import { UserPlus, Megaphone, Target } from "lucide-react";
import { useManagement } from "@/features/management/hooks/use-management";
import { UserForm, ROLE_LABELS } from "./user-form";
import { CampaignForm } from "./campaign-form";
import { GoalForm } from "./goal-form";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils/money";

type Tool = "users" | "campaigns" | "goals";

/**
 * Gestão screen — three management tools: user registration, campaign creation
 * and goal definition. Each is paired with a live list of what already exists.
 * Access is gated to lojista/admin at the sidebar + route level.
 */
export function ManagementScreen() {
  const m = useManagement();
  const [tool, setTool] = useState<Tool>("users");

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-md border-b border-outline-variant/50 px-margin py-md">
        <h1 className="text-headline-lg text-primary">Gestão</h1>
        <div className="ml-auto">
          <ToggleGroup
            aria-label="Ferramenta de gestão"
            value={tool}
            onChange={setTool}
            options={[
              { value: "users", label: "Usuários", icon: <UserPlus className="h-4 w-4" strokeWidth={1.75} /> },
              { value: "campaigns", label: "Campanhas", icon: <Megaphone className="h-4 w-4" strokeWidth={1.75} /> },
              { value: "goals", label: "Metas", icon: <Target className="h-4 w-4" strokeWidth={1.75} /> },
            ]}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-margin py-md">
        <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(360px,440px)_1fr]">
          {/* Form column */}
          <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
            {tool === "users" && (
              <>
                <h2 className="mb-md text-headline-md text-on-surface">
                  Cadastrar usuário
                </h2>
                <UserForm onCreated={() => {}} />
              </>
            )}
            {tool === "campaigns" && (
              <>
                <h2 className="mb-md text-headline-md text-on-surface">
                  Criar campanha
                </h2>
                <CampaignForm onCreated={() => {}} />
              </>
            )}
            {tool === "goals" && (
              <>
                <h2 className="mb-md text-headline-md text-on-surface">
                  Definir meta
                </h2>
                <GoalForm
                  sellers={m.sellers}
                  campaigns={m.campaigns}
                  onCreated={() => {}}
                />
              </>
            )}
          </div>

          {/* List column */}
          <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
            {tool === "users" && <UsersList users={m.users} />}
            {tool === "campaigns" && <CampaignsList campaigns={m.campaigns} />}
            {tool === "goals" && (
              <GoalsList
                goals={m.goals}
                sellers={m.sellers}
                campaigns={m.campaigns}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersList({ users }: { users: ReturnType<typeof useManagement>["users"] }) {
  return (
    <>
      <h3 className="mb-md text-headline-md text-on-surface">Usuários</h3>
      {users.length === 0 ? (
        <Empty text="Nenhum usuário cadastrado." />
      ) : (
        <ul className="space-y-sm">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-md bg-surface-container-low px-md py-sm"
            >
              <span className="text-body-md text-on-surface">{u.fullName}</span>
              <Badge tone={u.role === "admin" ? "primary" : "neutral"}>
                {ROLE_LABELS[u.role]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CampaignsList({
  campaigns,
}: {
  campaigns: ReturnType<typeof useManagement>["campaigns"];
}) {
  return (
    <>
      <h3 className="mb-md text-headline-md text-on-surface">Campanhas</h3>
      {campaigns.length === 0 ? (
        <Empty text="Nenhuma campanha criada." />
      ) : (
        <ul className="space-y-sm">
          {campaigns.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md bg-surface-container-low px-md py-sm"
            >
              <span className="text-body-md text-on-surface">{c.name}</span>
              <Badge tone={c.active ? "success" : "neutral"}>
                {c.active ? "Ativa" : "Inativa"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function GoalsList({
  goals,
  sellers,
  campaigns,
}: {
  goals: ReturnType<typeof useManagement>["goals"];
  sellers: ReturnType<typeof useManagement>["sellers"];
  campaigns: ReturnType<typeof useManagement>["campaigns"];
}) {
  const sellerName = (id: string) =>
    sellers.find((s) => s.id === id)?.fullName ?? "—";
  const campaignName = (id: string | null) =>
    campaigns.find((c) => c.id === id)?.name ?? "—";

  return (
    <>
      <h3 className="mb-md text-headline-md text-on-surface">Metas definidas</h3>
      {goals.length === 0 ? (
        <Empty text="Nenhuma meta definida." />
      ) : (
        <ul className="space-y-sm">
          {goals.map((g) => (
            <li
              key={g.id}
              className="rounded-md bg-surface-container-low px-md py-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-body-md font-medium text-on-surface">
                  {sellerName(g.sellerId)}
                </span>
                <Badge tone={g.type === "general" ? "primary" : "neutral"}>
                  {g.type === "general" ? "Geral" : "Campanha"}
                </Badge>
              </div>
              <p className="mt-1 text-label-md text-on-surface-variant">
                {g.type === "general"
                  ? `Meta: ${formatBRL(g.targetCents ?? 0)}`
                  : `${campaignName(g.campaignId)} · ${g.targetQuantity ?? 0} itens`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-body-md text-on-surface-variant">{text}</p>;
}
