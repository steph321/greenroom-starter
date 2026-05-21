# AI interpretation layer (Phase 4)

**Code:** `lib/ai/`  
**Entry:** `interpretDeal()` / `interpretDealSync()`

## Design principles

1. **Rules first** — Works without API keys; every match traceable via `proseExtraction.matchedPhrases`.
2. **LLM optional** — Adds 2–3 sentence rationale only; never changes canon numbers.
3. **Surface ambiguity** — `ambiguous_unset` recoup stacking → blocking discrepancy + ambiguity flag.
4. **Honest confidence** — Low if blocking checks, missing notes, or prose/structured conflict.

## Extraction schema

See `lib/ai/types.ts`:

- `DealCanon` — proposed settlement terms (human confirms)
- `ProseExtraction` — raw parse from `deal_notes_freetext`
- `FieldConfidence` — high | medium | low per field + sources
- `Discrepancy` — blocking | warning | info
- `AmbiguityFlag` — questions requiring human choice

## Confidence scoring

| Overall | When |
|---------|------|
| **low** | No deal notes; any blocking discrepancy; recoup stacking unset; 2+ low-confidence fields |
| **medium** | Warnings, unsupported clauses (walkout/ratchet), or 1 low field |
| **high** | Notes present, no blocking issues, fields align |

## Discrepancy IDs (rules)

| ID | Pattern |
|----|---------|
| `deal_type_vs_mismatch` | BC9 |
| `percentage_renegotiation` | BC6 (85/15 vs 0.75) |
| `recoup_stacking_unset` | Coastal class |
| `stale_structured_warning` | BC2 prose marker |
| `hospitality_over_cap` | BC5 context |
| `signoff_vs_disputed` | BC1 context |

## Test

```bash
npx tsx scripts/test-interpretation.ts
```

## Prompt log

Record tuning in `ai-logs.md` at repo root.
