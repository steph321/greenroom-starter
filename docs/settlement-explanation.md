# Settlement explanation generator

**Code:** `lib/settlement/`  
**Entry:** `explainSettlement(input)`

## Design goal

Generate copy a **tour manager can follow at 2am** and an **agent can audit Monday** — not marketing, not “AI-generated.”

- Short sentences, line items, running balance where helpful
- Name every deduction (fees, recoup stacking, expense cap)
- Vs: show **both sides** and which won
- Surface **disputed recoups** and **ambiguous clauses** without hiding them
- Numbers from **code only** (`calculateWaterfall`)

## Output shape

```ts
SettlementExplanation {
  totalToArtist
  openingSummary      // read-aloud paragraph
  dealTermsLine       // confirmed canon in plain English
  steps               // waterfall lines
  vsResolution?       // guarantee vs % winner
  flags[]             // disputed | ambiguous | absorbed | caution
  footnotes[]         // expense detail, data source
  bodyMarkdown        // TM walkthrough
  agentStatementMarkdown  // Monday email block
}
```

## Voice guidelines

| Do | Don’t |
|----|--------|
| “Tonight’s settlement for {artist} is $X.” | “We're excited to share…” |
| “Deducted from gross per ticketing.” | “Our AI calculated…” |
| “Resolve with the agent before calling this final.” | “Smart settlement insights” |
| “Vs result — percentage exceeds guarantee” | “Leveraging ML-powered…” |

## Recoup stacking (Coastal Spell)

| Stacking | Net pool before % | Coastal total |
|----------|-------------------|---------------|
| `inside_expense_cap` | (gross − fees − min(receipts+recoup, cap)) | **$12,285** |
| `deducted_before_net` | (gross − fees − recoup − **full cap**) | **$11,565** |
| Delta | | **$720** |

`explainRecoupAlternatives()` returns both explanations for UI dual-preview.

## Usage

```ts
import { interpretDealSync } from "@/lib/ai";
import { explainSettlement } from "@/lib/settlement";

const interp = interpretDealSync({ deal, ... });
const canon = { ...interp.proposedCanon, recoupStacking: "inside_expense_cap" };

const ex = explainSettlement({
  canon,
  grossBoxOffice: 19840,
  totalFees: 1984,
  expenses,
  recoups,
  ambiguities: interp.ambiguities,
  artistName: "Coastal Spell",
  venueName: "The Crescent",
});
```

## Test

```bash
npx tsx scripts/test-explanation.ts
```

## Phase 5

Wire `bodyMarkdown` + `agentStatementMarkdown` into settle page §5 / §7.
