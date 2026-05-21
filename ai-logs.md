# AI build logs — Greenroom case study

Official case-study prompts (1–7) and what they produced.  
**Not logged:** memo, Loom, ELI5 walkthroughs, submission coaching, or other explain-only chats.

---

## Prompt 1 — Repo / product understanding

### Prompt

> You are helping me analyze a PM case study codebase.
>
> I need you to act like a senior staff product engineer and help me identify:
> - the current settlement workflow,
> - data models,
> - settlement calculation logic,
> - unsupported deal types,
> - UX pain points,
> - trust and ambiguity issues,
> - areas where structured data conflicts with notes or workflow reality.
>
> Focus especially on:
> - settlement lifecycle,
> - notes_freetext usage,
> - Vs deals,
> - recoup handling,
> - dispute states,
> - auditability.
>
> Help me understand:
> 1. How settlement currently works
> 2. Where the biggest operational pain exists
> 3. Which workflows appear fragile or confusing
> 4. What product opportunities exist around AI-assisted settlement interpretation
>
> Do not suggest broad rewrites.
> Focus on high-leverage, narrow improvements.

### Outcome

- `docs/settlement-system-analysis.md`
- Informed slice scope (read-only settle UI, dual math engines, `calculation_json` unused)

---

## Prompt 2 — DB investigation

### Prompt

> Help me inspect this SQLite database for signs of operational messiness and settlement ambiguity.
>
> I want to identify:
> - conflicting settlement states,
> - disputed settlements with positive sign-offs,
> - inconsistencies between structured deal fields and notes_freetext,
> - unusual recoup patterns,
> - recurring dispute causes,
> - unsupported Vs deal structures,
> - ambiguous clauses in notes.
>
> Generate SQL queries I can run to surface:
> - contradictions,
> - anomalies,
> - workflow pain,
> - trust issues.
>
> Then help me interpret what product problems these patterns reveal.
>
> THIS is where you find the gold for your memo.

### Outcome

- `docs/sql-inspection-queries.sql`
- `scripts/audit-db.ts`, `scripts/run-sql-audit.ts`
- `docs/database-audit.md` (BC1–BC12, Coastal Spell narrative)
- Counts used in memo (537 settlements, 0 `calculation_json`, Daniel Hwang marketing recoup cluster, etc.)

---

## Prompt 3 — Product slice / thesis (Phase 2)

### Prompt

> Based on the repo and database findings, help me frame a strong Applied AI PM product thesis.
>
> My current direction:
> AI-assisted settlement confidence review for independent music venues.
>
> I want help refining:
> - the core user pain,
> - why this problem matters operationally,
> - why ambiguity and trust are bigger problems than calculation,
> - why this is the highest-leverage slice,
> - what I should intentionally NOT build,
> - what success metrics matter.
>
> The final framing should sound like a thoughtful senior PM, not a generic AI feature pitch.

### Outcome

- `docs/product-thesis.md` (locked slice)
- `docs/5-day-plan.md`

---

## Prompt 4 — UX flow design (Phase 3)

### Prompt

> Help me design a lightweight but realistic UX workflow for an AI-assisted settlement confidence review feature.
>
> The user is:
> Mariana Reyes, an indie venue booker settling shows at 2am.
>
> Constraints:
> - Must feel operationally realistic
> - Must reduce ambiguity and disputes
> - Must preserve human control
> - Must not feel like “AI autopilot”
> - Should integrate naturally into existing settlement workflow
>
> The workflow should include:
> - deal note interpretation,
> - discrepancy detection,
> - confidence indicators,
> - settlement explanation,
> - agent-facing summary generation.
>
> Help me define:
> 1. UI sections
> 2. User actions
> 3. AI outputs
> 4. Warning states
> 5. Human override points
> 6. Empty/loading/error states

### Outcome

- `docs/ux-confidence-review-workflow.md`
- Blueprint for Phase 5 UI (readiness → interpretation → checks → walkthrough → agent summary)

---

