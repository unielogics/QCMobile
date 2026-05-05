import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "./useAuthedFetch";
import { useSession } from "@/store/session";
import type { Loan, RecalcResponse, CreditPullStatus } from "@/lib/types";

function useCacheKey() {
  return useSession((s) => s.devUser);
}

export function useLoans() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["loans", key],
    queryFn: () => fetcher<Loan[]>("/loans"),
  });
}

export function useLoan(loanId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["loan", loanId, key],
    queryFn: () => fetcher<Loan>(`/loans/${loanId}`),
    enabled: !!loanId,
  });
}

export function useCreditCurrent() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["credit", key],
    queryFn: () => fetcher<CreditPullStatus | null>("/credit/current"),
  });
}

export function useStartCreditPull() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const key = useCacheKey();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher<CreditPullStatus>("/credit/pull", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit", key] }),
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
