# Settlement system analysis

**Date:** 2026-05-19  
**Purpose:** Codebase-grounded read of how settlement works today, where it breaks, and narrow AI opportunities for the case study slice (**AI Settlement Interpretation & Trust Layer**).

Related docs: [`database-audit.md`](./database-audit.md), [`5-day-plan.md`](./5-day-plan.md), [`process-log.md`](./process-log.md).

---

## 1. How settlement currently works

### Actual workflow (today)

Settlement in this repo is **read-only**. There are no server actions, forms, or APIs to draft, submit, or revise a settlement. Mariana’s real workflow (spreadsheet → TM → Marcus screenshot → agent PDF) is **simulated in seed data**, not executable in the product.

```
Inputs (DB)                    Show detail (/shows/[id])           Settle (/shows/[id]/settle)
─────────────────────────────────────────────────────────────────────────────────────────────
deals (structured + prose)  →  Deal terms, expenses, comps    →   calculateSettlement()
ticket_sales (gross, fees)  →  Box office summary           →     ├─ flat / % gross → worksheet
expenses (+ absorbed flag)  →  Expense table                →     └─ vs / % net / door → unsupported UI
comps                       →                                 →   recoups_json (display only)
settlements (status, totals, signoff, notes)
```

**Operational sequence (transcripts + data):**

| Phase | What happens | In product? |
|-------|----------------|-------------|
| Booking | Agent email → Mariana enters deal | `deals` structured + `deal_notes_freetext` |
| Week of show | Expenses trickle in | `expenses` |
| Post-show | TM + Mariana settle | **Math outside app** for ~62%+ of deals (Vs, % net, door) |
| Night-of | TM signoff | `settlements.signoff_text` (text only) |
| GM | Screenshot approval | Not modeled |
| Monday | Agent reviews; disputes | Email → `status = disputed`; `notes` |

### Settlement lifecycle

**Schema** (`db/schema.ts`, `lib/settlementStage.ts`):

`draft → submitted → in_review → signed | disputed → revised → finalized → paid` (+ `voided`)

`nextStages()` defines valid transitions but **nothing in the UI calls it** — lifecycle is display-only.

**Settle page** (`app/shows/[id]/settle/page.tsx`) uses a **5-step bar** that collapses `disputed` / `revised` into step 3 (“Signed” / “Finalized”). Red dispute styling can appear alongside positive `signoff_text` (see BC1 in database audit).

---

## 2. Data models (settlement-relevant)

| Entity | Role | Trust note |
|--------|------|------------|
| `deals` | One per show | Structured fields = what tool reads; prose = what Mariana trusts (per README + UI) |
| `ticket_sales` | Gross, fees, qty | Feeds calculator |
| `expenses` | Line items; `absorbed_by_venue` | Pass-through sum; can be incomplete or duplicated (BC8) |
| `comps` | Per-category; `counts_toward_gross` | **Not used in `dealMath`** (BC10) |
| `settlements` | Outcome, lifecycle, `recoups_json`, signoff, notes | `total_to_artist` from **seed**, not live UI |
| `calculation_json` | Intended audit trail | **Schema only — never written or read in app** |

**Recoups** (`recoups_json`): categories `marketing`, `hospitality_overage`, etc.; status `agreed` | `disputed` | `withdrawn`. Orthogonal to expenses — marketing can be expense row *and* recoup. Stacking rules (inside cap vs off gross) exist only in prose.

---

## 3. Settlement calculation logic (two engines)

### A. In-app — `lib/dealMath.ts`

**Supported:** `flat`, `percentage_of_gross` only.

- Sums gross/fees; sums non-absorbed expenses (shown; not deducted on flat/gross).
- Reads `bonuses_json` only — prose-only bonuses invisible.
- `tier_ratchet` in JSON explicitly not handled.

**Unsupported:** `vs`, `percentage_of_net`, `door` → `{ supported: false }`.

### B. Seed — `computeSettlement()` in `db/seed.ts`

Handles all deal types including **Vs** (guarantee vs % of net after capped expenses + gross-threshold bonuses when % wins).

**Does not apply recoups** to `total_to_artist`. Recoups are stored for display/dispute only.

### C. Settle page behavior

- **Supported:** Live calc vs `settlements.total_to_artist` — UI notes if different.
- **Unsupported:** Amber empty state + inputs + prose + optional “Actually settled (off-platform)” from seed.
- **Recoups:** Listed below calculator; **do not change hero number**.

---

## 4. Unsupported deal types (volume)

Approximate mix (~537 shows): **vs ~195**, **flat ~185**, **% of net ~109**, **door ~30**, **% of gross ~18**.

**~334 deals** cannot use in-app calculator (~62%).

**Reports caveat:** `inAppToolUsageRate` in `lib/queries.ts` = share of deals whose *type* is calculable, **not** actual product usage (Pri’s 18% is a different metric).

