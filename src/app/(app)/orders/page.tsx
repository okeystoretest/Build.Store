import { OrdersScreen } from "@/features/orders/components/orders-screen";
import { ToolGate } from "@/components/layout/tool-gate";

export default function OrdersPage() {
  return (
    <ToolGate tool="orders">
      <OrdersScreen />
    </ToolGate>
  );
}
