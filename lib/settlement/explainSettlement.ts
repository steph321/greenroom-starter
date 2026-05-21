/**
 * Settlement explanation generator — venue operations tone.
 * Template-driven from deterministic waterfall; no marketing fluff.
 */

import { formatMoney } from "@/lib/format";
import type { Expense, Recoup } from "@/db/schema";
import { calculateWaterfall, calculateWaterfallWithStacking } from "./waterfall";
import type {
  ExplainSettlementInput,
  ExplanationFlag,
  SettlementExplanation,
  WaterfallStep,
} from "./types";

const EXPENSE_LABELS: Record<string, string> = {
  production: "Production",
  sound: "Sound",
  lights: "Lights",
  hospitality: "Hospitality",
  marketing: "Marketing",
  backline: "Backline",
  security: "Security",
  other: "Other",
};

export function explainSettlement(
  input: ExplainSettlementInput,
): SettlementExplanation | { error: string } {
  const wf = calculateWaterfall({
    canon: input.canon,
    grossBoxOffice: input.grossBoxOffice,
    totalFees: input.totalFees,
    expenses: input.expenses,
  });

  if (!wf.ok) {
    return { error: wf.reason };
  }

  const flags = buildFlags(input, wf.recoupStacking);
  const vsResolution = wf.vsResolution;
  const dealTermsLine = buildDealTermsLine(input.canon);
  const openingSummary = buildOpeningSummary(input, wf.totalToArtist, vsResolution);
  const footnotes = buildFootnotes(input, wf);
  const bodyMarkdown = buildBodyMarkdown(input, wf, flags, dealTermsLine, openingSummary);
  const agentStatementMarkdown = buildAgentStatement(input, wf, flags, dealTermsLine);

  return {
    totalToArtist: wf.totalToArtist,
    openingSummary,
    dealTermsLine,
    steps: wf.steps,
    vsResolution,
    flags,
    footnotes,
    bodyMarkdown,
    agentStatementMarkdown,
  };
}

/** Side-by-side copy when recoup stacking was ambiguous in the deal */
export function explainRecoupAlternatives(
  input: ExplainSettlementInput,
): { insideCap: SettlementExplanation | { error: string }; beforeNet: SettlementExplanation | { error: string }; delta: number } | null {
  const recoup = input.canon.marketingRecoupAmount ?? 0;
  if (recoup <= 0) return null;

  const inside = explainSettlement({
    ...input,
    canon: { ...input.canon, recoupStacking: "inside_expense_cap" },
  });
  const before = explainSettlement({
    ...input,
    canon: { ...input.canon, recoupStacking: "deducted_before_net" },
  });
  if ("error" in inside || "error" in before) return null;

  return {
    insideCap: inside,
    beforeNet: before,
    delta: round2(inside.totalToArtist - before.totalToArtist),
  };
}

function buildFlags(
  input: ExplainSettlementInput,
  stacking: string,
): ExplanationFlag[] {
  const flags: ExplanationFlag[] = [];

  for (const r of input.recoups ?? []) {
    if (r.status === "disputed") {
      flags.push({
        kind: "disputed",
        text: `${r.label} (${formatMoney(r.amount)}) is flagged disputed on this settlement — resolve with the agent before calling this final.`,
      });
    }
  }

  if (input.canon.recoupStacking === "ambiguous_unset") {
    flags.push({
      kind: "ambiguous",
      text: "Marketing recoup stacking is not confirmed in the deal interpretation.",
    });
  }

  for (const a of input.ambiguities ?? []) {
    flags.push({
      kind: "ambiguous",
      text: a.question,
    });
  }

  const absorbed = input.expenses.filter((e) => e.absorbedByVenue);
  if (absorbed.length > 0) {
    const total = absorbed.reduce((s, e) => s + e.amount, 0);
    flags.push({
      kind: "absorbed",
      text: `The venue absorbed ${formatMoney(total)} in costs — not deducted from the artist total above.`,
    });
  }

  if (stacking === "deducted_before_net" && (input.recoups?.length ?? 0) > 0) {
    flags.push({
      kind: "caution",
      text: "Recoup is deducted before the expense cap. Confirm the tour manager agrees this matches the deal memo.",
    });
  }

  return flags;
}

