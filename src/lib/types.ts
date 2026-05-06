// Hand-typed mirror of backend response shapes.

import type {
  AITaskPriority, AITaskSource, AITaskStatus, BrokerTier, CalendarEventKind,
  DocStatus, LoanStage, LoanType, MessageFrom, PropertyType, Role,
} from "./enums.generated";

export interface User {
  id: string;
  clerk_id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Client {
  id: string;
  user_id: string | null;
  broker_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  since: string | null;
  tier: string;
  fico: number | null;
  avatar_color: string | null;
  funded_total: number;
  funded_count: number;
  properties: string | null;
  experience: string | null;
}

export interface RateSKU {
  id: string;
  label: string;
  loan_type: LoanType;
  rate: number;
  points: number;
  term: string;
  min_fico: number;
  max_ltv: number;
  delta_bps: number;
}

export interface Loan {
  id: string;
  deal_id: string;
  client_id: string;
  broker_id: string | null;
  address: string;
  city: string | null;
  property_type: PropertyType;
  type: LoanType;
  stage: LoanStage;
  amount: number;
  ltv: number | null;
  ltc: number | null;
  arv: number | null;
  base_rate: number | null;
  discount_points: number;
  final_rate: number | null;
  origination_pct: number;
  term_months: number | null;
  monthly_rent: number | null;
  annual_taxes: number;
  annual_insurance: number;
  monthly_hoa: number;
  dscr: number | null;
  risk_score: number | null;
  close_date: string | null;
}

export interface RecalcResponse {
  final_rate: number;
  monthly_pi: number;
  dscr: number | null;
  cash_to_close_pricing: number;
  hud_total: number;
  warnings: { code: string; message: string; severity: string }[];
}

export interface CreditPullStatus {
  id: string;
  status: string;
  fico: number | null;
  pulled_at: string | null;
  expires_at: string | null;
  // Derived (computed in router) — UI uses these to render the
  // "expires in 12 days" pill without doing date math.
  is_expired?: boolean;
  days_until_expiry?: number | null;
  expiring_soon?: boolean;
}

// ── Credit summary (borrower-facing) ───────────────────────────────────────
// Shape mirrors qcdesktop/src/lib/types.ts CreditSummary — keep in sync.
export interface CreditSummaryBullet {
  kind: "positive" | "neutral" | "warn";
  label: string;
  detail: string | null;
}
export interface CreditSummaryProduct {
  id: string;
  label: string;
  loan_type: string;
  rate?: number;
  max_ltv?: number;
  term?: string;
  min_fico?: number;
  reason?: string;
}
export interface CreditSummary {
  fico: number | null;
  fico_model: string | null;
  tier: string | null;
  tier_max_ltv: number | null;
  bullets: CreditSummaryBullet[];
  recent_inquiries_6mo?: number;
  available_products: CreditSummaryProduct[];
  blocked_products: CreditSummaryProduct[];
  fraud_flag: string | null;
  note?: string;
}

export interface Activity {
  id: string;
  loan_id: string | null;
  actor_id: string | null;
  actor_label: string | null;
  kind: string;
  summary: string;
  payload: Record<string, unknown> | null;
  occurred_at: string;
}

export interface Document {
  id: string;
  loan_id: string;
  name: string;
  category: string | null;
  s3_key: string | null;
  status: DocStatus;
  requested_on: string | null;
  received_on: string | null;
  verified_at: string | null;
  verified_by: string | null;
}

// /documents/upload-init returns either a presigned S3 URL (production) or
// null upload_url (dev mode without AWS keys — backend just records metadata).
export interface DocumentUploadInitResponse {
  document_id: string;
  upload_url: string | null;
  s3_key: string;
}

export interface AIChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatRequest {
  messages: AIChatTurn[];
  loan_id?: string | null;
}

export interface AIChatResponse {
  reply: string;
  model: string;
  used_stub: boolean;
}

// Calendar (mirrors qcdesktop/src/lib/types.ts CalendarEvent)
export interface CalendarEvent {
  id: string;
  loan_id: string | null;
  kind: CalendarEventKind;
  title: string;
  who: string | null;
  starts_at: string;
  duration_min: number | null;
  priority: "low" | "medium" | "high" | null;
}

// Reports/dashboard
export interface StageBreakdown {
  stage: LoanStage;
  count: number;
  value: number;
}
export interface TypeBreakdown {
  type: string;
  count: number;
  value: number;
}
export interface DashboardReport {
  funded_ytd: number;
  funded_ytd_delta: number | null;
  pipeline_value: number;
  pipeline_count: number;
  avg_close_days: number | null;
  avg_close_delta: number | null;
  pull_through: number | null;
  pull_through_delta: number | null;
  by_stage: StageBreakdown[];
  by_type: TypeBreakdown[];
}

// FRED-driven market rates (mirrors qcdesktop)
export interface FredObservation {
  date: string;
  value: number | null;
}
export interface FredSeriesSummary {
  series_id: string;
  label: string;
  description: string;
  current_value: number | null;
  current_date: string | null;
  previous_value: number | null;
  delta_bps: number | null;
  spread_bps: number;
  estimated_rate: number | null;
  history_7d: FredObservation[];
  history_30d: FredObservation[];
  // Variable-window history (request via /fred/series?days=N). Optional so
  // older backend deploys still validate. The chart component prefers
  // `history` when present and falls back to `history_30d` / `history_7d`.
  history?: FredObservation[];
  history_days?: number;
}
