import { useMyClient } from "./useApi";
import { deriveExperienceMode, type EffectiveExperienceMode } from "@/lib/experienceMode";

export function useExperienceMode(): EffectiveExperienceMode {
  const { data: client } = useMyClient();
  if (!client) return "self_directed";
  return deriveExperienceMode(client);
}
