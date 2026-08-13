import { CustomersScreen } from "@/features/customers/components/customers-screen";
import { ToolGate } from "@/components/layout/tool-gate";

export default function CustomersPage() {
  return (
    <ToolGate tool="customers">
      <CustomersScreen />
    </ToolGate>
  );
}
