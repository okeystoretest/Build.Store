import { DashboardScreen } from "@/features/dashboard/components/dashboard-screen";
import { ToolGate } from "@/components/layout/tool-gate";

export default function DashboardPage() {
  return (
    <ToolGate tool="dashboard">
      <DashboardScreen />
    </ToolGate>
  );
}
