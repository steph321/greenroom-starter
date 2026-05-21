/**
 * Merge prose extraction with structured deal fields into proposed canon.
 */

import type { Deal } from "@/db/schema";
import type {
  DealCanon,
  DealStructure,
  FieldConfidence,
  ProseExtraction,
  RecoupStacking,
} from "./types";

function structureFromDealType(dealType: Deal["dealType"]): DealStructure {
  return dealType;
}

function pctClose(a: number | null, b: number | null, tol = 0.011): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol;
}

function moneyClose(a: number | null, b: number | null, tol = 1): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol;
}

export function mergeToCanon(
  deal: Deal,
  prose: ProseExtraction,
): { canon: DealCanon; fieldConfidence: Partial<Record<keyof DealCanon, FieldConfidence>> } {
  const structuredStructure = structureFromDealType(deal.dealType);
  const fieldConfidence: Partial<Record<keyof DealCanon, FieldConfidence>> = {};

  let structure: DealStructure = prose.structure ?? structuredStructure;
  if (prose.structure && prose.structure !== structuredStructure) {
    fieldConfidence.structure = {
      level: "low",
      sources: ["prose", "structured"],
      note: `Notes imply ${prose.structure}; booking form says ${structuredStructure}.`,
    };
  } else if (prose.structure) {
    fieldConfidence.structure = { level: "high", sources: ["prose", "structured"] };
  } else {
    fieldConfidence.structure = {
      level: "medium",
      sources: ["structured"],
      note: "Deal structure taken from booking form only.",
    };
  }

  const guaranteeAmount = pickMoney(
    prose.guaranteeAmount,
    deal.guaranteeAmount,
    "guaranteeAmount",
    fieldConfidence,
  );

  const artistPercentage = pickPct(
    prose.artistPercentage,
    deal.percentage,
    "artistPercentage",
    fieldConfidence,
  );

  let percentageBasis: "gross" | "net" | null =
    prose.percentageBasis ?? deal.percentageBasis ?? null;
  if (prose.percentageBasis && deal.percentageBasis && prose.percentageBasis !== deal.percentageBasis) {
    fieldConfidence.percentageBasis = {
      level: "low",
      sources: ["prose", "structured"],
      note: `Notes say ${prose.percentageBasis}; form says ${deal.percentageBasis}.`,
    };
  } else if (percentageBasis) {
    fieldConfidence.percentageBasis = {
      level: prose.percentageBasis ? "high" : "medium",
      sources: prose.percentageBasis ? ["prose", "structured"] : ["structured"],
    };
  }

  const expenseCap = pickMoney(
    prose.expenseCap,
    deal.expenseCap,
    "expenseCap",
    fieldConfidence,
  );

  const hospitalityCap = pickMoney(
    prose.hospitalityCap,
    deal.hospitalityCap,
    "hospitalityCap",
    fieldConfidence,
  );

  let recoupStacking: RecoupStacking =
    prose.recoupStackingHint ?? (prose.marketingRecoupAmount ? "ambiguous_unset" : "none");
  const marketingRecoupAmount = prose.marketingRecoupAmount;

  if (marketingRecoupAmount != null) {
    fieldConfidence.marketingRecoupAmount = {
      level: "medium",
      sources: ["prose"],
      note: "Recoup amount from deal notes.",
    };
    fieldConfidence.recoupStacking = {
      level: recoupStacking === "ambiguous_unset" ? "low" : "medium",
      sources: ["prose"],
      note:
        recoupStacking === "ambiguous_unset"
          ? "Stacking not explicit — choose before settling."
          : undefined,
    };
  } else {
    recoupStacking = "none";
    fieldConfidence.recoupStacking = { level: "high", sources: ["inferred"], note: "No recoup in notes." };
  }

  const canon: DealCanon = {
    structure,
    guaranteeAmount,
    artistPercentage,
    percentageBasis,
    expenseCap,
    hospitalityCap,
    marketingRecoupAmount,
    recoupStacking,
    feesDeductedFrom: "gross",
  };

  return { canon, fieldConfidence };
}

function pickMoney(
  proseVal: number | null,
  structVal: number | null | undefined,
  key: keyof DealCanon,
  conf: Partial<Record<keyof DealCanon, FieldConfidence>>,
): number | null {
  const s = structVal ?? null;
  if (proseVal != null && s != null) {
    if (moneyClose(proseVal, s)) {
      conf[key] = { level: "high", sources: ["prose", "structured"] };
      return s;
    }
    conf[key] = {
      level: "low",
      sources: ["prose", "structured"],
      note: `Notes suggest $${proseVal.toLocaleString()}; form has $${s.toLocaleString()}.`,
    };
    return proseVal;
  }
  if (proseVal != null) {
    conf[key] = { level: "medium", sources: ["prose"] };
    return proseVal;
  }
  if (s != null) {
    conf[key] = { level: "medium", sources: ["structured"] };
    return s;
  }
  return null;
}

function pickPct(
  proseVal: number | null,
  structVal: number | null | undefined,
  key: keyof DealCanon,
  conf: Partial<Record<keyof DealCanon, FieldConfidence>>,
): number | null {
  const s = structVal ?? null;
  if (proseVal != null && s != null) {
    if (pctClose(proseVal, s)) {
      conf[key] = { level: "high", sources: ["prose", "structured"] };
      return s;
    }
    conf[key] = {
      level: "low",
      sources: ["prose", "structured"],
      note: `Notes imply ${(proseVal * 100).toFixed(0)}%; form has ${(s * 100).toFixed(0)}%.`,
    };
    return proseVal;
  }
  if (proseVal != null) {
    conf[key] = { level: "medium", sources: ["prose"] };
    return proseVal;
  }
  if (s != null) {
    conf[key] = { level: "medium", sources: ["structured"] };
    return s;
  }
  return null;
}
