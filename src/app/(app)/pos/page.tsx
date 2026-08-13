import { POSScreen } from "@/features/pos/components/pos-screen";
import { ToolGate } from "@/components/layout/tool-gate";

export default function POSPage() {
  return (
    <ToolGate tool="pos">
      <POSScreen />
    </ToolGate>
  );
}
