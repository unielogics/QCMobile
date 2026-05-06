// Eligibility / gating logic for the loan simulator.
//
// Determines which LTV options a borrower can use against their property's ARV
// based on credit score, ownership tenure, and portfolio breadth. Pure logic —
// no React, no API calls. Mirror lives at qcdesktop/src/lib/eligibility.ts.

export type EligibilityTier = "blocked" | "warn" | "basic" | "pro";

export interface EligibilityInputs {
  /** Verified FICO from soft pull. null = no credit on file yet. */
  fico: number | null;
  /** Number of properties owned (loans funded + REO entries). */
  propertyCount: number;
  /** Has the borrower owned the subject property (or any property) for 1+ year. */
  hasYearOfOwnership: boolean;
}

export interface EligibilityBanner {
  kind: "credit-blocked" | "credit-warn" | "experience" | "no-credit";
  title: string;
  body: string;
  ctaLabel?: string;
  ctaTarget?: "credit-pull" | "vault" | "new-loan";
}

export interface EligibilityResult {
  tier: EligibilityTier;
  /** Maximum LTV the user can pick (e.g. 0.65 or 0.75). 0 if blocked. */
  maxLTV: number;
  /** Discrete LTV presets unlocked at this tier. */
  allowedLTVs: number[];
  /** All four standard presets — useful so UI can grey out the locked ones. */
  allLTVs: number[];
  banner: EligibilityBanner | null;
}

const ALL_LTVS = [0.6, 0.65, 0.7, 0.75];

export function computeEligibility(input: EligibilityInputs): EligibilityResult {
  const { fico, propertyCount, hasYearOfOwnership } = input;

  // No credit pull on file yet — gate everything.
  if (fico == null) {
    return {
      tier: "blocked",
      maxLTV: 0,
      allowedLTVs: [],
      allLTVs: ALL_LTVS,
      banner: {
        kind: "no-credit",
        title: "Credit not verified",
        body: "Run a soft credit pull to unlock loan offers. No score impact.",
        ctaLabel: "Unlock Pro Terms · Soft Pull",
        ctaTarget: "credit-pull",
      },
    };
  }

  // Hard block — credit below 620.
  if (fico < 620) {
    return {
      tier: "blocked",
      maxLTV: 0,
      allowedLTVs: [],
      allLTVs: ALL_LTVS,
      banner: {
        kind: "credit-blocked",
        title: "Credit below threshold",
        body: `Score ${fico} doesn't meet our 620 minimum. Start a guided new-loan workflow — our AI can route you to credit-repair options and structure a path forward.`,
        ctaLabel: "Start guided workflow",
        ctaTarget: "new-loan",
      },
    };
  }

  // Caution band — 620–679.
  if (fico < 680) {
    return {
      tier: "warn",
      maxLTV: 0.65,
      allowedLTVs: [0.6, 0.65],
      allLTVs: ALL_LTVS,
      banner: {
        kind: "credit-warn",
        title: "Credit needs review",
        body: `Score ${fico}: we can run estimates but cannot guarantee a loan at these terms. Our team will reach out with options to address the credit issue.`,
      },
    };
  }

  // 680+ but missing experience — gate at 65%.
  const hasFullExperience = hasYearOfOwnership && propertyCount >= 2;
  if (!hasFullExperience) {
    const reasons: string[] = [];
    if (!hasYearOfOwnership) reasons.push("1+ year of ownership history");
    if (propertyCount < 2) reasons.push("at least 2 owned properties");
    return {
      tier: "basic",
      maxLTV: 0.65,
      allowedLTVs: [0.6, 0.65],
      allLTVs: ALL_LTVS,
      banner: {
        kind: "experience",
        title: "Add experience to unlock 70%+ LTV",
        body: `Higher LTV options need ${reasons.join(" and ")}. Add HUDs from past closings or your owned properties to your investor profile.`,
        ctaLabel: "Open Vault",
        ctaTarget: "vault",
      },
    };
  }

  // Full eligibility — 60–75% LTV unlocked.
  return {
    tier: "pro",
    maxLTV: 0.75,
    allowedLTVs: ALL_LTVS,
    allLTVs: ALL_LTVS,
    banner: null,
  };
}

