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
  // Mobile-app experience mode. Optional so the front-end can ship before the
  // backend column lands — deriveExperienceMode() falls back to broker_id.
  client_experience_mode?: ClientExperienceMode | null;
  client_experience_mode_reason?: ClientExperienceModeReason | null;
  client_experience_mode_locked_by?: ClientExperienceModeLockedBy | null;
}

export type ClientExperienceMode = "guided" | "self_directed" | "hybrid";
export type ClientExperienceModeReason =
  | "agent_referred"
  | "self_signup"
  | "funding_team_required"
  | "underwriting_conditions"
  | "user_preference"
  | "super_admin_override";
export type ClientExperienceModeLockedBy =
  | "system"
  | "agent"
  | "funding_team"
  | "super_admin";

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
  // Property details (writable via the AI property-intake tool +
  // desktop PropertyTab; alembic 0019 added unit_count).
  sqft?: number | null;
  beds?: number | null;
  baths?: number | null;
  year_built?: number | null;
  unit_count?: number | null;
  // alembic 0023 — buyer-side or seller-side transaction. Drives
  // doc-checklist filtering at kickoff. Optional so existing
  // borrower-fetched payloads still type-check.
  side?: "buyer" | "seller";
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

// Persisted Underwriter chat threads (Phase 8)
export interface AIChatThread {
  id: string;
  title: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  // alembic 0021 — bumped on /threads/{id}/seen. Renders the
  // unread dot when last_message_at > last_seen_at.
  last_seen_at?: string | null;
  unread?: boolean;
  created_at: string;
  updated_at: string;
  // alembic 0017 — loan-scoped thread when set; account-wide when null.
  loan_id?: string | null;
  loan_deal_id?: string | null;
  loan_address?: string | null;
}

// /loans/{id}/required-documents (alembic 0017). Drives the
// vault upload sheet's checklist picker. Final row is always the
// "Other / not in checklist" sentinel (is_other=true,
// checklist_key=null).
export interface RequiredDocument {
  checklist_key: string | null;
  label: string;
  required: boolean;
  auto_request: boolean;
  is_other: boolean;
  current_document_id: string | null;
  current_status: "pending" | "requested" | "received" | "verified" | "flagged" | null;
  received_on: string | null;
  verified_at: string | null;
  days_since_requested: number | null;
}
// CTAs the AI emits via tool-use. The frontend renders a button per
// action under the assistant bubble; tapping deep-links into the
// vault upload flow (or an inline confirm endpoint).
export interface ChatAction {
  kind:
    | "upload_document"
    | "confirm_document_routing"
    | "complete_property_intake"
    | "open_calendar_event";
  label: string;
  document_id?: string | null;
  checklist_key?: string | null;
  calendar_event_id?: string | null;
  confirm?: boolean;
}

// Files riding on a chat message. Borrower attaches via the
// composer paperclip → backend creates an is_other Document, runs
// vision scan, includes a chip on the persisted user message.
export interface ChatAttachment {
  document_id: string;
  name: string;
  content_type?: string | null;
  status?: string | null;
  suggested_checklist_key?: string | null;
}

export interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  created_at: string;
  actions?: ChatAction[] | null;
  attachments?: ChatAttachment[] | null;
}
export interface AIChatThreadDetail extends AIChatThread {
  messages: AIChatMessage[];
}
export interface AIChatSendResponse {
  user_message: AIChatMessage;
  assistant_message: AIChatMessage;
  thread: AIChatThread;
  used_stub: boolean;
}

// Account-wide living profile (Phase 8)
export interface ClientNextAction {
  title: string;
  owner: "client" | "broker" | "ai";
  priority: "low" | "medium" | "high";
  cta:
    | "upload_doc"
    | "run_credit"
    | "complete_profile"
    | "accept_prequal_offer"
    | "decline_prequal_offer"
    | "submit_prequal"
    | "respond_to_message"
    | "none";
  due_at: string | null;
}
export interface ClientLivingProfileBody {
  summary?: string;
  outstanding_documents?: { loan_id?: string; deal_id?: string; name: string; days_overdue?: number }[];
  blocking_credit_issues?: string[];
  next_actions?: ClientNextAction[];
  rate_pressure_notes?: string[];
  suggested_next_loan?: string | null;
}
export interface ClientLivingProfile {
  client_id: string;
  living_profile: ClientLivingProfileBody | null;
  living_summary: string | null;
  living_refreshed_at: string | null;
}

