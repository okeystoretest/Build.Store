import { AppShell } from "@/components/layout/app-shell";

/**
 * Shell das telas autenticadas: layout responsivo (sidebar retrátil no desktop,
 * drawer no mobile). A proteção de rota é feita pelo middleware.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
