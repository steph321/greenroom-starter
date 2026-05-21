/**
 * Aggregate field-level confidence into overall settlement confidence.
 */

import type {
  AmbiguityFlag,
  ConfidenceLevel,
  DealCanon,
  Discrepancy,
  FieldConfidence,
} from "./types";

export function scoreOverallConfidence(
  fieldConfidence: Partial<Record<keyof DealCanon, FieldConfidence>>,
  discrepancies: Discrepancy[],
  ambiguities: AmbiguityFlag[],
  unsupportedClauses: string[],
  hasDealNotes: boolean,
): { level: ConfidenceLevel; summary: string } {
  const blocking = discrepancies.filter((d) => d.severity === "blocking").length;
  const warnings = discrepancies.filter((d) => d.severity === "warning").length;

  const lowFields = Object.values(fieldConfidence).filter(
    (f) => f?.level === "low",
  ).length;

  if (!hasDealNotes) {
    return {
      level: "low",
      summary:
        "No deal notes on file — interpretation relies on booking form only. Add agent deal language before settling.",
    };
  }

  if (blocking > 0) {
    return {
      level: "low",
      summary: `${blocking} blocking issue${blocking === 1 ? "" : "s"} must be resolved before walking the tour manager through totals.`,
    };
  }

  if (
    ambiguities.some((a) => a.id === "recoup_stacking") ||
    lowFields >= 2
  ) {
    return {
      level: "low",
      summary:
        "Deal terms need explicit choices (especially recoup stacking) before this settlement is defensible.",
    };
  }

  if (warnings > 0 || unsupportedClauses.length > 0 || lowFields === 1) {
    return {
      level: "medium",
      summary: `${warnings + unsupportedClauses.length} warning${warnings + unsupportedClauses.length === 1 ? "" : "s"} — review before the back office, but you can proceed if you’ve confirmed with the agent.`,
    };
  }

  const allHigh = Object.values(fieldConfidence).every(
    (f) => !f || f.level === "high",
  );
  if (allHigh && ambiguities.length === 0) {
    return {
      level: "high",
      summary:
        "Notes and booking fields align. Confirm interpretation to lock the record for tonight.",
    };
  }

  return {
    level: "medium",
    summary:
      "Most terms are clear — skim checks below before settling with the tour manager.",
  };
}

export function buildExtractionNotes(
  proseMatched: string[],
  mode: string,
): string[] {
  const notes: string[] = [];
  if (proseMatched.length > 0) {
    notes.push(
      `From deal notes (${mode}): detected ${proseMatched.join("; ")}.`,
    );
  } else {
    notes.push(
      "Could not parse specific terms from deal notes — using booking form values where present.",
    );
  }
  notes.push(
    "This is a draft interpretation, not a final settlement. Confirm before showing totals to the artist team.",
  );
  return notes;
}
