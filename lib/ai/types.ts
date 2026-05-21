/**
 * Deal interpretation schema — settlement confidence review (Phase 4).
 * AI proposes; humans confirm; code calculates payouts.
 */

import type { Deal } from "@/db/schema";

/** How marketing / venue recoup affects the waterfall */
export type RecoupStacking =
  | "none"
  | "inside_expense_cap"
  | "deducted_before_net"
  | "ambiguous_unset";

export type DealStructure =
  | "flat"
  | "percentage_of_gross"
  | "percentage_of_net"
  | "vs"
  | "door"
  | "unclear";

export type ConfidenceLevel = "high" | "medium" | "low";

export type DiscrepancySeverity = "blocking" | "warning" | "info";

export type InterpretationSource = "prose" | "structured" | "inferred" | "merged";

/** Per-field confidence for explainability */
export type FieldConfidence = {
  level: ConfidenceLevel;
  sources: InterpretationSource[];
  /** Plain-language note for Mariana */
  note?: string;
};

/** Canon used for deterministic math after human confirm */
export type DealCanon = {
  structure: DealStructure;
  guaranteeAmount: number | null;
  artistPercentage: number | null;
  percentageBasis: "gross" | "net" | null;
  expenseCap: number | null;
  hospitalityCap: number | null;
  marketingRecoupAmount: number | null;
  recoupStacking: RecoupStacking;
  feesDeductedFrom: "gross";
};

/** Raw extraction from prose only (before merge) */
export type ProseExtraction = {
  structure: DealStructure | null;
  guaranteeAmount: number | null;
  artistPercentage: number | null;
  percentageBasis: "gross" | "net" | null;
  expenseCap: number | null;
  hospitalityCap: number | null;
  marketingRecoupAmount: number | null;
  recoupStackingHint: RecoupStacking | null;
  matchedPhrases: string[];
};

export type Discrepancy = {
  id: string;
  severity: DiscrepancySeverity;
  title: string;
  body: string;
  /** Canon field keys this affects */
  fieldKeys?: (keyof DealCanon)[];
  /** Suggested resolution copy */
  suggestedAction?: string;
};

export type AmbiguityFlag = {
  id: string;
  clause: string;
  question: string;
  impact: string;
  /** e.g. Coastal Spell dual outcomes */
  financialImpact?: string;
};

export type DealInterpretationResult = {
  proposedCanon: DealCanon;
  fieldConfidence: Partial<Record<keyof DealCanon, FieldConfidence>>;
  overallConfidence: ConfidenceLevel;
  confidenceSummary: string;
  discrepancies: Discrepancy[];
  ambiguities: AmbiguityFlag[];
  /** Human-readable audit trail */
  extractionNotes: string[];
  unsupportedClauses: string[];
  proseExtraction: ProseExtraction;
  /** rules = deterministic; llm = optional enhancement attempted */
  interpreterMode: "rules" | "rules+llm" | "rules_only_degraded";
  generatedAt: string;
};

export type InterpretDealInput = {
  deal: Deal;
  /** Optional operational context for checks */
  hospitalityExpenseTotal?: number;
  marketingExpenseTotal?: number;
  hasDisputedSettlement?: boolean;
  positiveTmSignoff?: boolean;
};

export type StructuredDealSnapshot = {
  dealType: Deal["dealType"];
  guaranteeAmount: number | null;
  percentage: number | null;
  percentageBasis: Deal["percentageBasis"];
  expenseCap: number | null;
  hospitalityCap: number | null;
  bonusesJson: string | null;
};
