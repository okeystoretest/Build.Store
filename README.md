# Build.Store

PDV premium para lojas boutique. Next.js (App Router) + Supabase + PWA offline.

## Stack
Next.js 14 · TypeScript · Tailwind (tokens Serene Commerce) · TanStack Query ·
React Hook Form + Zod · Dexie (offline) · Serwist (PWA) · Supabase · Recharts ·
Lucide · date-fns.

## Setup
```bash
npm install
cp .env.example .env.local   # preencha as chaves do Supabase
npm run dev
```
Aplique o schema em `supabase/schema.sql` no seu projeto Supabase.

## Arquitetura
```
src/
  app/            # rotas (App Router) — grupo (app) com sidebar
  components/
    ui/           # primitivos do design system (Button, Card, Input, Badge)
    layout/       # Sidebar
  features/       # código por domínio: pos, inventory, analytics, orders, customers
  lib/
    supabase/     # clients browser + server
    db/           # Dexie (offline) + seed
    sync/         # motor de sincronização (fila offline)
    utils/        # money (centavos), cart (cálculos puros), cn
  types/          # modelo de domínio compartilhado
supabase/schema.sql  # Postgres + RLS + trigger de estoque
```

## Convenções
- Dinheiro trafega em centavos (inteiros); formatação BRL só na borda.
- Cálculos de carrinho são funções puras em `lib/utils/cart.ts`.
- Cada feature isola components/hooks/types.
- **Componentes:** primitivos próprios sobre os tokens (Button/Card/Input/Badge),
  não shadcn/ui. Decisão de engenharia: o shadcn assume tokens HSL próprios
  (`--background`, `--primary`); mantê-los sobre o design system Material-style
  em hex criaria duas fontes de verdade. Os primitivos seguem a mesma ergonomia
  (CVA, forwardRef, cn), então a troca futura é local.

## Persistência & Sync (Fase 3)

Dexie é a **fonte da verdade local** (offline-first real). Features falam com
repositórios (`lib/db/*-repository.ts`), nunca com o Dexie ou a rede direto.

- `recordSale` grava pedido + baixa de estoque + movimentações numa única
  transação Dexie — impossível ficar com estoque e venda dessincronizados.
- Pedidos nascem com `syncStatus="pending"`; o motor de sync (`lib/sync`) faz
  flush via um `SyncTransport`.
- `SyncTransport` é a costura para o backend. Hoje roda `NullTransport`
  (local-only). Na Fase 5, `SupabaseTransport` entra com a mesma interface —
  trocar o backend mexe só nessa ligação, nunca numa feature.
- `useLiveProducts` (Dexie live query) faz o grid de estoque e o PDV reagirem
  a mudanças de estoque na hora, sem refetch manual.

## Roadmap
- **Fase 0 — Fundação** ✅
- **Fase 1 — PDV + Carrinho** ✅
- **Fase 2 — Estoque + Produtos** ✅
- **Fase 3 — Offline PWA + Sync** ✅
- **Fase 4 — Analytics + Pedidos** ✅ (esta entrega)
- **Fase 5 — Auth + Sync Fabricante + Deploy** ✅ (esta entrega)

## Deploy
Ver `DEPLOY.md` — guia passo a passo de Supabase + Vercel. O app roda
offline-local sem credenciais e ativa login/RLS/sync automaticamente quando as
variáveis do Supabase estão presentes (nenhuma mudança de código necessária).
