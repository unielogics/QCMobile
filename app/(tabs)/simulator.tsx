import { useExperienceMode } from "@/hooks/useExperienceMode";
import { MyDealScreen } from "@/screens/simulator/MyDealScreen";
import { SelfDirectedSimulatorScreen } from "@/screens/simulator/SimulatorScreen";

export default function SimulatorRoute() {
  const mode = useExperienceMode();
  if (mode === "guided") return <MyDealScreen />;
  if (mode === "self_directed") return <SelfDirectedSimulatorScreen />;
  return null;
}
