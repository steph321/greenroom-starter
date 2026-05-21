/**
 * Compare prose extraction + canon vs structured booking fields and ops context.
 */

import { parseBonuses } from "@/lib/dealMath";
import type { Deal } from "@/db/schema";
import type {
  AmbiguityFlag,
  DealCanon,
  Discrepancy,
  ProseExtraction,
} from "./types";

const TOL_PCT = 0.011;
const TOL_MONEY = 1;

export function buildDiscrepancies(
  deal: Deal,
  prose: ProseExtraction,
  canon: DealCanon,
  ctx?: {
    hospitalityExpenseTotal?: number;
    marketingExpenseTotal?: number;
    hasDisputedSettlement?: boolean;
    positiveTmSignoff?: boolean;
  },
): { discrepancies: Discrepancy[]; ambiguities: AmbiguityFlag[] } {
  const discrepancies: Discrepancy[] = [];
  const ambiguities: AmbiguityFlag[] = [];
  const notes = deal.dealNotesFreetext ?? "";

  // BC9-style: prose Vs, structured % of net
  if (
    prose.structure === "vs" &&
    deal.dealType === "percentage_of_net" &&
    /guarantee\s+vs|whichever\s+greater/i.test(notes)
  ) {
    discrepancies.push({
      id: "deal_type_vs_mismatch",
      severity: "blocking",
      title: "Booking form doesn’t match deal notes",
      body: `Notes describe a guarantee vs % deal; the booking form is set to percentage of net only.`,
      fieldKeys: ["structure"],
      suggestedAction: "Use Vs structure for tonight’s math.",
    });
  }

  // Structure mismatch (general)
  if (
    prose.structure &&
    prose.structure !== deal.dealType &&
    prose.structure !== "unclear" &&
    !discrepancies.some((d) => d.id === "deal_type_vs_mismatch")
  ) {
    discrepancies.push({
      id: "deal_type_drift",
      severity: "blocking",
      title: "Deal type differs from notes",
      body: `Notes suggest ${prose.structure}; booking form says ${deal.dealType}.`,
      fieldKeys: ["structure"],
      suggestedAction: `Confirm which structure applies.`,
    });
  }

  // BC6: 85/15 in prose vs 0.75 structured
  const splitMatch = notes.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*(?:split|of\s+net)/i);
  if (splitMatch && deal.percentage != null) {
    const prosePct = parseInt(splitMatch[1], 10) / parseInt(splitMatch[2], 10);
    if (Math.abs(prosePct - deal.percentage) > TOL_PCT) {
      discrepancies.push({
        id: "percentage_renegotiation",
        severity: "blocking",
        title: "Artist percentage doesn’t match booking form",
        body: `Notes say ${splitMatch[1]}/${splitMatch[2]} (${(prosePct * 100).toFixed(0)}% to artist); form has ${(deal.percentage * 100).toFixed(0)}%.`,
        fieldKeys: ["artistPercentage"],
        suggestedAction: "Confirm renegotiated % before settling.",
      });
    }
  }

  if (
    prose.artistPercentage != null &&
    deal.percentage != null &&
    Math.abs(prose.artistPercentage - deal.percentage) > TOL_PCT &&
    !discrepancies.some((d) => d.id === "percentage_renegotiation")
  ) {
    discrepancies.push({
      id: "percentage_drift",
      severity: "blocking",
      title: "Percentage mismatch",
      body: `Notes imply ${(prose.artistPercentage * 100).toFixed(0)}%; form has ${(deal.percentage * 100).toFixed(0)}%.`,
      fieldKeys: ["artistPercentage"],
    });
  }

  if (
    prose.guaranteeAmount != null &&
    deal.guaranteeAmount != null &&
    Math.abs(prose.guaranteeAmount - deal.guaranteeAmount) > TOL_MONEY
  ) {
    discrepancies.push({
      id: "guarantee_drift",
      severity: "warning",
      title: "Guarantee amount mismatch",
      body: `Notes: $${prose.guaranteeAmount.toLocaleString()} vs form: $${deal.guaranteeAmount.toLocaleString()}.`,
      fieldKeys: ["guaranteeAmount"],
    });
  }

  if (
    prose.expenseCap != null &&
    deal.expenseCap != null &&
    Math.abs(prose.expenseCap - deal.expenseCap) > TOL_MONEY
  ) {
    discrepancies.push({
      id: "expense_cap_drift",
      severity: "warning",
      title: "Expense cap mismatch",
      body: `Notes: $${prose.expenseCap.toLocaleString()} vs form: $${deal.expenseCap.toLocaleString()}.`,
      fieldKeys: ["expenseCap"],
    });
  }

  // BC2: explicit stale structured warning in prose
  if (/structured field still reflects|confirm before settlement/i.test(notes)) {
    discrepancies.push({
      id: "stale_structured_warning",
      severity: "warning",
      title: "Deal notes flag outdated booking fields",
      body: `Mariana left a note that structured fields may be wrong — trust the notes or reconfirm with the agent.`,
      suggestedAction: "Call agent or use prose values.",
    });
  }

  // Bonus threshold drift
  const bonuses = parseBonuses(deal);
  const thresholdInNotes = notes.match(/(?:threshold|over)\s+\$?\s*([\d,]+)/i);
  if (bonuses.length > 0 && bonuses[0].type === "gross_threshold" && thresholdInNotes) {
    const proseThreshold = parseFloat(thresholdInNotes[1].replace(/,/g, ""));
    const jsonThreshold = bonuses[0].threshold;
    if (
      Number.isFinite(proseThreshold) &&
      Math.abs(proseThreshold - jsonThreshold) > 500
    ) {
      discrepancies.push({
        id: "bonus_threshold_drift",
        severity: "warning",
        title: "Bonus threshold may be outdated",
        body: `Notes mention $${proseThreshold.toLocaleString()}; bonuses_json has $${jsonThreshold.toLocaleString()}.`,
        suggestedAction: "Confirm which threshold triggers the bonus.",
      });
    }
  }

  // Double-count marketing
  if (
    (ctx?.marketingExpenseTotal ?? 0) > 0 &&
    (canon.marketingRecoupAmount ?? 0) > 0
  ) {
    discrepancies.push({
      id: "marketing_double_count",
      severity: "warning",
      title: "Marketing in expenses and as recoup",
      body: `This show has $${ctx!.marketingExpenseTotal!.toLocaleString()} in marketing expenses and a $${canon.marketingRecoupAmount!.toLocaleString()} recoup line — avoid deducting twice.`,
      fieldKeys: ["marketingRecoupAmount"],
    });
  }

  // Hospitality over cap
  if (
    deal.hospitalityCap != null &&
    ctx?.hospitalityExpenseTotal != null &&
    ctx.hospitalityExpenseTotal > deal.hospitalityCap
  ) {
    discrepancies.push({
      id: "hospitality_over_cap",
      severity: "warning",
      title: "Hospitality over cap",
      body: `Spent $${ctx.hospitalityExpenseTotal.toLocaleString()} vs $${deal.hospitalityCap.toLocaleString()} cap — decide absorb vs pass-through before TM conversation.`,
      fieldKeys: ["hospitalityCap"],
    });
  }

  // BC1 trust
  if (ctx?.hasDisputedSettlement && ctx?.positiveTmSignoff) {
    discrepancies.push({
      id: "signoff_vs_disputed",
      severity: "info",
      title: "Tour manager signed off; settlement marked disputed",
      body: `Night-of agreement may not match the agent’s Monday review — read settlement notes.`,
    });
  }

  // Recoup stacking ambiguity → ambiguity flag (Coastal class)
  if (
    canon.marketingRecoupAmount != null &&
    canon.marketingRecoupAmount > 0 &&
    canon.recoupStacking === "ambiguous_unset"
  ) {
    ambiguities.push({
      id: "recoup_stacking",
      clause: notes.match(/marketing\s+recoup[^.]{0,80}/i)?.[0] ?? "marketing recoup language",
      question: "Is the marketing recoup inside the expense cap, or deducted from gross before expenses (like fees)?",
      impact: "Changes net and artist % payout.",
      financialImpact:
        "At typical Crescent scale, the difference is often $500–$1,000+ per show (see Coastal Spell: $720).",
    });
    discrepancies.push({
      id: "recoup_stacking_unset",
      severity: "blocking",
      title: "Marketing recoup stacking not chosen",
      body: `Deal mentions a $${canon.marketingRecoupAmount.toLocaleString()} marketing recoup but not whether it sits inside the expense cap or comes off gross first.`,
      fieldKeys: ["recoupStacking"],
      suggestedAction: "Pick a stacking rule or confirm with agent before settling.",
    });
  }

  if (/ambiguous|either way|can be read/i.test(notes) && /recoup/i.test(notes)) {
    ambiguities.push({
      id: "historical_recoup_dispute",
      clause: "Prior dispute noted in deal notes",
      question: "Has this recoup interpretation been resolved with the agent since the show?",
      impact: "Avoid repeating Coastal Spell–style concessions.",
    });
  }

  return { discrepancies, ambiguities };
}
