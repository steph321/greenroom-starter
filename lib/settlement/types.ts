/**
 * Settlement waterfall + explanation types (Phase 4/5).
 */

import type { DealCanon, RecoupStacking } from "@/lib/ai/types";
import type { Expense, Recoup } from "@/db/schema";

export type WaterfallStep = {
  id: string;
  label: string;
  amount: number;
  /** Signed effect on running balance toward artist % (negative = deduction) */
  effect: number;
  runningBalance?: number;
  note?: string;
};

export type VsResolution = {
  guaranteePayout: number;
  percentagePayout: number;
  winner: "guarantee" | "percentage";
  guaranteeAmount: number;
  artistPercentage: number;
};

export type WaterfallResult =
  | {
      ok: true;
      grossBoxOffice: number;
      totalFees: number;
      passThruExpensesRaw: number;
      expensesApplied: number;
      marketingRecoupApplied: number;
      netBeforeArtistShare: number;
      totalToArtist: number;
      steps: WaterfallStep[];
      vsResolution?: VsResolution;
      bonusAmount: number;
      recoupStacking: RecoupStacking;
      finalFormula: string;
    }
  | {
      ok: false;
      reason: string;
    };

export type ExplanationFlag = {
  kind: "disputed" | "ambiguous" | "absorbed" | "caution";
  text: string;
};

export type SettlementExplanation = {
  totalToArtist: number;
  /** One paragraph for the back office read-aloud */
  openingSummary: string;
  /** Confirmed deal terms, plain language */
  dealTermsLine: string;
  steps: WaterfallStep[];
  vsResolution?: VsResolution;
  flags: ExplanationFlag[];
  /** Short bullets for TM questions */
  footnotes: string[];
  /** Full walkthrough — venue ops tone */
  bodyMarkdown: string;
  /** Monday agent email style */
  agentStatementMarkdown: string;
};

export type ExplainSettlementInput = {
  canon: DealCanon;
  grossBoxOffice: number;
  totalFees: number;
  expenses: Expense[];
  recoups?: Recoup[];
  /** From interpretation layer */
  ambiguities?: { question: string }[];
  artistName?: string;
  showDate?: string;
  venueName?: string;
};
