export type DealSecretaryState =
  | "idle"
  | "running"
  | "needs_input"
  | "blocked"
  | "complete";

export interface DealSecretarySummary {
  state: DealSecretaryState;
  ai_blocked: boolean;
  next_question: string | null;
}

export function mockDealSecretarySummary(loanIds: string[]): Record<string, DealSecretarySummary> {
  const out: Record<string, DealSecretarySummary> = {};
  for (const id of loanIds) {
    out[id] = { state: "idle", ai_blocked: false, next_question: null };
  }
  return out;
}