// Calendar (mirrors qcdesktop/src/lib/types.ts CalendarEvent + alembic 0013).
export type CalendarEventStatus = "pending" | "done" | "cancelled";
export type CalendarEventSource = "manual" | "auto" | "ai";

export interface CalendarEvent {
  id: string;
  loan_id: string | null;
  kind: CalendarEventKind;
  title: string;
  description: string | null;
  who: string | null;
  starts_at: string;
  duration_min: number | null;
  priority: "low" | "medium" | "high" | null;
  status: CalendarEventStatus;
  source: CalendarEventSource;
  owner_user_id: string | null;
  external_ref_kind: string | null;
  external_ref_id: string | null;
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

// ── Pre-qualification letter requests ─────────────────────────────────
// Mirrors QCDashboard/src/lib/types.ts — keep in sync.
//
// Lifecycle (backend alembic 0011+):
//   pending → approved → offer_accepted (Loan spawned at THIS step)
//                        offer_declined (no loan ever created)
//             rejected
//
// loan_id is NULL until offer_accepted — submit creates a standalone
// request, not a Loan.
export type PrequalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "offer_accepted"
  | "offer_declined";
// Four products. DSCR splits into purchase vs refi (5pt LTV haircut on
// refi); Fix & Flip is a first-class option alongside Bridge. Mirror of
// QCDashboard/src/lib/types.ts — keep in sync with backend
// app/routers/prequal.py LTV_CAPS.
export type PrequalLoanType = "dscr_purchase" | "dscr_refi" | "fix_flip" | "bridge";

// F&F scope-of-work line. Backend validates total_usd >= 0,
// category 1-80 chars, description 0-500 chars (alembic 0014).
export interface PrequalSowLineItem {
  category: string;
  description: string;
  total_usd: number;
}

export const PREQUAL_LTV_CAPS: Record<PrequalLoanType, number> = {
  dscr_purchase: 0.80,
  dscr_refi: 0.75,
  fix_flip: 0.85,
  bridge: 0.85,
};

export const PREQUAL_LOAN_TYPE_LABELS: Record<PrequalLoanType, { title: string; sub: string }> = {
  dscr_purchase: { title: "DSCR Purchase", sub: "30-yr fixed" },
  dscr_refi:     { title: "DSCR Refinance", sub: "Rate-and-term refi" },
  fix_flip:      { title: "Fix & Flip", sub: "Short-term rehab" },
  bridge:        { title: "Bridge", sub: "Short-term" },
};

export interface PrequalRequest {
  id: string;
  loan_id: string | null;
  requester_id: string;
  target_property_address: string;
  // For F&F: purchase_price is the BRV. For DSCR / Bridge it's the
  // property purchase / value.
  purchase_price: number;
  requested_loan_amount: number;
  // F&F-only (alembic 0014). Null on non-F&F products.
  arv_estimate: number | null;
  sow_items: PrequalSowLineItem[] | null;
  total_construction: number | null;
  approved_arv: number | null;
  approved_total_construction: number | null;
  approved_purchase_price: number | null;
  approved_loan_amount: number | null;
  approved_scenario: Record<string, unknown> | null;
  loan_type: PrequalLoanType;
  expected_closing_date: string | null;
  borrower_notes: string | null;
  admin_notes: string | null;
  // LLC / entity name on the letter. Null = TBD (letter falls back to
  // the borrower's individual legal name).
  borrower_entity: string | null;
  status: PrequalStatus;
  // Q-XXXX, generated on first approval and frozen across re-approvals.
  quote_number: string | null;
  // Presigned 24h GET URL — minted fresh on every API read.
  pdf_url: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrequalRequestCreate {
  target_property_address: string;
  purchase_price: number;
  requested_loan_amount: number;
  loan_type: PrequalLoanType;
  expected_closing_date?: string | null;
  borrower_notes?: string | null;
  borrower_entity?: string | null;
  // F&F-only. Backend ignores when loan_type !== fix_flip.
  arv_estimate?: number | null;
  sow_items?: PrequalSowLineItem[] | null;
}

export interface PrequalSellerOutcome {
  note?: string | null;
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
