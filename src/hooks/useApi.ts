import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "./useAuthedFetch";
import { useSession } from "@/store/session";
import type {
  Loan,
  RecalcResponse,
  CreditPullStatus,
  CreditSummary,
  User,
  Client,
  RateSKU,
  Activity,
  Document,
  DocumentUploadInitResponse,
  AIChatRequest,
  AIChatResponse,
  AIChatThread,
  AIChatThreadDetail,
  AIChatSendResponse,
  ClientLivingProfile,
  RequiredDocument,
  CalendarEvent,
  DashboardReport,
  FredSeriesSummary,
  PrequalRequest,
  PrequalRequestCreate,
  PrequalSellerOutcome,
  AITask,
  BrokerSettings,
  EngagementSignal,
  FunnelMetrics,
  ListScope,
  NextAction,
} from "@/lib/types";
import type { ClientStage } from "@/lib/enums.generated";

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

function isNotFound(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof NotFoundError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /\b404\b/.test(msg);
}

function useCacheKey() {
  // Returning a key that incorporates Clerk's `isLoaded` makes
  // EVERY query that uses this helper auto-recover from the
  // auth-readiness race: useAuthedFetch returns a never-resolving
  // promise on the first render before Clerk has hydrated, and RQ
  // doesn't auto-cancel the in-flight queryFn when its closure
  // changes. By baking isLoaded into the key, the auth flip
  // produces a NEW queryKey → RQ starts a fresh query with the
  // updated fetcher → events arrive immediately.
  //
  // First seen on the calendar tab; the chat sheet hit the same
  // bug because useAIChatThreads / useLoans / useAIChatThread all
  // use this key.
  const { isLoaded } = useAuth();
  const devUser = useSession((s) => s.devUser);
  return isLoaded ? devUser : `__auth_pending__${devUser ?? ""}`;
}

// /auth/me — canonical "who am I?". Mirrors qcdesktop's useCurrentUser:
// short staleTime + refetchOnWindowFocus so backend-side role changes
// (demote_to_client.py, Settings → Team) propagate within a tab-switch
// instead of taking 5 minutes.
//
// In React Native `refetchOnWindowFocus` only does anything when the app
// has wired focusManager to AppState — see app/_layout.tsx. Without that
// it's a no-op, but harmless.
export function useCurrentUser() {
  const fetcher = useAuthedFetch();
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["auth-me", isSignedIn],
    queryFn: () => fetcher<User>("/auth/me"),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
    enabled: isLoaded,
  });
}

// Backward-compat alias — older mobile screens import { useMe }. New code
// should use useCurrentUser to stay aligned with desktop naming.
export const useMe = useCurrentUser;

export function useRates() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["rates", key],
    queryFn: () => fetcher<RateSKU[]>("/rates"),
    staleTime: 60 * 1000,
  });
}

// `scope` is optional. Pass "mine" from agent screens to ask the backend for
// the broker's own book (matches qcdesktop's useLoans("mine")). Borrower
// callers omit it and continue to get the auto-scoped result.
export function useLoans(scope?: ListScope) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  const qs = scope ? `?scope=${scope}` : "";
  return useQuery({
    queryKey: ["loans", scope ?? "auto", key],
    queryFn: () => fetcher<Loan[]>(`/loans${qs}`),
  });
}

