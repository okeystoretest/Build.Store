import { InventoryScreen } from "@/features/inventory/components/inventory-screen";
import { ToolGate } from "@/components/layout/tool-gate";

export default function InventoryPage() {
  return (
    <ToolGate tool="inventory">
      <InventoryScreen />
    </ToolGate>
  );
}
