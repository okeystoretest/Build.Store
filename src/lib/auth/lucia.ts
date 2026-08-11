import "server-only";
import { Lucia } from "lucia";
import { NodePostgresAdapter } from "@lucia-auth/adapter-postgresql";
import { Pool } from "pg";
import type { Role } from "@/types/domain";

/**
 * Auth própria com Lucia (substitui o Supabase Auth). Sessões e usuários vivem
 * no seu Postgres:
 *   - tabela `sessions` (id, user_id, expires_at)
 *   - tabela `profiles` como "users" (id + atributos)
 *
 * O adaptador usa um Pool próprio (Lucia gerencia suas queries de sessão).
 */

declare global {
  // eslint-disable-next-line no-var
  var __luciaPool: Pool | undefined;
}

function luciaPool(): Pool {
  if (!global.__luciaPool) {
    global.__luciaPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return global.__luciaPool;
}

const adapter = new NodePostgresAdapter(luciaPool(), {
  user: "profiles",
  session: "sessions",
});

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      // Em produção (VPS com HTTPS), o cookie é secure.
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attrs) => ({
    username: attrs.username,
    fullName: attrs.full_name,
    role: attrs.role,
    photoUrl: attrs.photo_url,
    storeId: attrs.store_id,
    active: attrs.active,
  }),
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      username: string;
      full_name: string | null;
      role: Role;
      photo_url: string | null;
      store_id: string | null;
      active: boolean;
    };
  }
}
