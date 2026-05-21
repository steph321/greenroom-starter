/**
 * Main entry: interpret a deal for settlement confidence review.
 */

import { extractFromProse } from "./extractFromProse";
import { mergeToCanon } from "./mergeCanon";
import { buildDiscrepancies } from "./discrepancies";
import { scoreOverallConfidence, buildExtractionNotes } from "./confidence";
import { tryLlmEnhance } from "./llmEnhance";
import { detectUnsupported } from "./extractFromProse";
import type { DealInterpretationResult, InterpretDealInput } from "./types";

export type { DealInterpretationResult, DealCanon, InterpretDealInput } from "./types";
export { extractFromProse } from "./extractFromProse";

export async function interpretDeal(
  input: InterpretDealInput,
): Promise<DealInterpretationResult> {
  const { deal } = input;
  const notes = deal.dealNotesFreetext ?? "";

  const proseExtraction = extractFromProse(notes);
  const unsupportedClauses = detectUnsupported(notes);

  const { canon: proposedCanon, fieldConfidence } = mergeToCanon(
    deal,
    proseExtraction,
  );

  const { discrepancies, ambiguities } = buildDiscrepancies(
    deal,
    proseExtraction,
    proposedCanon,
    {
      hospitalityExpenseTotal: input.hospitalityExpenseTotal,
      marketingExpenseTotal: input.marketingExpenseTotal,
      hasDisputedSettlement: input.hasDisputedSettlement,
      positiveTmSignoff: input.positiveTmSignoff,
    },
  );

  let interpreterMode: DealInterpretationResult["interpreterMode"] = "rules";
  const extractionNotes = buildExtractionNotes(
    proseExtraction.matchedPhrases,
    "rules",
  );

  const llm = await tryLlmEnhance(notes, proseExtraction, proposedCanon);
  if (llm.applied && llm.rationale) {
    extractionNotes.push(`AI review (optional): ${llm.rationale}`);
    interpreterMode = "rules+llm";
  } else if (process.env.OPENAI_API_KEY && llm.error) {
    extractionNotes.push(
      `AI review unavailable (${llm.error}) — showing rules-only interpretation.`,
    );
    interpreterMode = "rules_only_degraded";
  }

  if (unsupportedClauses.length > 0) {
    extractionNotes.push(
      `Not modeled in v1: ${unsupportedClauses.join(", ")} — use spreadsheet for those mechanics.`,
    );
  }

  const { level: overallConfidence, summary: confidenceSummary } =
    scoreOverallConfidence(
      fieldConfidence,
      discrepancies,
      ambiguities,
      unsupportedClauses,
      notes.length > 0,
    );

  return {
    proposedCanon,
    fieldConfidence,
    overallConfidence,
    confidenceSummary,
    discrepancies,
    ambiguities,
    extractionNotes,
    unsupportedClauses,
    proseExtraction,
    interpreterMode,
    generatedAt: new Date().toISOString(),
  };
}

/** Synchronous rules-only path (tests, no network) */
export function interpretDealSync(
  input: InterpretDealInput,
): DealInterpretationResult {
  const { deal } = input;
  const notes = deal.dealNotesFreetext ?? "";
  const proseExtraction = extractFromProse(notes);
  const unsupportedClauses = detectUnsupported(notes);
  const { canon: proposedCanon, fieldConfidence } = mergeToCanon(
    deal,
    proseExtraction,
  );
  const { discrepancies, ambiguities } = buildDiscrepancies(
    deal,
    proseExtraction,
    proposedCanon,
    {
      hospitalityExpenseTotal: input.hospitalityExpenseTotal,
      marketingExpenseTotal: input.marketingExpenseTotal,
      hasDisputedSettlement: input.hasDisputedSettlement,
      positiveTmSignoff: input.positiveTmSignoff,
    },
  );
  const extractionNotes = buildExtractionNotes(
    proseExtraction.matchedPhrases,
    "rules",
  );
  if (unsupportedClauses.length > 0) {
    extractionNotes.push(
      `Not modeled in v1: ${unsupportedClauses.join(", ")}.`,
    );
  }
  const { level: overallConfidence, summary: confidenceSummary } =
    scoreOverallConfidence(
      fieldConfidence,
      discrepancies,
      ambiguities,
      unsupportedClauses,
      notes.length > 0,
    );
  return {
    proposedCanon,
    fieldConfidence,
    overallConfidence,
    confidenceSummary,
    discrepancies,
    ambiguities,
    extractionNotes,
    unsupportedClauses,
    proseExtraction,
    interpreterMode: "rules",
    generatedAt: new Date().toISOString(),
  };
}
