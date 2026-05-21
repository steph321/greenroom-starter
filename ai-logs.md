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

---

## Phase 5 — Settlement confidence UI (2026-05-19)

### Prompt (case study — Prompt 7 / Frontend Build)

> Help me implement a polished settlement confidence review panel in this Next.js application.
>
> Requirements: operational software aesthetic, clean information hierarchy, easy to scan at 2am, warnings visually distinct, confidence indicators subtle but visible, explanation sections readable, preserve existing settlement workflow.
>
> Components I likely need: discrepancy cards, extracted deal terms, confidence badges, settlement breakdown, generated summary panel, warning banners. Prioritize clarity over flashy UI.

### Outcome

- `components/settlement/*` — `settlement-confidence-review.tsx`, `confidence-badge`, `warning-banner`, `discrepancy-cards`
- `lib/ai/reviewState.ts` — client recompute on canon edits
- Wired `app/shows/[id]/settle/page.tsx` — full panel for Vs; compact strip for flat/% gross
- Coastal trust banner, dual recoup preview, confirm gate, walkthrough + agent copy
- `scripts/db-reset.ts` — Windows-safe `npm run db:reset` (replaced `rm -f`)

### Follow-up prompts (same session)

> Explain the entire system again like I'm 5 — what each part does.

> Yes — click-by-click walkthrough for Coastal Spell (Loom prep).

> Did we solve what the problem wanted? (Senior PM / interview readiness review.)

> PHASE 6 — Help me draft a 1–2 page PM memo (Prompt 8). Slice: AI-assisted settlement confidence review. Cover problem, slice choice, DB insights, philosophy, design, tradeoffs, cuts, AI risks, metrics, next. Tone: operational, no buzzwords.

> PHASE 7 — Help me structure a 5–10 minute Loom (Prompt 9). Problem → slice → demo → cuts → AI judgment → next.

> Loom prep — do I need to talk? What to point at / what to say (user unfamiliar with UI).

> User shared Coastal settle screenshots — validated UI; corrected recoup labels (inside cap ≈ $12,285, before net ≈ $11,565).

> Shorter Loom script (single flow; user reads aloud, doesn’t want to memorize).

> What do I need to submit? (repo + memo export + Loom.)

### Course corrections (human + AI)

- Recoup stacking labels in coaching copy were wrong once; UI amounts are source of truth.
- 404 on `/settle` — stale duplicate `npm run dev` / `.next` cache; fixed `db/index.ts` absolute DB path.

---

## Phase 6 — Memo (2026-05-19)

### Prompt

> Prompt 8 — Memo Drafting (full requirements in Phase 5 follow-up above).

### Outcome

- `docs/memo.md` — submission-ready PM memo (export to PDF/Notion for hiring contact)

---

## Phase 7 — Loom script (2026-05-19)

### Prompt

> Prompt 9 — Loom Script: 5–10 min, problem / slice / demo / cuts / AI realism / next. Concise, product-oriented, not over-rehearsed.

### Outcome

- `docs/loom-script.md` — timed beats, Coastal URL, pre-flight checklist
- Iterated to ultra-short glance-card script for voiceover (~3 min)

### Note

User asked some coaching turns **off the record** (not logged verbatim) — ELI5 system explain, submission anxiety, voice-on-video preference.

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
