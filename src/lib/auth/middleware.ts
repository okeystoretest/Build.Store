import { NextResponse, type NextRequest } from "next/server";

/**
 * Proteção de rotas no Edge (sem banco). O middleware roda no Edge Runtime, que
 * NÃO suporta pg/argon2/Lucia — então aqui fazemos só a checagem leve de
 * PRESENÇA do cookie de sessão. A validação real (sessão existe e não expirou)
 * acontece nos Server Components / Actions via getCurrentSession().
 *
 * App online-only: sem cookie de sessão, vai para /login; com cookie na tela de
 * login, vai para o PDV. Uma sessão inválida/expirada mas com cookie presente é
 * pega no server e resulta em logout/redirect.
 *
 * O nome do cookie de sessão do Lucia é "auth_session" por padrão.
 */
const SESSION_COOKIE = "auth_session";

export function authRouteGuard(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/pos";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
