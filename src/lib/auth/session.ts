import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { lucia } from "@/lib/auth/lucia";
import type { Session, User } from "lucia";

/**
 * Resolve a sessão atual a partir do cookie (Server Components / Actions).
 * `cache` garante uma validação por request. Renova/limpa o cookie conforme o
 * estado da sessão Lucia.
 */
export const getCurrentSession = cache(
  async (): Promise<
    { user: User; session: Session } | { user: null; session: null }
  > => {
    const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? null;
    if (!sessionId) return { user: null, session: null };

    const result = await lucia.validateSession(sessionId);
    try {
      if (result.session && result.session.fresh) {
        const cookie = lucia.createSessionCookie(result.session.id);
        cookies().set(cookie.name, cookie.value, cookie.attributes);
      }
      if (!result.session) {
        const cookie = lucia.createBlankSessionCookie();
        cookies().set(cookie.name, cookie.value, cookie.attributes);
      }
    } catch {
      // set() lança fora de Server Action/Route Handler — o middleware cobre.
    }
    return result;
  },
);