## Prompt 5 — AI extraction logic (Phase 4)

### Prompt

> Help me implement a lightweight AI-powered deal interpretation layer.
>
> I want to:
> - analyze notes_freetext,
> - detect deal structure,
> - extract guarantees,
> - extract percentages,
> - identify net vs gross,
> - detect recoup clauses,
> - identify ambiguous language,
> - compare extracted values against structured fields.
>
> Requirements:
> - prioritize interpretability over complexity,
> - include confidence scoring,
> - surface ambiguity instead of hiding it,
> - avoid pretending AI is perfectly accurate.
>
> Help me:
> 1. define extraction schema
> 2. create parsing logic
> 3. structure confidence scoring
> 4. generate discrepancy warnings
> 5. design explainable outputs

### Outcome (code)

- `lib/ai/*` — `types.ts`, `extractFromProse.ts`, `mergeCanon.ts`, `discrepancies.ts`, `confidence.ts`, `interpretDeal.ts`, `llmEnhance.ts`, `explain.ts`, `reviewState.ts`, `index.ts`
- `scripts/test-interpretation.ts`, `.env.example`
- `docs/ai-interpretation-layer.md`
- Parser fixes: 85/15 artist share; net vs recoup “against gross”; Coastal `recoup_stacking_unset` blocking

---

## Prompt 6 — Settlement explanation generator (Phase 4b)

### Prompt

> Help me design a settlement explanation generator.
>
> The goal:
> Generate a human-readable explanation of how the settlement payout was calculated.
>
> The explanation should:
> - be understandable to tour managers,
> - explain deductions transparently,
> - show how the Vs comparison was resolved,
> - identify disputed or ambiguous items,
> - feel operationally trustworthy.
>
> Avoid marketing language.
> Avoid sounding like ChatGPT.
> Write like real venue operations software.

### Outcome (code)

- `lib/settlement/waterfall.ts`, `explainSettlement.ts`, `types.ts`, `index.ts`
- `scripts/test-explanation.ts`
- `docs/settlement-explanation.md`
- Recoup stacking semantics (Coastal: ~$12,284.80 inside cap vs ~$11,564.80 before net, Δ $720)

---

## Prompt 7 — Frontend build (Phase 5)

### Prompt

> Help me implement a polished settlement confidence review panel in this Next.js application.
>
> Requirements:
> - operational software aesthetic,
> - clean information hierarchy,
> - easy to scan at 2am,
> - warnings visually distinct,
> - confidence indicators subtle but visible,
> - explanation sections readable,
> - preserve existing settlement workflow.
>
> Components I likely need:
> - discrepancy cards,
> - extracted deal terms,
> - confidence badges,
> - settlement breakdown,
> - generated summary panel,
> - warning banners.
>
> Prioritize clarity over flashy UI.

### Outcome (code)

- `components/settlement/settlement-confidence-review.tsx`, `confidence-badge.tsx`, `warning-banner.tsx`, `discrepancy-cards.tsx`
- `app/shows/[id]/settle/page.tsx` — `interpretDealSync` + panel (Vs full, flat/% gross compact)
- Coastal trust banner; dual recoup preview; confirm gate; walkthrough + agent copy
- `scripts/db-reset.ts`, `package.json` `db:reset` (Windows)
- `db/index.ts` — absolute DB path

### Human decisions (not from a prompt)

- LLM proposes canon; code calculates after confirm
- Walkthrough locked until interpretation confirmed

---

## Prompt index

| # | Phase | Primary artifacts |
|---|--------|-------------------|
| 1 | Understand repo | `settlement-system-analysis.md` |
| 2 | DB investigation | `sql-inspection-queries.sql`, `database-audit.md`, audit scripts |
| 3 | Product thesis | `product-thesis.md`, `5-day-plan.md` |
| 4 | UX design | `ux-confidence-review-workflow.md` |
| 5 | AI logic | `lib/ai/*` |
| 6 | Explanation | `lib/settlement/*` |
| 7 | UI | `components/settlement/*`, settle page |