export function useLoan(loanId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["loan", loanId, key],
    queryFn: () => fetcher<Loan>(`/loans/${loanId}`),
    enabled: !!loanId,
    // Poll every 15s so CLIENTs see operator/AI edits propagate without
    // a page refresh. Slice 3 will replace this with WebSocket push.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

// Single canonical credit hook used by /profile, /home, /simulator, and
// /credit-pull. ALL of these need to see the same source of truth — when
// the borrower pulls credit on desktop and reopens mobile, every screen
// should reflect it without refetching individually.
//
// Previously we had two hooks (useCreditCurrent + useMyCredit) with
// DIFFERENT queryKeys hitting the SAME endpoint. The backend ignores the
// client_id query param and just uses user.client.id, so the responses
// are identical, but react-query treated them as separate caches —
// causing profile to show the score while home/simulator stayed gated.
//
// This consolidates: both names point at the same useQuery so any
// consumer's mount/refocus refetch warms the cache for everyone else.
export function useCreditCurrent() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  // Gate on Clerk readiness — useAuthedFetch returns a never-resolving
  // promise while Clerk is still loading, which would otherwise leave
  // this query stuck in `pending` forever for any screen that mounts
  // before sign-in finishes (notably the Home tab, which is the default).
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ["credit-current", key],
    queryFn: () => fetcher<CreditPullStatus | null>("/credit/current"),
    enabled: isLoaded,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  });
}

// Backed by /clients/me. Returns the calling user's linked Client record
// (phone, address, city, tier, etc.). Used to pre-fill borrower-facing
// flows like the soft credit pull. 404 is expected for operator users
// with no client linkage — don't retry.
export function useMyClient() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["my-client", key],
    queryFn: () => fetcher<Client>("/clients/me"),
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
  });
}

// Borrower-safe summary derived from the parsed credit report.
// Backend: GET /credit/pulls/{id}/summary.
export function useCreditSummary(pullId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["credit-summary", pullId, key],
    queryFn: () => fetcher<CreditSummary>(`/credit/pulls/${pullId}/summary`),
    enabled: !!pullId,
  });
}

export function useStartCreditPull() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const key = useCacheKey();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher<CreditPullStatus>("/credit/pull", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      // useMyCredit / useCreditCurrent are now a single hook backed by
      // queryKey ["credit-current", key]. Seed it so the simulator
      // unlocks immediately when the user navigates back from credit-pull.
      // We also leave the legacy invalidations in place in case any other
      // module was caching under those older prefixes.
      qc.setQueryData(["credit-current", key], data);
      qc.invalidateQueries({ queryKey: ["credit-current"] });
      qc.invalidateQueries({ queryKey: ["credit"] });
      qc.invalidateQueries({ queryKey: ["my-credit"] });
    },
  });
}

export function useRecalc() {
  const fetcher = useAuthedFetch();
  return useMutation({
    mutationFn: ({
      loanId, discount_points, base_rate, loan_amount,
    }: { loanId: string; discount_points: number; base_rate?: number; loan_amount?: number }) =>
      fetcher<RecalcResponse>(`/loans/${loanId}/recalc`, {
        method: "POST",
        body: JSON.stringify({ discount_points, base_rate, loan_amount }),
      }),
  });
}

export function useLoanActivity(loanId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["loanActivity", loanId, key],
    queryFn: () => fetcher<Activity[]>(`/loans/${loanId}/activity`),
    enabled: !!loanId,
  });
}

export function useDocuments(loanId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["documents", loanId, key],
    queryFn: () => fetcher<Document[]>(loanId ? `/documents?loan_id=${loanId}` : "/documents"),
  });
}

