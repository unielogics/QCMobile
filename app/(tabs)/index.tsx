import { useExperienceMode } from "@/hooks/useExperienceMode";
import { GuidedHome } from "@/screens/home/GuidedHome";
import { SelfDirectedHome } from "@/screens/home/SelfDirectedHome";

export default function HomeRoute() {
  const mode = useExperienceMode();
  return mode === "guided" ? <GuidedHome /> : <SelfDirectedHome />;
}