---

## 5. UX pain points

| Pain | Evidence |
|------|----------|
| Dead end for majority of deals | `UnsupportedDeal` component on settle page |
| Prose displayed, not used | `deal_notes_freetext` on show + settle; not parsed |
| Recoups severed from payout | `RecoupsSection` after calculator; no math link |
| Lifecycle cosmetic | No transitions; disputed folded into step 3 |
| No calculation audit trail | `calculation_json` unused |
| Misleading structured-first UI | Show page emphasizes fields; prose labeled “what Mariana trusts” below |
| Status vs signoff conflict | BC1: disputed + “Looks good — TM” |

---

## 6. Trust, ambiguity, auditability

| Issue | Example |
|-------|---------|
| No canonical deal interpretation | Coastal Spell: $11,565 vs $12,285 from same email |
| Prose vs structured drift | BC2 bonus threshold, BC6 85% vs 75%, BC9 Vs prose vs `percentage_of_net` |
| Status ≠ night-of reality | BC1 TM signoff + disputed status |
| Recoup semantics undefined | “against gross” vs “inside expense cap” not in schema |
| No provenance for math | Diego/Sarah need line-by-line trace; partial only on flat/gross |
| Post-pay disputes | BC3: paid + disputed recoup |

### `deal_notes_freetext`

- Seeded as primary narrative.
- Shown on show detail + unsupported settle.
- **Not parsed** in application code.
- UI explicitly warns structured bonuses only; prose invisible to tool.

---

## 7. Coastal Spell (reference dispute)

Show id: `show_coastal_spell_dispute` (present after `npm run db:reset`).

- Vs $5k vs 80% net, cap $2,500, $900 marketing recoup in prose.
- Agent-correct payout **$12,285**; Mariana read **$11,565** → **$720** gap.
- Seeded: `total_to_artist: 12285`, `status: disputed`, recoup still disputed.
- See `data/dispute-thread.md` and `docs/database-audit.md`.

---

## 8. Biggest operational pain (ranked)

1. Vs / % net unsupported → spreadsheet default.
2. Ambiguous deal language discovered at settle (recoup stacking, % basis, bonuses).
3. Recoups excluded from math and semantics (WME / Daniel Hwang pattern — BC12).
4. Expense readiness (BC5 hospitality over cap).
5. Agent audit Monday — no provenance-rich export from app.
6. Lifecycle/signoff don’t match operations (TM OK, agent disputes later).

---

## 9. Fragile workflows

- Settle unsupported deal: inputs + prose + maybe off-platform total — user does math elsewhere.
- Recoup dispute conflated with settlement `disputed` status.
- Bonus JSON vs prose; tier ratchet unsupported.
- Expense vs recoup double-count risk if interpreter is naive.
- Reports “in-app usage” overstates fit.

---

## 10. Narrow AI opportunities (case study slice)

**Principle:** LLM interprets and flags; **deterministic code calculates**; human confirms ambiguous branches.

### Tier 1 — Case study core

| Feature | Purpose |
|---------|---------|
| Deal interpretation panel | Parse prose + structured → proposed canon (incl. recoup stacking) |
| Contradiction flags | BC2/6/9 patterns; prose vs JSON |
| Dual-outcome recoup preview | Coastal-style $11,565 vs $12,285; require pick |
| Explain settlement | Narrate deterministic waterfall |
| Agent summary export | Sarah-style itemized markdown |
| Confidence scoring | Per-field + overall; low = not ready to settle |

### Tier 2 — Small hooks

- Persist confirmed interpretation (`calculation_json` or `interpretation_json`).
- BC1 messaging: TM signoff vs agent dispute.
- Wednesday flags on show detail (hospitality over cap, ambiguous recoup phrases).

### Tier 3 — Defer

- Full lifecycle UI, TM mobile, walkout/tier ratchet, auto-email agents.

### Target architecture

```
deal_notes_freetext + deals.* + recoups + expenses + tickets
        → AI interpret + rule flags
        → Human-confirmed canon (JSON)
        → dealMath (Vs standard — port seed logic)
        → explanation + agent summary + confidence
```

---

## Key files reference

| File | Role |
|------|------|
| `db/schema.ts` | Deals, settlements, recoups types |
| `lib/dealMath.ts` | In-app calculator (flat, % gross) |
| `db/seed.ts` | `computeSettlement`, breadcrumbs, Coastal Spell |
| `lib/settlementStage.ts` | Lifecycle helpers (unused for actions) |
| `lib/queries.ts` | `getShowById`, reports aggregates |
| `app/shows/[id]/page.tsx` | Prep surface |
| `app/shows/[id]/settle/page.tsx` | Settle UI |
| `scripts/audit-db.ts` | Repeatable flaw audit |