// Upload a document to a specific loan. Two-step:
//   1. POST /documents/upload-init  → { document_id, upload_url (presigned S3) }
//   2. PUT the file blob to upload_url with x-amz-server-side-encryption: AES256
//
// In dev mode (no AWS keys on backend) upload_url is null — we still record
// metadata so the doc shows up in /documents. Mirrors qcdesktop's
// useUploadDocument but takes RN-style file refs (uri / name / mimeType).
export function useUploadDocument() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      loan_id: string;
      file: { uri: string; name: string; mimeType: string };
      category?: string;
      // alembic 0017 — pick exactly one of these to link the upload
      // to the loan's checklist for AI vision scanning.
      fulfill_document_id?: string | null;
      checklist_key?: string | null;
      is_other?: boolean;
      // Optional name override (so checklist labels stick).
      name?: string;
    }) => {
      const init = await fetcher<DocumentUploadInitResponse>("/documents/upload-init", {
        method: "POST",
        body: JSON.stringify({
          loan_id: vars.loan_id,
          name: vars.name ?? vars.file.name,
          content_type: vars.file.mimeType,
          category: vars.category,
          fulfill_document_id: vars.fulfill_document_id ?? null,
          checklist_key: vars.checklist_key ?? null,
          is_other: !!vars.is_other,
        }),
      });
      if (init.upload_url) {
        // Read the file as a Blob from its local uri, then PUT it to S3.
        // RN's fetch handles file:// uris natively.
        const fileResp = await fetch(vars.file.uri);
        const blob = await fileResp.blob();
        const put = await fetch(init.upload_url, {
          method: "PUT",
          body: blob,
          headers: {
            "Content-Type": vars.file.mimeType,
            "x-amz-server-side-encryption": "AES256",
          },
        });
        if (!put.ok) throw new Error(`S3 upload failed: ${put.status} ${put.statusText}`);
        // Flip the doc to RECEIVED + queue the vision scan.
        await fetcher(`/documents/upload-complete`, {
          method: "POST",
          body: JSON.stringify({ document_id: init.document_id }),
        });
      }
      return init;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["documents", vars.loan_id] });
      qc.invalidateQueries({ queryKey: ["documents", undefined] });
      qc.invalidateQueries({ queryKey: ["documents", null] });
      qc.invalidateQueries({ queryKey: ["required-documents", vars.loan_id] });
    },
  });
}

// /loans/{id}/required-documents — drives the upload sheet's
// checklist picker.
export function useRequiredDocuments(loanId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["required-documents", loanId, key],
    queryFn: () => fetcher<RequiredDocument[]>(`/loans/${loanId}/required-documents`),
    enabled: !!loanId,
  });
}

