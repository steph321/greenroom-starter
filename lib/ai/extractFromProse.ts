/**
 * Rule-based extraction from deal_notes_freetext.
 * Runs offline — no API required. Transparent matched phrases.
 */

import type { ProseExtraction, DealStructure, RecoupStacking } from "./types";

const MONEY = /\$\s*([\d,]+(?:\.\d{2})?)/gi;

function parseMoney(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function allMoneyAmounts(text: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(MONEY.source, "gi");
  while ((m = re.exec(text)) !== null) {
    const v = parseMoney(m[1]);
    if (v != null) out.push(v);
  }
  return out;
}

function detectStructure(text: string): DealStructure | null {
  const t = text.toLowerCase();
  if (
    /\bvs\.?\b/.test(t) ||
    /whichever\s+(?:greater|higher)/.test(t) ||
    /guarantee\s+vs/.test(t) ||
    /\d+\s*%\s*vs/.test(t)
  ) {
    return "vs";
  }
  if (/%\s*of\s*gross/.test(t) || /percentage\s+of\s+gross/.test(t)) {
    return "percentage_of_gross";
  }
  if (
    /%?\s*of\s*net/.test(t) ||
    /after\s+expenses/.test(t) ||
    /\d+\s*\/\s*\d+\s*split\s+on\s+net/.test(t)
  ) {
    if (/guarantee\s+vs|whichever/.test(t)) return "vs";
    return "percentage_of_net";
  }
  if (/\bdoor\s+deal\b/.test(t) || /artist\s+gets\s+(?:the\s+)?door/.test(t)) {
    return "door";
  }
  if (
    /\bflat\s+guarantee\b/.test(t) ||
    /guaranteed?\s+\$/.test(t) ||
    (/\$\s*[\d,]+/.test(t) && !/%/.test(t) && !/vs/.test(t))
  ) {
    return "flat";
  }
  return null;
}

function detectPercentage(text: string): number | null {
  const t = text.toLowerCase();
  // "85/15 split on net" = 85% to artist, not 85÷15
  const splitShare = t.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*split/);
  if (splitShare) {
    const artist = parseInt(splitShare[1], 10);
    const other = parseInt(splitShare[2], 10);
    if (artist + other === 100 || (artist <= 95 && other <= 30)) {
      return artist / 100;
    }
  }
  const vsPct = t.match(/vs\s+(\d{1,3})\s*%/);
  if (vsPct) {
    const v = parseInt(vsPct[1], 10);
    if (v > 0 && v <= 100) return v / 100;
  }
  const pct = t.match(/(\d{1,3})\s*%/);
  if (pct) {
    const v = parseInt(pct[1], 10);
    if (v > 0 && v <= 100) return v / 100;
  }
  return null;
}

function detectBasis(text: string): "gross" | "net" | null {
  const t = text.toLowerCase();
  // Artist % basis (before recoup-specific "against gross" phrases)
  const main = t.split(/marketing\s+recoup|recoup\s+of/)[0] ?? t;
  if (
    /%\s*of\s*net|vs\s+\d+\s*%.*net|after\s+expenses|\d+\s*\/\s*\d+\s*split\s+on\s+net/.test(
      main,
    )
  ) {
    return "net";
  }
  if (/%\s*of\s*gross/.test(main)) return "gross";
  if (/against\s+gross|on\s+gross/.test(t)) return "gross";
  if (/on\s+net/.test(main)) return "net";
  return null;
}

