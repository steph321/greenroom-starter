/**
 * Deterministic payout waterfall from confirmed DealCanon.
 */

import type { DealCanon, RecoupStacking } from "@/lib/ai/types";
import type { Expense } from "@/db/schema";
import type { WaterfallResult, WaterfallStep, VsResolution } from "./types";

export type WaterfallInput = {
  canon: DealCanon;
  grossBoxOffice: number;
  totalFees: number;
  expenses: Expense[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumPassThru(expenses: Expense[]): number {
  return expenses
    .filter((e) => !e.absorbedByVenue)
    .reduce((s, e) => s + e.amount, 0);
}

function sumAbsorbed(expenses: Expense[]): number {
  return expenses
    .filter((e) => e.absorbedByVenue)
    .reduce((s, e) => s + e.amount, 0);
}

export function calculateWaterfall(input: WaterfallInput): WaterfallResult {
  const { canon, grossBoxOffice, totalFees, expenses } = input;
  const gross = grossBoxOffice;
  const fees = totalFees;
  const passThruRaw = sumPassThru(expenses);
  const recoupAmt = canon.marketingRecoupAmount ?? 0;
  const cap = canon.expenseCap ?? Infinity;

  if (canon.recoupStacking === "ambiguous_unset" && recoupAmt > 0) {
    return {
      ok: false,
      reason:
        "Marketing recoup stacking is not confirmed. Choose inside expense cap or deducted before net before calculating.",
    };
  }

  if (canon.structure === "unclear") {
    return { ok: false, reason: "Deal structure is not confirmed." };
  }

  const steps: WaterfallStep[] = [];
  let running = gross;

  steps.push({
    id: "gross",
    label: "Gross box office (reported sales)",
    amount: gross,
    effect: 0,
    runningBalance: running,
    note: "Per venue ticketing.",
  });

  running = round2(running - fees);
  steps.push({
    id: "fees",
    label: "Credit card & platform fees",
    amount: -fees,
    effect: -fees,
    runningBalance: running,
    note: "Deducted from gross per standard settlement.",
  });

  let expensesApplied = 0;
  let marketingRecoupApplied = 0;

  if (recoupAmt > 0 && canon.recoupStacking === "deducted_before_net") {
    running = round2(running - recoupAmt);
    marketingRecoupApplied = recoupAmt;
    steps.push({
      id: "recoup_before_net",
      label: "Marketing recoup (deducted before expenses)",
      amount: -recoupAmt,
      effect: -recoupAmt,
      runningBalance: running,
      note: "Taken off after fees, before the expense cap is applied.",
    });
    // Venue read when recoup is outside cap: apply full expense cap to net pool (Coastal Spell / Mariana)
    if (passThruRaw < cap && Number.isFinite(cap)) {
      expensesApplied = round2(cap);
    } else {
      expensesApplied = round2(Math.min(passThruRaw, cap));
    }
    running = round2(running - expensesApplied);
    steps.push({
      id: "expenses",
      label: `Expense cap applied (${fmtCap(cap)})`,
      amount: -expensesApplied,
      effect: -expensesApplied,
      runningBalance: running,
      note:
        passThruRaw < cap
          ? `Receipts total ${fmt(passThruRaw)}; cap ${fmt(cap)} applied per venue settlement of this deal.`
          : passThruRaw > cap
            ? `Receipts ${fmt(passThruRaw)} limited to cap.`
            : "Sound, lights, hospitality, production, etc.",
    });
  } else if (recoupAmt > 0 && canon.recoupStacking === "inside_expense_cap") {
    const bundled = round2(Math.min(passThruRaw + recoupAmt, cap));
    expensesApplied = bundled;
    marketingRecoupApplied = recoupAmt;
    running = round2(running - bundled);
    steps.push({
      id: "expenses_with_recoup",
      label: `Show expenses + marketing recoup (capped at ${fmtCap(cap)})`,
      amount: -bundled,
      effect: -bundled,
      runningBalance: running,
      note: `Includes $${recoupAmt.toLocaleString()} marketing recoup inside the expense cap.`,
    });
  } else {
    expensesApplied = round2(Math.min(passThruRaw, cap));
    running = round2(running - expensesApplied);
    steps.push({
      id: "expenses",
      label: `Show expenses (capped at ${fmtCap(cap)})`,
      amount: -expensesApplied,
      effect: -expensesApplied,
      runningBalance: running,
    });
  }

  const netBeforeArtistShare = running;
  const absorbed = sumAbsorbed(expenses);
  if (absorbed > 0) {
    steps.push({
      id: "absorbed_note",
      label: "Venue-absorbed costs (not charged to artist)",
      amount: 0,
      effect: 0,
      note: `$${absorbed.toLocaleString()} absorbed by the venue — not in the deduction stack above.`,
    });
  }

  let totalToArtist = 0;
  let vsResolution: VsResolution | undefined;
  let bonusAmount = 0;

  switch (canon.structure) {
    case "flat": {
      totalToArtist = canon.guaranteeAmount ?? 0;
      steps.push({
        id: "flat",
        label: "Flat guarantee",
        amount: totalToArtist,
        effect: totalToArtist,
        runningBalance: totalToArtist,
        note: "No vs comparison.",
      });
      break;
    }
    case "percentage_of_gross": {
      const pct = canon.artistPercentage ?? 0;
      totalToArtist = round2(gross * pct);
      steps.push({
        id: "pct_gross",
        label: `${pctLabel(pct)} of gross`,
        amount: totalToArtist,
        effect: totalToArtist,
        runningBalance: totalToArtist,
      });
      break;
    }
    case "percentage_of_net": {
      const pct = canon.artistPercentage ?? 0;
      totalToArtist = round2(netBeforeArtistShare * pct);
      steps.push({
        id: "pct_net",
        label: `${pctLabel(pct)} of net after deductions`,
        amount: totalToArtist,
        effect: totalToArtist,
        runningBalance: totalToArtist,
      });
      break;
    }
    case "vs": {
      const pct = canon.artistPercentage ?? 0;
      const guarantee = canon.guaranteeAmount ?? 0;
      const pctPayout = round2(netBeforeArtistShare * pct);
      const winner: "guarantee" | "percentage" =
        pctPayout >= guarantee ? "percentage" : "guarantee";
      totalToArtist = Math.max(guarantee, pctPayout);

      vsResolution = {
        guaranteePayout: guarantee,
        percentagePayout: pctPayout,
        winner,
        guaranteeAmount: guarantee,
        artistPercentage: pct,
      };

      steps.push({
        id: "pct_side",
        label: `${pctLabel(pct)} of net (${fmt(netBeforeArtistShare)} × ${pctLabel(pct)})`,
        amount: pctPayout,
        effect: 0,
        note: "Percentage side of vs deal.",
      });
      steps.push({
        id: "guarantee_side",
        label: `Guarantee`,
        amount: guarantee,
        effect: 0,
        note: "Guarantee side of vs deal.",
      });
      steps.push({
        id: "vs_winner",
        label:
          winner === "percentage"
            ? "Vs result — percentage exceeds guarantee"
            : "Vs result — guarantee exceeds percentage",
        amount: totalToArtist,
        effect: totalToArtist - Math.min(guarantee, pctPayout),
        runningBalance: totalToArtist,
        note: `Artist receives the greater of the two: ${fmt(totalToArtist)}.`,
      });
      break;
    }
    case "door": {
      totalToArtist = netBeforeArtistShare;
      steps.push({
        id: "door",
        label: "Door deal — net after deductions to artist",
        amount: totalToArtist,
        effect: totalToArtist,
        runningBalance: totalToArtist,
      });
      break;
    }
    default:
      return { ok: false, reason: `Unsupported structure: ${canon.structure}` };
  }

  const finalFormula =
    vsResolution != null
      ? `max(guarantee ${fmt(vsResolution.guaranteeAmount)}, ${pctLabel(vsResolution.artistPercentage)} × net) = ${fmt(totalToArtist)}`
      : `total to artist = ${fmt(totalToArtist)}`;

  return {
    ok: true,
    grossBoxOffice: gross,
    totalFees: fees,
    passThruExpensesRaw: passThruRaw,
    expensesApplied,
    marketingRecoupApplied,
    netBeforeArtistShare,
    totalToArtist: round2(totalToArtist + bonusAmount),
    steps,
    vsResolution,
    bonusAmount,
    recoupStacking: canon.recoupStacking,
    finalFormula,
  };
}

/** Preview alternate recoup stacking without changing canon (Coastal Spell). */
export function calculateWaterfallWithStacking(
  input: WaterfallInput,
  stacking: RecoupStacking,
): WaterfallResult {
  return calculateWaterfall({
    ...input,
    canon: { ...input.canon, recoupStacking: stacking },
  });
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtCap(cap: number): string {
  return Number.isFinite(cap) ? fmt(cap) : "no cap";
}

function pctLabel(p: number): string {
  return `${(p * 100).toFixed(0)}%`;
}
