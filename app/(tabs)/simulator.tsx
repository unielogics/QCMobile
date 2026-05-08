import { useExperienceMode } from "@/hooks/useExperienceMode";
import { MyDealScreen } from "@/screens/simulator/MyDealScreen";
import { SelfDirectedSimulatorScreen } from "@/screens/simulator/SimulatorScreen";

export default function SimulatorRoute() {
  const mode = useExperienceMode();
  return mode === "guided" ? <MyDealScreen /> : <SelfDirectedSimulatorScreen />;
}
