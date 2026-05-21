# Process log — case study build

Chronological record of decisions, discoveries, and deliverables.  
Update at end of each work day.

---

## Day 0 — 2026-05-19

### Read
- [x] Case study brief (settlement at The Crescent)
- [x] `data/ceo-memo.md`
- [x] `data/dispute-thread.md`
- [x] `data/transcripts/mariana.md`, `diego.md`, `marcus.md`, `sarah-kim.md`

### Slice locked (Phase 2 — thesis)
**Settlement confidence review** (AI-assisted interpretation + trust layer)

Full framing: [`product-thesis.md`](./product-thesis.md)

Previously titled: AI Settlement Interpretation & Trust Layer

- Parse deal notes → structured interpretation
- Detect prose vs field contradictions
- Explain settlement (deterministic waterfall)
- Agent-facing summary + confidence scores
- Human confirmation on ambiguous branches (especially recoup stacking)

### Database
- [x] Created `scripts/audit-db.ts`
- [x] Documented BC1–BC12 in `docs/database-audit.md`
- [ ] Verify Coastal Spell after `npm run db:reset` if missing

### Repo artifacts
- [x] `docs/5-day-plan.md`
- [x] `ai-logs.md` (started)
- [x] `docs/process-log.md` (this file)
- [x] `docs/settlement-system-analysis.md` — full codebase read (workflow, dual math engines, UX/trust gaps, AI slice mapping)

### Session: Senior staff codebase analysis (2026-05-19)
- Documented read-only settlement workflow (no server actions / lifecycle transitions in UI).
- Mapped **two math engines**: `lib/dealMath.ts` (flat, % gross only) vs `db/seed.ts` `computeSettlement` (all types, no recoups in total).
- Catalogued UX pain, trust/ambiguity issues, and narrow AI opportunities (Tier 1–3).
- See [`settlement-system-analysis.md`](./settlement-system-analysis.md) for the full write-up (was chat-only until this commit).

### Session: SQL inspection pack (2026-05-19)
- Added `docs/sql-inspection-queries.sql` (sections A–F) and `scripts/run-sql-audit.ts`.
- Live summary: 537 settlements, 0 `calculation_json`, 334 unsupported deal types, 21 paid+disputed recoup, 15 disputed+positive signoff, Coastal Spell present at $12,285 disputed.

### Open questions
1. Which LLM API for reviewers? (Anthropic vs OpenAI — document both in `.env.example`)
2. Store confirmed canon on `deals` table extension vs new `deal_interpretations` table?
3. Show Wednesday pre-flight on show detail or only on settle page?

---

## Phase 3 — UX workflow (2026-05-19)

- Designed settlement confidence review flow for `/shows/[id]/settle`.
- Doc: [`ux-confidence-review-workflow.md`](./ux-confidence-review-workflow.md)
- Seven sections: readiness → interpretation → discrepancies → confidence gate → walkthrough → recoups → agent summary.
- Human gates: confirm interpretation, explicit recoup stacking, blocking discrepancy resolution, optional low-confidence override.

---

## Phase 4 — AI interpretation layer (2026-05-19)

- Implemented `lib/ai/`: types, `extractFromProse`, `mergeCanon`, `discrepancies`, `confidence`, `interpretDeal`, optional `llmEnhance`, `explain`.
- Rules-first; `OPENAI_API_KEY` optional for rationale only.
- Tests: `npx tsx scripts/test-interpretation.ts` (Coastal Spell → low confidence + recoup blocking).
- Doc: [`ai-interpretation-layer.md`](./ai-interpretation-layer.md)

## Phase 4b — Settlement explanation generator (2026-05-19)

- `lib/settlement/waterfall.ts` — deterministic canon-based math (Vs + recoup stacking)
- `lib/settlement/explainSettlement.ts` — TM + agent markdown, ops tone
- Coastal dual preview: $12,284.80 inside cap vs $11,564.80 before net (Δ $720)
- Doc: [`settlement-explanation.md`](./settlement-explanation.md)
- Test: `npx tsx scripts/test-explanation.ts`

<!-- Phase 5: wire UI on settle page -->
