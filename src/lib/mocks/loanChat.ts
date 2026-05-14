// Mock shapes for the loan-workspace chat (the SAME thread the
// client sees). Real backend is /api/v1/loans/{loanId}/chat +
// /api/v1/loans/{loanId}/workspace.

export type DealChatRole =
  | "ai"
  | "super_admin"
  | "broker"
  | "broker_internal"
  | "client";

export type DealChatMode =
  | "chat"
  | "live_chat"
  | "instruct"
  | "broker_question"
  | "broker_suggestion";

export interface LoanChatMessage {
  id: string;
  body: string;
  from_role: DealChatRole;
  client_visible: boolean;
  created_at: string;
}

export interface LoanWorkspace {
  chat_messages: LoanChatMessage[];
  ai_paused_until: string | null;
  ai_paused_by: DealChatRole | null;
}

export function mockLoanWorkspace(_loanId: string): LoanWorkspace {
  return {
    chat_messages: [],
    ai_paused_until: null,
    ai_paused_by: null,
  };
}