// ── Pricing math ────────────────────────────────────────────────────────────

export interface SimulatorInputs {
  arv: number;
  ltv: number;          // 0–1
  discountPoints: number; // 0–2 (percent, where 1 == 1.00 pt)
  productKey: "dscr" | "ff" | "gu" | "br";
  // Optional override — when the caller has fetched today's rate from FRED
  // (index + lender spread) we use it instead of the hardcoded fallback.
  // Expressed as a percentage (e.g. 7.875 == 7.875%).
  baseRatePct?: number;
}

export interface SimulatorOutputs {
  loanAmount: number;
  rate: number;          // decimal — e.g. 0.0875
  monthlyPI: number;
  termMonths: number;
  isAmortized: boolean;
  // DSCR-only — null otherwise
  rentEstimate: number | null;
  dscr: number | null;
  cashFlow: number | null;
  // HUD-1 totals
  pointsCost: number;
  origination: number;
  fixedFees: number;
  titleIns: number;
  recording: number;
  appraisal: number;
  totalToClose: number;
}

const PRODUCT_BASE_RATE: Record<SimulatorInputs["productKey"], number> = {
  dscr: 7.375,
  ff:   9.625,
  gu:   10.250,
  br:   8.875,
};

const PRODUCT_TERM_MONTHS: Record<SimulatorInputs["productKey"], number> = {
  dscr: 360, // 30y amortized
  ff:   12,  // interest-only
  gu:   18,
  br:   24,
};

export function computeSimulator({ arv, ltv, discountPoints, productKey, baseRatePct }: SimulatorInputs): SimulatorOutputs {
  const loanAmount = arv * ltv;
  const basePct = baseRatePct ?? PRODUCT_BASE_RATE[productKey];
  const rate = (basePct - discountPoints * 0.25) / 100;
  const monthlyRate = rate / 12;
  const termMonths = PRODUCT_TERM_MONTHS[productKey];
  const isAmortized = productKey === "dscr";

  const monthlyPI = isAmortized
    ? (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
    : loanAmount * monthlyRate;

  // DSCR rent / cash-flow estimates
  let rentEstimate: number | null = null;
  let dscr: number | null = null;
  let cashFlow: number | null = null;
  if (isAmortized) {
    rentEstimate = loanAmount * 0.0085;
    const taxIns = rentEstimate * 0.18;
    cashFlow = rentEstimate - monthlyPI - taxIns;
    dscr = rentEstimate / (monthlyPI + taxIns);
  }

  // HUD-1 line items
  const pointsCost = loanAmount * (discountPoints / 100);
  const origination = loanAmount * 0.0075;
  const processing = 1495;
  const underwriting = 995;
  const titleIns = loanAmount * 0.005;
  const recording = 285;
  const appraisal = 650;
  const fixedFees = processing + underwriting;
  const totalToClose = pointsCost + origination + processing + underwriting + titleIns + recording + appraisal;

  return {
    loanAmount,
    rate,
    monthlyPI,
    termMonths,
    isAmortized,
    rentEstimate,
    dscr,
    cashFlow,
    pointsCost,
    origination,
    fixedFees,
    titleIns,
    recording,
    appraisal,
    totalToClose,
  };
}

export function ltvLabel(ltv: number): string {
  if (Math.abs(ltv - 0.75) < 0.001) return "Best case";
  if (Math.abs(ltv - 0.7) < 0.001) return "Strong";
  if (Math.abs(ltv - 0.65) < 0.001) return "Standard";
  if (Math.abs(ltv - 0.6) < 0.001) return "Conservative";
  return `${(ltv * 100).toFixed(0)}% LTV`;
}
