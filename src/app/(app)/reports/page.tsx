import { AnalyticsScreen } from "@/features/analytics/components/analytics-screen";
import { ToolGate } from "@/components/layout/tool-gate";

export default function ReportsPage() {
  return (
    <ToolGate tool="reports">
      <AnalyticsScreen />
    </ToolGate>
  );
}
