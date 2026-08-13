import { StoresScreen } from "@/features/stores/components/stores-screen";
import { ToolGate } from "@/components/layout/tool-gate";

export default function StoresPage() {
  return (
    <ToolGate tool="stores">
      <StoresScreen />
    </ToolGate>
  );
}