// Find-or-create the AI chat thread. Lazy-spawn on first tap.
// alembic 0030 added client_id alongside loan_id for the Realtor AI's
// per-client threads. Routing precedence: loan_id > client_id > both
// null (account-wide).
export function useFindOrCreateChatThread() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const key = useCacheKey();
  return useMutation({
    mutationFn: ({ loan_id, client_id }: { loan_id?: string | null; client_id?: string | null }) =>
      fetcher<AIChatThread>("/ai/chat/threads/find-or-create", {
        method: "POST",
        body: JSON.stringify({ loan_id: loan_id ?? null, client_id: client_id ?? null }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aiChatThreads", key] }),
  });
}

export function useAIChat() {
  const fetcher = useAuthedFetch();
  return useMutation({
    mutationFn: (payload: AIChatRequest) =>
      fetcher<AIChatResponse>("/ai/chat", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

// ── Persisted Underwriter chat threads (Phase 8) ──────────────────────────

export function useAIChatThreads() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["aiChatThreads", key],
    queryFn: () => fetcher<AIChatThread[]>("/ai/chat/threads"),
    // Poll every 15s so the chat icon's unread dot reflects new
    // system messages (kickoff opener, anchor narration, doc-reminder
    // tier-1) without waiting for a manual refresh.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useAIChatThread(threadId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["aiChatThread", threadId, key],
    queryFn: () => fetcher<AIChatThreadDetail>(`/ai/chat/threads/${threadId}`),
    enabled: !!threadId,
    // While the thread is open, poll for new messages so the AI's
    // anchor narration ("Got your bank statements!") shows up
    // without a manual close/reopen.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

// Bumps `last_seen_at = now()` on the thread. Called when the
// borrower opens a thread so the unread dot clears.
export function useMarkThreadSeen() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const key = useCacheKey();
  return useMutation({
    mutationFn: (threadId: string) =>
      fetcher<AIChatThread>(`/ai/chat/threads/${threadId}/seen`, {
        method: "POST",
      }),
    onSuccess: (_, threadId) => {
      qc.invalidateQueries({ queryKey: ["aiChatThread", threadId, key] });
      qc.invalidateQueries({ queryKey: ["aiChatThreads", key] });
    },
  });
}

export function useCreateAIChatThread() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const key = useCacheKey();
  return useMutation({
    mutationFn: (payload: { title?: string | null }) =>
      fetcher<AIChatThread>("/ai/chat/threads", {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aiChatThreads", key] }),
  });
}

export function useSendAIChatMessage() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const key = useCacheKey();
  return useMutation({
    mutationFn: ({
      threadId,
      body,
      loan_id,
      attachment_tokens,
    }: {
      threadId: string;
      body: string;
      loan_id?: string | null;
      attachment_tokens?: string[] | null;
    }) =>
      fetcher<AIChatSendResponse>(`/ai/chat/threads/${threadId}/message`, {
        method: "POST",
        body: JSON.stringify({
          body,
          loan_id: loan_id ?? null,
          attachment_tokens: attachment_tokens ?? null,
        }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["aiChatThread", vars.threadId, key] });
      qc.invalidateQueries({ queryKey: ["aiChatThreads", key] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

// Chat-composer paperclip: mints a presigned URL for a file the
// borrower drops into a loan-scoped chat thread. The next send-msg
// call (with the returned document_id in `attachment_tokens`)
// flips the doc RECEIVED, runs vision scan, and lets the AI
// propose routing in its reply.
export function useChatAttachmentInit() {
  const fetcher = useAuthedFetch();
  return useMutation({
    mutationFn: async (vars: {
      threadId: string;
      file: { uri: string; name: string; mimeType: string };
    }): Promise<{ document_id: string }> => {
      const init = await fetcher<{
        document_id: string;
        upload_url: string | null;
        s3_key: string;
      }>(`/ai/chat/threads/${vars.threadId}/attachments/upload-init`, {
        method: "POST",
        body: JSON.stringify({
          name: vars.file.name,
          content_type: vars.file.mimeType,
        }),
      });
      if (init.upload_url) {
        const fileResp = await fetch(vars.file.uri);
        const blob = await fileResp.blob();
        const put = await fetch(init.upload_url, {
          method: "PUT",
          body: blob,
          headers: {
            "Content-Type": vars.file.mimeType,
            "x-amz-server-side-encryption": "AES256",
          },
        });
        if (!put.ok) throw new Error(`S3 upload failed: ${put.status} ${put.statusText}`);
      }
      return { document_id: init.document_id };
    },
  });
}

// Hit by the chat's confirm_document_routing CTA. Relinks an
// orphan upload to a checklist slot (or merges it into the slot's
// existing REQUESTED row).
export function useRouteDocument() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const key = useCacheKey();
  return useMutation({
    mutationFn: ({
      documentId,
      checklist_key,
    }: {
      documentId: string;
      checklist_key: string | null;
    }) =>
      fetcher(`/documents/${documentId}/route`, {
        method: "POST",
        body: JSON.stringify({
          checklist_key,
          is_other: checklist_key == null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["aiChatThread"] });
      qc.invalidateQueries({ queryKey: ["aiChatThreads", key] });
    },
  });
}

export function useDeleteAIChatThread() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const key = useCacheKey();
  return useMutation({
    mutationFn: (threadId: string) =>
      fetcher<void>(`/ai/chat/threads/${threadId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aiChatThreads", key] }),
  });
}

// ── Account-wide living profile (Phase 8) ─────────────────────────────────

export function useMyLivingProfile() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["myLivingProfile", key],
    queryFn: () => fetcher<ClientLivingProfile>("/clients/me/living-profile"),
    staleTime: 60_000,
  });
}

export function useRefreshMyLivingProfile() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const key = useCacheKey();
  return useMutation({
    mutationFn: () =>
      fetcher<ClientLivingProfile>("/clients/me/summary/refresh", { method: "POST" }),
    onSuccess: (data) => qc.setQueryData(["myLivingProfile", key], data),
  });
}

// /reports/dashboard — KPI tiles (funded YTD, pipeline value, avg close, pull-through)
export function useDashboardReport() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["dashboard-report", key],
    queryFn: () => fetcher<DashboardReport>("/reports/dashboard"),
    staleTime: 30 * 1000,
  });
}

// /calendar — agenda events (today + upcoming)
export function useCalendar() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  // Gate on Clerk's `isLoaded`. When the user hits the Calendar tab
  // before auth has hydrated, the fetcher returns a never-resolving
  // promise (the auth-readiness gate inside useAuthedFetch). React
  // Query doesn't auto-cancel an in-flight queryFn when its
  // closure changes, so without this we'd stay in `pending` even
  // after auth comes up. Putting `isLoaded` in the queryKey makes
  // the auth-flip create a fresh query that uses the working
  // fetcher → resolves immediately.
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ["calendar", key, isLoaded],
    queryFn: () => fetcher<CalendarEvent[]>("/calendar"),
    enabled: isLoaded,
    // Borrower hits the tab expecting fresh status — emitter-driven
    // events (doc due, closing day, etc.) appear without a manual
    // refresh.
    staleTime: 30 * 1000,
  });
}

// PATCH /calendar/{id} — mark done / re-open. Borrowers may only flip
// status; backend enforces. Operators can also patch title/who/etc.
export function useUpdateCalendarEvent() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        status: "pending" | "done" | "cancelled";
        title: string;
        description: string | null;
        starts_at: string;
        priority: "low" | "medium" | "high" | null;
      }>;
    }) =>
      fetcher<CalendarEvent>(`/calendar/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

// /fred/series — FRED-driven market rates with spreads.
// Mirrors qcdesktop's useFredSeries. The optional `days` argument (1..90)
// requests a wider history window for the rate-explorer chart; default
// (omit) returns the standard 30-day bundle. Days is part of the queryKey
// so different ranges cache independently.
export function useFredSeries(days?: number) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  // Same Clerk-readiness gate as useCreditCurrent — the home tab mounts
  // before sign-in finishes, and a never-resolving promise from the
  // pre-Clerk fetcher would leave the rate strip stuck on "—".
  const { isLoaded } = useAuth();
  const requested = days != null ? Math.max(1, Math.min(days, 90)) : undefined;
  const path = requested ? `/fred/series?days=${requested}` : "/fred/series";
  return useQuery({
    queryKey: ["fredSeries", key, requested ?? "default"],
    queryFn: () => fetcher<FredSeriesSummary[]>(path),
    enabled: isLoaded,
    // Previously: 5-min staleTime + 1-retry cap meant a single transient
    // 401 (e.g. during a sign-in race) left the hook stuck on the cached
    // error for 5 min — and the user saw "market rates not loading".
    // Now: 60s staleTime, retry up to 3 times on transport errors,
    // refetch on every mount so navigating back to home/calculator
    // always re-attempts.
    staleTime: 60 * 1000,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 3,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

// Single-series with full history — used by detail screens that want to
// drill into one rate. Mirrors qcdesktop's useFredSeriesDetail.
export function useFredSeriesDetail(seriesId: string | null, days = 30) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["fredSeries", seriesId, days, key],
    queryFn: () => fetcher<FredSeriesSummary>(`/fred/series/${seriesId}?days=${days}`),
    enabled: !!seriesId,
  });
}

// POST /loans/calc — loan-less what-if pricing. Mirrors qcdesktop's
// useFreeCalc so the mobile simulator can stop doing client-side math
// and use the same backend pricing engine the operator surface uses.
export function useFreeCalc() {
  const fetcher = useAuthedFetch();
  return useMutation({
    mutationFn: (body: {
      type: string;
      property_type?: string;
      loan_amount: number;
      base_rate: number;
      discount_points: number;
      term_months?: number | null;
      monthly_rent?: number | null;
      annual_taxes?: number;
      annual_insurance?: number;
      monthly_hoa?: number;
    }) =>
      fetcher<RecalcResponse>("/loans/calc", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

// /credit/current?client_id=self — explicit "my own credit" lookup. Mirrors
// desktop's useMyCredit. The plain useCreditCurrent (no scope) works for
// any role; this version is the one to call from CLIENT-only flows so the
// intent is explicit in the code.
// Alias for useCreditCurrent — same cache, same data. Kept as a separate
// name only so existing callers don't have to be touched. New code should
// prefer useCreditCurrent directly. See the comment on useCreditCurrent
// for the consolidation rationale.
export function useMyCredit() {
  return useCreditCurrent();
}

// ── Pre-qualification letters (borrower-only on mobile) ───────────────
// Mirrors QCDashboard hooks. Mobile only ships the borrower flow:
// submit, list, and report-back the seller's outcome. No admin queue,
// no review modal — operators stay on desktop.

export function useMyPrequalRequests() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["prequal-requests", "me", key],
    queryFn: () => fetcher<PrequalRequest[]>("/me/prequal-requests"),
    // Borrower opens the app expecting fresh status — pending may have
    // flipped to approved while they were away.
    staleTime: 30 * 1000,
  });
}

export function useSubmitPrequalRequest() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PrequalRequestCreate) =>
      fetcher<PrequalRequest>("/prequal-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prequal-requests"] });
    },
    // Even on error we refresh the list — F&F auto-approval can write
    // the row to the DB, then time out during PDF render and surface as
    // 502/504 to the proxy. The borrower's request is real either way;
    // we want them to see it on the next render rather than re-submit.
    onError: () => {
      qc.invalidateQueries({ queryKey: ["prequal-requests"] });
    },
  });
}

export function useAcceptPrequalOffer() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }: { requestId: string; payload: PrequalSellerOutcome }) =>
      fetcher<PrequalRequest>(`/me/prequal-requests/${requestId}/accept-offer`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prequal-requests"] });
      // Acceptance spawns a Loan — refresh the borrower's loan list so
      // it appears in the My Loans section under the prequal section.
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useDeclinePrequalOffer() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }: { requestId: string; payload: PrequalSellerOutcome }) =>
      fetcher<PrequalRequest>(`/me/prequal-requests/${requestId}/decline-offer`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prequal-requests"] });
    },
  });
}

// ─── Agent (broker) hooks ─────────────────────────────────────────
// All ported from QCDashboard/src/hooks/useApi.ts. Same endpoints,
// same query-key shape. Used exclusively by the app/agent/* routes.

export function useClients(scope?: ListScope) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  const qs = scope ? `?scope=${scope}` : "";
  return useQuery({
    queryKey: ["clients", scope ?? "auto", key],
    queryFn: () => fetcher<Client[]>(`/clients${qs}`),
  });
}

