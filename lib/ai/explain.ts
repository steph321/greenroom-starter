/**
 * Human-readable formatting of interpretation results (UI / memo).
 */

import type { DealInterpretationResult, FieldConfidence, ConfidenceLevel } from "./types";

const FIELD_LABELS: Record<string, string> = {
  structure: "Deal structure",
  guaranteeAmount: "Guarantee",
  artistPercentage: "Artist share",
  percentageBasis: "% basis",
  expenseCap: "Expense cap",
  hospitalityCap: "Hospitality cap",
  marketingRecoupAmount: "Marketing recoup",
  recoupStacking: "Recoup stacking",
  feesDeductedFrom: "Fees deducted from",
};

export function formatConfidenceBadge(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "High confidence";
    case "medium":
      return "Review warnings";
    case "low":
      return "Resolve blockers first";
  }
}

export function formatFieldConfidenceSummary(
  fieldConfidence: Partial<Record<string, FieldConfidence>>,
): { label: string; level: ConfidenceLevel; note?: string }[] {
  return Object.entries(fieldConfidence).map(([key, fc]) => ({
    label: FIELD_LABELS[key] ?? key,
    level: fc!.level,
    note: fc!.note,
  }));
}

export function formatInterpretationBrief(
  result: DealInterpretationResult,
): string {
  const lines: string[] = [];
  lines.push(result.confidenceSummary);
  lines.push("");
  const c = result.proposedCanon;
  if (c.structure === "vs" && c.guaranteeAmount != null && c.artistPercentage != null) {
    lines.push(
      `Proposed: $${c.guaranteeAmount.toLocaleString()} vs ${(c.artistPercentage * 100).toFixed(0)}% of ${c.percentageBasis ?? "net"}, whichever is greater.`,
    );
  }
  if (c.expenseCap != null) {
    lines.push(`Expense cap: $${c.expenseCap.toLocaleString()}.`);
  }
  if (c.marketingRecoupAmount != null) {
    lines.push(
      `Marketing recoup: $${c.marketingRecoupAmount.toLocaleString()} (${stackingLabel(c.recoupStacking)}).`,
    );
  }
  if (result.discrepancies.length > 0) {
    lines.push("");
    lines.push("Checks:");
    for (const d of result.discrepancies) {
      lines.push(`• [${d.severity}] ${d.title}: ${d.body}`);
    }
  }
  return lines.join("\n");
}

function stackingLabel(s: string): string {
  switch (s) {
    case "inside_expense_cap":
      return "inside expense cap";
    case "deducted_before_net":
      return "deducted before net, like fees";
    case "ambiguous_unset":
      return "stacking not chosen — ambiguous";
    default:
      return "none";
  }
}