function detectGuarantee(text: string, amounts: number[]): number | null {
  const g =
    text.match(
      /\$\s*([\d,]+)\s*(?:guarantee|g'tee|gtée|guaranteed)/i,
    ) ??
    text.match(
      /(?:guarantee|g'tee|gtée)\s*(?:of\s*)?\$\s*([\d,]+)/i,
    ) ??
    text.match(
      /\$\s*([\d,]+)\s*vs/i,
    ) ??
    text.match(
      /g'tee\s+vs\s+\$?\s*([\d,]+)/i,
    );
  if (g) return parseMoney(g[1]);
  return null;
}

function detectExpenseCap(text: string): number | null {
  const m =
    text.match(/expenses?\s+capped?\s+(?:at\s+)?\$\s*([\d,]+)/i) ??
    text.match(/expense\s+cap\s+\$\s*([\d,]+)/i) ??
    text.match(/cap\s+\$\s*([\d,]+)/i);
  return m ? parseMoney(m[1]) : null;
}

function detectHospitalityCap(text: string): number | null {
  const m = text.match(/hospitality\s+cap\s+\$\s*([\d,]+)/i);
  return m ? parseMoney(m[1]) : null;
}

function detectMarketingRecoup(text: string): number | null {
  const m =
    text.match(/marketing\s+recoup\s+(?:of\s+)?\$\s*([\d,]+)/i) ??
    text.match(/recoup\s+(?:of\s+)?\$\s*([\d,]+)/i);
  return m ? parseMoney(m[1]) : null;
}

function detectRecoupStacking(text: string): RecoupStacking | null {
  const t = text.toLowerCase();
  if (!/recoup/.test(t)) return "none";
  if (
    /included\s+in\s+(?:the\s+)?expense\s+cap/.test(t) ||
    /inside\s+(?:the\s+)?(?:expense\s+)?cap/.test(t) ||
    /part\s+of\s+(?:the\s+)?\$?[\d,]+\s+expense/.test(t)
  ) {
    return "inside_expense_cap";
  }
  if (
    /against\s+gross/.test(t) ||
    /off\s+(?:the\s+)?gross/.test(t) ||
    /before\s+(?:net|expenses)/.test(t) ||
    /separate\s+from\s+(?:the\s+)?expense\s+cap/.test(t) ||
    /in\s+addition\s+to\s+(?:the\s+)?expense\s+cap/.test(t)
  ) {
    if (/against\s+gross/.test(t) && /expense\s+cap|expenses?\s+capped/.test(t)) {
      return "ambiguous_unset";
    }
    return "deducted_before_net";
  }
  if (/expense\s+cap|expenses?\s+capped/.test(t) && /recoup/.test(t)) {
    return "ambiguous_unset";
  }
  return "ambiguous_unset";
}

export function detectUnsupported(text: string): string[] {
  const t = text.toLowerCase();
  const found: string[] = [];
  if (/walkout\s+pot|walk\s*out/.test(t)) found.push("walkout pot");
  if (/tier\s+ratchet|ratchet|tiered/.test(t)) found.push("tier ratchet");
  if (/vs\s+gross|versus\s+gross/.test(t)) found.push("vs-gross variant");
  if (/structured field still reflects|confirm before settlement/i.test(text)) {
    found.push("stale structured fields (per deal notes)");
  }
  return found;
}

export function extractFromProse(notes: string | null | undefined): ProseExtraction {
  const text = (notes ?? "").trim();
  const matchedPhrases: string[] = [];

  if (!text) {
    return {
      structure: null,
      guaranteeAmount: null,
      artistPercentage: null,
      percentageBasis: null,
      expenseCap: null,
      hospitalityCap: null,
      marketingRecoupAmount: null,
      recoupStackingHint: null,
      matchedPhrases: [],
    };
  }

  const amounts = allMoneyAmounts(text);
  const structure = detectStructure(text);
  if (structure) matchedPhrases.push(`deal structure: ${structure}`);

  const guaranteeAmount = detectGuarantee(text, amounts);
  if (guaranteeAmount != null) matchedPhrases.push(`guarantee $${guaranteeAmount}`);

  const artistPercentage = detectPercentage(text);
  if (artistPercentage != null) {
    matchedPhrases.push(`artist %: ${(artistPercentage * 100).toFixed(0)}%`);
  }

  const percentageBasis = detectBasis(text);
  if (percentageBasis) matchedPhrases.push(`basis: ${percentageBasis}`);

  const expenseCap = detectExpenseCap(text);
  if (expenseCap != null) matchedPhrases.push(`expense cap $${expenseCap}`);

  const hospitalityCap = detectHospitalityCap(text);
  if (hospitalityCap != null) matchedPhrases.push(`hospitality cap $${hospitalityCap}`);

  const marketingRecoupAmount = detectMarketingRecoup(text);
  if (marketingRecoupAmount != null) {
    matchedPhrases.push(`marketing recoup $${marketingRecoupAmount}`);
  }

  const recoupStackingHint = detectRecoupStacking(text);
  if (recoupStackingHint && recoupStackingHint !== "none") {
    matchedPhrases.push(`recoup stacking: ${recoupStackingHint}`);
  }

  return {
    structure,
    guaranteeAmount,
    artistPercentage,
    percentageBasis,
    expenseCap,
    hospitalityCap,
    marketingRecoupAmount,
    recoupStackingHint,
    matchedPhrases,
  };
}
