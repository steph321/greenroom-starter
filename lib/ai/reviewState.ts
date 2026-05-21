/**
 * Recompute checks + confidence when Mariana edits canon on the client.
 */

import type { Deal } from "@/db/schema";
import type { DealCanon, DealInterpretationResult } from "./types";
import { extractFromProse } from "./extractFromProse";
import { buildDiscrepancies } from "./discrepancies";
import { scoreOverallConfidence } from "./confidence";

export function computeReviewState(
  deal: Deal,
  canon: DealCanon,
  ctx?: {
    hospitalityExpenseTotal?: number;
    marketingExpenseTotal?: number;
    hasDisputedSettlement?: boolean;
    positiveTmSignoff?: boolean;
  },
): Pick<
  DealInterpretationResult,
  "discrepancies" | "ambiguities" | "overallConfidence" | "confidenceSummary"
> {
  const prose = extractFromProse(deal.dealNotesFreetext);
  const { discrepancies, ambiguities } = buildDiscrepancies(
    deal,
    prose,
    canon,
    ctx,
  );
  const { level, summary } = scoreOverallConfidence(
    {},
    discrepancies,
    ambiguities,
    [],
    Boolean(deal.dealNotesFreetext?.trim()),
  );
  return {
    discrepancies,
    ambiguities,
    overallConfidence: level,
    confidenceSummary: summary,
  };
}