function buildDealTermsLine(canon: ExplainSettlementInput["canon"]): string {
  if (canon.structure === "vs" && canon.guaranteeAmount != null && canon.artistPercentage != null) {
    const basis = canon.percentageBasis === "gross" ? "gross" : "net after deductions";
    let line = `${formatMoney(canon.guaranteeAmount)} guarantee vs ${pct(canon.artistPercentage)} of ${basis}, whichever is greater.`;
    if (canon.expenseCap != null) {
      line += ` Expenses capped at ${formatMoney(canon.expenseCap)}.`;
    }
    if ((canon.marketingRecoupAmount ?? 0) > 0) {
      line += ` Marketing recoup ${formatMoney(canon.marketingRecoupAmount!)} (${stackingPhrase(canon.recoupStacking)}).`;
    }
    return line;
  }
  return `Deal structure: ${canon.structure.replace(/_/g, " ")} (confirmed for this settlement).`;
}

function buildOpeningSummary(
  input: ExplainSettlementInput,
  total: number,
  vs?: { winner: "guarantee" | "percentage"; guaranteePayout: number; percentagePayout: number },
): string {
  const who = input.artistName ?? "the artist";
  if (vs) {
    const side =
      vs.winner === "percentage"
        ? `the percentage (${formatMoney(vs.percentagePayout)}) beat the ${formatMoney(vs.guaranteePayout)} guarantee`
        : `the guarantee (${formatMoney(vs.guaranteePayout)}) beat the percentage (${formatMoney(vs.percentagePayout)})`;
    return `Tonight's settlement for ${who} is ${formatMoney(total)}. This is a vs deal — ${side}. Below is each deduction from box office and how we got to that number.`;
  }
  return `Tonight's settlement for ${who} is ${formatMoney(total)}. Below is each deduction from box office and how we got to that number.`;
}

function buildFootnotes(
  input: ExplainSettlementInput,
  wf: { passThruExpensesRaw: number; expensesApplied: number; marketingRecoupApplied: number },
): string[] {
  const notes: string[] = [];
  if (wf.passThruExpensesRaw > wf.expensesApplied) {
    notes.push(
      `Passed-through expenses on the books total ${formatMoney(wf.passThruExpensesRaw)}; only ${formatMoney(wf.expensesApplied)} applied against the artist per the expense cap.`,
    );
  }
  const byCat = groupExpenses(input.expenses);
  if (byCat.length > 0) {
    notes.push(
      `Expense detail: ${byCat.map((e) => `${e.label} ${formatMoney(e.total)}`).join(", ")}.`,
    );
  }
  notes.push("Figures tie to venue ticketing and expense entries in Greenroom.");
  return notes;
}

function buildBodyMarkdown(
  input: ExplainSettlementInput,
  wf: Extract<ReturnType<typeof calculateWaterfall>, { ok: true }>,
  flags: ExplanationFlag[],
  dealTermsLine: string,
  openingSummary: string,
): string {
  const lines: string[] = [];
  const header = input.venueName
    ? `${input.venueName} — settlement worksheet`
    : "Settlement worksheet";
  lines.push(header);
  if (input.showDate) lines.push(`Show date: ${input.showDate}`);
  lines.push("");
  lines.push(openingSummary);
  lines.push("");
  lines.push("**Confirmed deal terms**");
  lines.push(dealTermsLine);
  lines.push("");

  if (flags.length > 0) {
    lines.push("**Before you rely on this total**");
    for (const f of flags) {
      lines.push(`- ${flagPrefix(f.kind)} ${f.text}`);
    }
    lines.push("");
  }

  lines.push("**Calculation**");
  for (const step of wf.steps) {
    if (step.id === "absorbed_note") {
      lines.push(`- ${step.label} — ${step.note}`);
      continue;
    }
    const display =
      step.effect < 0
        ? `−${formatMoney(Math.abs(step.effect))}`
        : formatMoney(step.amount);
    lines.push(`- ${step.label}: ${display}`);
    if (step.runningBalance != null && step.id !== "gross" && step.effect < 0) {
      lines.push(`  - Running balance: ${formatMoney(step.runningBalance)}`);
    }
    if (step.note && step.id !== "absorbed_note") {
      lines.push(`  - ${step.note}`);
    }
  }

  if (wf.vsResolution) {
    lines.push("");
    lines.push("**Vs comparison**");
    lines.push(
      `- Guarantee: ${formatMoney(wf.vsResolution.guaranteePayout)}`,
    );
    lines.push(
      `- ${pct(wf.vsResolution.artistPercentage)} of net: ${formatMoney(wf.vsResolution.percentagePayout)}`,
    );
    lines.push(
      `- **Paid on:** ${wf.vsResolution.winner === "percentage" ? "percentage (higher)" : "guarantee (higher)"}`,
    );
  }

  lines.push("");
  lines.push(`**Total to artist: ${formatMoney(wf.totalToArtist)}**`);
  lines.push("");
  lines.push("---");
  for (const n of buildFootnotes(input, wf)) {
    lines.push(`_${n}_`);
  }

  return lines.join("\n");
}

