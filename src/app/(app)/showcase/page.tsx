import { ShowcaseScreen } from "@/features/showcase/components/showcase-screen";
import { ToolGate } from "@/components/layout/tool-gate";

export default function ShowcasePage() {
  return (
    <ToolGate tool="showcase">
      <ShowcaseScreen />
    </ToolGate>
  );
}