export function useClient(clientId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["client", clientId, key],
    queryFn: () => fetcher<Client>(`/clients/${clientId}`),
    enabled: !!clientId,
  });
}

export function useAITasks() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["aiTasks", key],
    queryFn: () => fetcher<AITask[]>("/ai-tasks").catch(() => [] as AITask[]),
    retry: false,
  });
}

// /agents/me/funnel — backend-scoped to the broker's book. May 404 on
// older deploys; agent screens fall back to deriveFunnelFromLoans().
export function useLeadFunnel() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["leadFunnel", key],
    queryFn: () => fetcher<FunnelMetrics>("/agents/me/funnel"),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
  });
}

// /agents/me/next-actions — backend-built action queue. May 404; agent
// screens fall back to deriveNextActionsFromLoans().
export function useNextActions() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["nextActions", key],
    queryFn: () => fetcher<NextAction[]>("/agents/me/next-actions"),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
  });
}

export function useBrokerSettings() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["brokerSettings", key],
    queryFn: () => fetcher<BrokerSettings>("/me/broker-settings"),
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
  });
}

export function useUpdateBrokerSettings() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<BrokerSettings>) =>
      fetcher<BrokerSettings>("/me/broker-settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brokerSettings"] });
    },
  });
}

export function useEngagement(clientId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["engagement", clientId, key],
    queryFn: () =>
      fetcher<EngagementSignal[]>(`/clients/${clientId}/engagement`).catch(() => [] as EngagementSignal[]),
    enabled: !!clientId,
    retry: false,
  });
}

