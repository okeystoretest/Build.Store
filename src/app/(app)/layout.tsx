import { Sidebar } from "@/components/layout/sidebar";
import { LocalAuthGuard } from "@/components/layout/local-auth-guard";

/** Shell for authenticated app screens: fixed sidebar + scrollable workspace. */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocalAuthGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </LocalAuthGuard>
  );
}
