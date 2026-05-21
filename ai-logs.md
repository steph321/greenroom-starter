# AI build logs — Greenroom case study

This file documents how Cursor was used across the build.  
**Rule:** Append a dated entry for each meaningful AI session (prompts, outcomes, course corrections).

---

## Day 0 — Planning & database audit (2026-05-19)

### Context

Chose slice: **AI Settlement Interpretation & Trust Layer**.  
Read transcripts (Mariana, Diego, Marcus, Sarah), CEO memo, dispute thread.  
Ran `npx tsx scripts/audit-db.ts` against `data/greenroom.db`.

### Prompt (planning — Cursor/Claude)

> Read the Greenroom case study brief and all data/transcripts/*.md. I'm picking the slice "AI Settlement Interpretation & Trust Layer" with 5 days of work. Explore the database for deliberate flaws (BC1–BC12, Coastal Spell). Produce a 5-day plan, database audit doc, and start ai-logs.md for prompt documentation.

### Outcomes

- Confirmed 12 planted breadcrumbs in `db/seed.ts` (BC1–BC12).
- Live audit counts: 10 BC1, 21 BC3, 5 BC12 Daniel Hwang marketing disputes, etc.
- **Action:** If `show_coastal_spell_dispute` missing, run `npm run db:reset`.
- Created `docs/database-audit.md`, `docs/5-day-plan.md`, `scripts/audit-db.ts`.

---

## Day 0b — Settlement system analysis (2026-05-19)

### Prompt

> Act like a senior staff product engineer. Analyze settlement workflow, data models, calculation logic, unsupported deal types, UX pain points, trust/ambiguity, prose vs structured conflicts. Map narrow AI opportunities. Do not suggest broad rewrites.

### Outcomes

- Full analysis written to **`docs/settlement-system-analysis.md`** (workflow diagram, dual engines, lifecycle gaps, Coastal Spell, Tier 1–3 AI scope).
- Key finding: settlement UI is **read-only**; `calculation_json` unused; recoups never feed calculator.
- Process log updated in `docs/process-log.md`.

### Design decisions (human, not AI)

- LLM for **extraction + contradiction detection** only; **deterministic code** for money.
- Human confirmation gate before settlement finalization on ambiguous recoup/expense-cap stacking.
- v1 scope: **standard Vs** + trust outputs; not all deal types.

---

## Phase 3 — UX workflow design (2026-05-19)

### Prompt

> Design lightweight UX for AI-assisted settlement confidence review: sections, actions, AI outputs, warnings, overrides, empty/loading/error states. Mariana at 2am; no AI autopilot.

### Outcome

- `docs/ux-confidence-review-workflow.md` — full wireflow, mermaid, Coastal Spell demo path, component map.

---

## Phase 4 — AI extraction logic (2026-05-19)

### Prompt

> Implement lightweight AI deal interpretation: schema, parsing, confidence, discrepancies, explainable outputs. Rules-first; surface ambiguity.

### Outcome

- `lib/ai/*` + `scripts/test-interpretation.ts` + `.env.example`
- Fixed 85/15 split parsing (artist % not divide); basis net vs recoup "against gross"
- Coastal: blocking `recoup_stacking_unset`, overall `low`

---

## Phase 4b — Settlement explanation (2026-05-19)

### Prompt

> Design settlement explanation generator: TM-readable, transparent deductions, Vs resolution, disputed items, venue ops tone not ChatGPT.

### Outcome

- `lib/settlement/*`, template-driven markdown
- Fixed expense-cap semantics for Mariana vs agent reads (Coastal Δ $720)

### Next session prompts (planned)

1. "Implement `lib/ai/interpretDeal.ts` with Zod schema for DealInterpretation; flag BC2, BC6, BC9, Coastal Spell recoup ambiguity."
2. "Extend dealMath for standard Vs; add `recoupStacking` enum; unit test Coastal Spell $11565 vs $12285."
3. "Add Interpretation + Walkthrough tabs to settle page; block finalize when contradictions unresolved."

---

## Template for future entries

```markdown
## Day N — Title (YYYY-MM-DD)

### Goal
...

### Prompt(s)
\`\`\`
(paste exact prompt)
\`\`\`

### Model / tool
Claude Sonnet 4.x / Cursor Agent / etc.

### Output summary
- What shipped
- What failed
- What we changed manually

### Follow-ups
- [ ] ...
```