// Stage transitions — both wired to dashboard's PATCH /clients/{id}/stage
// and POST /clients/{id}/start-funding. May 404 on older backends.
export function useUpdateClientStage() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, stage }: { clientId: string; stage: ClientStage }) =>
      fetcher<Client>(`/clients/${clientId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", vars.clientId] });
    },
  });
}

export function useStartFunding() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      fetcher<Client>(`/clients/${clientId}/start-funding`, { method: "POST" }),
    onSuccess: (_, clientId) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

// POST /clients — broker-side "Add Lead". Backend hard-stamps broker_id
// from the session for Role.BROKER, so we don't send it. Lead routing /
// ownership / attribution fields (alembic 0029) sit alongside the
// basic name/email/phone — captured by the mobile AgentAddLeadRoute.
export function useCreateClient() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      email?: string;
      phone?: string;
      city?: string;
      referral_source?: string;
      stage?: ClientStage;
      client_type?: "buyer" | "seller";
      // Per-lead overrides (alembic 0025).
      lead_intake?: Record<string, unknown> | null;
      checklist_overrides?: Record<string, unknown> | null;
      ai_cadence_override?: Record<string, unknown> | null;
      // Lead routing / ownership / attribution (alembic 0029). Mirrors
      // QCDashboard so the mobile agent flow fills in the same data
      // and the funding team has parity context regardless of channel.
      lead_source?: string;
      lead_temperature?: string;
      financing_support_needed?: string;
      contact_permission?: string;
      relationship_context?: string;
      source_channel?: string;
    }) =>
      fetcher<Client>("/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// Hand a lead off to the funding team for prequalification review.
// Backend creates a PrequalRequest from Client.lead_intake JSONB +
// spawns an AITask in the funding-team queue. Used by:
//   - "Ready for Prequalification" action on /agent/client/[id]
//   - AIChatSheet action card (kind: "request_prequalification")
export function useRequestPrequalification() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    // invalidates: ["client", clientId], ["clients"], ["ai-tasks"]
    mutationFn: (clientId: string) =>
      fetcher<{
        prequal_request_id: string;
        client_id: string;
        lead_promotion_status: string;
      }>(`/clients/${clientId}/request-prequalification`, {
        method: "POST",
      }),
    onSuccess: (_data, clientId) => {
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["ai-tasks"] });
    },
  });
}

// Realtor AI ChatAction confirm-endpoints (alembic 0030). Mirror of
// QCDashboard's hooks. v1 stubs spawn AITasks; full integrations land
// in follow-up.

interface RealtorActionResult {
  client_id: string;
  action_kind: string;
  ai_task_id: string | null;
}

function useRealtorAction(path: (id: string) => string) {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      fetcher<RealtorActionResult>(path(clientId), { method: "POST" }),
    onSuccess: (_data, clientId) => {
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["ai-tasks"] });
    },
  });
}

export function useSendBuyerAgreement() {
  return useRealtorAction((id) => `/clients/${id}/send-buyer-agreement`);
}

export function useSendListingAgreement() {
  return useRealtorAction((id) => `/clients/${id}/send-listing-agreement`);
}

export function useMarkClientFinanceReady() {
  return useRealtorAction((id) => `/clients/${id}/mark-finance-ready`);
}
