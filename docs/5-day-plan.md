# 5-day plan — AI Settlement Interpretation & Trust Layer

**Slice thesis:** Deals live in messy prose; settlements need a **confirmed structured interpretation** with **explainable math** and **agent-ready summaries**. AI extracts and flags; humans confirm; system records the canon.

**Primary user:** Mariana (2am settle). **Secondary:** Marcus (sign-off), Sarah/Diego (trust audit).

---

## Architecture (what you're building)

```
deal_notes_freetext + structured fields + expenses + recoups + tickets
        │
        ▼
┌───────────────────────────────┐
│  AI Interpretation Service     │  ← extraction, contradiction detection
│  (lib/ai/interpretDeal.ts)     │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  Confirmed Deal Canon (UI)     │  ← Mariana confirms / edits before settle
│  stacking rules, % basis, caps │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  Settlement Engine (deterministic)│ ← Vs standard only in v1; no LLM math
│  lib/dealMath.ts + waterfall   │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  Trust outputs                 │
│  • step-by-step explanation    │
│  • confidence + flags          │
│  • agent summary (markdown)    │
└───────────────────────────────┘
```

**Principle:** LLM proposes; **code calculates**; human confirms ambiguous branches.

---

## Day 1 — Ground truth & documentation (Mon)

| Block | Deliverable |
|-------|-------------|
| AM | Run `npm run db:reset`, explore app, read all `data/*.md`, run `npx tsx scripts/audit-db.ts` |
| PM | Finalize `docs/database-audit.md` (done); write memo outline; fork + branch `case-study/ai-trust-layer` |
| EOD | **Slice one-pager** in `docs/memo.md` (problem, cut, non-goals) |

**Exit criteria:** Can explain Coastal Spell $720 gap and BC1–BC12 to a colleague.

---

## Day 2 — Interpretation core (Tue)

| Block | Deliverable |
|-------|-------------|
| AM | `lib/ai/types.ts` — `DealInterpretation`, `Contradiction`, `ConfidenceFlag` |
| AM | `lib/ai/interpretDeal.ts` — prompt + parser (OpenAI/Anthropic via env `AI_API_KEY`) |
| PM | Rule-based **pre-checks** without LLM: regex for "85/15", "against gross", "vs … whichever greater", JSON vs prose thresholds |
| PM | Unit tests on BC2, BC6, BC9, Coastal Spell prose |

**Exit criteria:** Given Coastal Spell `deal_notes_freetext`, system flags marketing recoup stacking as **ambiguous** with two readings and $720 delta.

**Log every prompt in `ai-logs.md`.**

---

## Day 3 — Settlement engine + UI shell (Wed)

| Block | Deliverable |
|-------|-------------|
| AM | Extend `dealMath.ts`: **standard Vs** only (guarantee vs % net after capped expenses + fee handling) |
| AM | Recoup stacking parameter: `recoupInsideCap` \| `recoupBeforeNet` \| `unresolved` |
| PM | New settle panel: **Interpretation** tab (flags, confirm canon) + **Walkthrough** tab (waterfall) |
| PM | Wire `show_coastal_spell_dispute` as demo; ⌘K search "Coastal Spell" |

**Exit criteria:** Mariana can toggle recoup interpretation and see $11,565 vs $12,285 live.

---

## Day 4 — Trust layer & agent outputs (Thu)

| Block | Deliverable |
|-------|-------------|
| AM | `lib/ai/explainSettlement.ts` — narrative + line citations from deterministic steps |
| AM | `lib/ai/agentSummary.ts` — Sarah-style itemized statement (markdown export) |
| PM | Confidence scoring: High / Medium / Low per field + overall; list unresolved contradictions |
| PM | Surface BC1 on settle: "Disputed badge but TM signed off — see notes" |

**Exit criteria:** One-click "Copy agent summary" for Coastal Spell; contradictions block "finalize" until acknowledged.

---

## Day 5 — Memo, polish, Loom, submit (Fri)

| Block | Deliverable |
|-------|-------------|
| AM | Finish `docs/memo.md` (1–2 pages): slice, trade-offs, validation, next |
| AM | README section: setup, env vars, how to run AI features |
| PM | Record **5–10 min Loom**: problem → DB mess → demo → what you cut |
| PM | Push branch; optional `docs/process-log.md` day-by-day journal |

**Exit criteria:** Reviewer can clone, set API key, open Coastal Spell, see interpretation + waterfall + agent summary.

---

## Explicit cuts (defend in interview)

| Cut | Why |
|-----|-----|
| Walkout pots, tier ratchets, vs-gross variants | ⅔ of Vs flavors; depth > breadth |
| Door / pure % of net in v1 | Same engine later; Vs covers Crescent core |
| TM mobile pre-review | Diego ask = v2 share link |
| Full dispute lifecycle rework | BC1 surface only; not rebuilding state machine |
| Auto-email to agents | Human sends; system generates draft |
| LLM performs arithmetic | Trust failure; deterministic math only |

---

## Validation plan (memo section)

| Signal | How |
|--------|-----|
| Interpretation accuracy | Label 20 deals manually; compare AI extraction + flags |
| Time to settle | Mariana shadow: minutes at worksheet vs spreadsheet |
| Dispute prevention | Count ambiguous recoup flags resolved pre-show |
| Adoption | % Vs shows with confirmed canon before settle |
| Agent trust | Sarah test: 3-min read, zero "what is this" lines |

---

## Repo files to create/maintain

| File | Purpose |
|------|---------|
| `ai-logs.md` | All prompts + model versions + tuning notes |
| `docs/database-audit.md` | Data flaws catalog |
| `docs/5-day-plan.md` | This file |
| `docs/memo.md` | PRD-quality submission memo |
| `docs/process-log.md` | Daily build journal (optional bonus) |
| `scripts/audit-db.ts` | Repeatable DB audit |
| `lib/ai/*` | Interpretation + explanation |
| `.env.example` | `AI_API_KEY`, model id |

---

## Environment

```bash
cp .env.example .env.local
# AI_API_KEY=...  (Anthropic or OpenAI)
npm run db:reset
npm run dev
```

Fallback if no API key at review time: **rule-based interpretation** still runs; document in memo as degraded mode.