function buildAgentStatement(
  input: ExplainSettlementInput,
  wf: Extract<ReturnType<typeof calculateWaterfall>, { ok: true }>,
  flags: ExplanationFlag[],
  dealTermsLine: string,
): string {
  const lines: string[] = [];
  lines.push("SETTLEMENT STATEMENT");
  if (input.artistName) lines.push(`Artist: ${input.artistName}`);
  if (input.showDate) lines.push(`Date: ${input.showDate}`);
  if (input.venueName) lines.push(`Venue: ${input.venueName}`);
  lines.push("");
  lines.push("Deal terms (confirmed):");
  lines.push(dealTermsLine);
  lines.push("");
  lines.push("Box office:");
  lines.push(`  Gross: ${formatMoney(wf.grossBoxOffice)}`);
  lines.push(`  Fees:  ${formatMoney(wf.totalFees)}`);
  lines.push("");
  lines.push("Deductions:");
  if (wf.marketingRecoupApplied > 0) {
    lines.push(
      `  Marketing recoup: ${formatMoney(wf.marketingRecoupApplied)} (${stackingPhrase(input.canon.recoupStacking)})`,
    );
  }
  lines.push(
    `  Show expenses (per cap): ${formatMoney(wf.expensesApplied)}`,
  );
  const byCat = groupExpenses(input.expenses.filter((e) => !e.absorbedByVenue));
  for (const row of byCat) {
    lines.push(`    ${row.label}: ${formatMoney(row.total)}`);
  }
  lines.push("");
  if (wf.vsResolution) {
    lines.push("Vs settlement:");
    lines.push(`  Guarantee: ${formatMoney(wf.vsResolution.guaranteePayout)}`);
    lines.push(
      `  ${pct(wf.vsResolution.artistPercentage)} of net: ${formatMoney(wf.vsResolution.percentagePayout)}`,
    );
    lines.push(
      `  Payable: ${formatMoney(wf.totalToArtist)} (${wf.vsResolution.winner} side)`,
    );
  } else {
    lines.push(`Total to artist: ${formatMoney(wf.totalToArtist)}`);
  }
  if (flags.some((f) => f.kind === "disputed")) {
    lines.push("");
    lines.push("Note: One or more recoup lines remain in dispute on file.");
  }
  lines.push("");
  lines.push("Please contact the booker with any questions on line items.");
  return lines.join("\n");
}

function groupExpenses(expenses: Expense[]): { label: string; total: number }[] {
  const m = new Map<string, number>();
  for (const e of expenses) {
    if (e.absorbedByVenue) continue;
    const label = EXPENSE_LABELS[e.category] ?? e.category;
    m.set(label, (m.get(label) ?? 0) + e.amount);
  }
  return [...m.entries()].map(([label, total]) => ({ label, total }));
}

function flagPrefix(kind: ExplanationFlag["kind"]): string {
  switch (kind) {
    case "disputed":
      return "[Disputed]";
    case "ambiguous":
      return "[Needs clarity]";
    case "absorbed":
      return "[Venue absorbed]";
    case "caution":
      return "[Check]";
  }
}

function stackingPhrase(s: string): string {
  switch (s) {
    case "inside_expense_cap":
      return "included in expense cap";
    case "deducted_before_net":
      return "deducted before net, per cap stack";
    case "ambiguous_unset":
      return "stacking not confirmed";
    default:
      return "n/a";
  }
}

function pct(p: number): string {
  return `${(p * 100).toFixed(0)}%`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
