import { ManagementScreen } from "@/features/management/components/management-screen";
import { ToolGate } from "@/components/layout/tool-gate";

export default function ManagementPage() {
  return (
    <ToolGate tool="management">
      <ManagementScreen />
    </ToolGate>
  );
}
