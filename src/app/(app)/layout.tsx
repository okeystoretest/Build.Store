import { Sidebar } from "@/components/layout/sidebar";

/**
 * Shell das telas autenticadas: sidebar fixa + área de trabalho rolável.
 * A proteção de rota é feita pelo middleware (sessão via cookie do Supabase),
 * então não há guarda de cliente aqui.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
