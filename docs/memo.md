# PM Memo — AI-Assisted Settlement Confidence Review

**Author:** Stephanus Sylvanus  
**Context:** Greenroom Applied AI PM case study (The Crescent / independent venue settlement)  
**Slice shipped:** Settlement confidence review on `/shows/[id]/settle`  
**Date:** May 2026

---

## Operational problem

Independent venues do not lose artist and agent trust because they cannot multiply percentages. They lose it because **no one agrees what the deal meant** by the time money is due.

Mariana Reyes, lead booker at The Crescent, already has a Google Sheet that handles Vs math. Her pain is not arithmetic—it is **interpretation risk at 2am**, **back-and-forth with the tour manager**, and **Monday disputes** when the agent reads a number that does not match how they read the same email. From the Wednesday check-in: *“The math is the easy part. The hard part is the back-and-forth.”*

Greenroom holds tickets, expenses, recoups, and deal prose, but the in-app settlement tool only settles **flat** and **percentage of gross** deals. For everything else—including **195 Vs deals** in the seed database—it shows an empty state and sends the booker back to a spreadsheet. The product becomes a **warehouse for inputs**, not the ritual where the venue commits to what the deal meant.

The canonical failure is **Coastal Spell** (March 2025): gross and artist percentage were not in dispute. **$720** and hours of goodwill were lost over one phrase—“marketing recoup of $900 against gross”—which the agent and venue read differently (inside the $2,500 expense cap vs deducted like fees before the cap). The settlement row in Greenroom already stores **$12,285** while the recoup line remains **disputed** and `calculation_json` is empty across **537 settlements**. Money moved; agreement did not.

---

## Why I chose this slice

Pri’s Q1 craft bet is settlement; **82% of venues bypass** the in-app tool. The brief offers many angles—full Vs calculators, dispute ticketing, agent email automation, expense aggregation. I chose **confidence review** because it attacks the documented failure mode rather than a symptom.

| Alternative | Why I deprioritized it |
|-------------|------------------------|
| Vs calculator only | Seed already has Vs math in `computeSettlement()`; `dealMath.ts` does not. The gap is **which formula applies to this email**, not a missing formula. |
| Dispute workflow | BC1 shows `status = disputed` alongside positive TM signoff—status is the wrong abstraction without a confirmed interpretation record. |
| Agent email automation | Output without canon is a fancier black box; Sarah still asks “what is this?” |
| Expense prep only | Saves Wednesday time; does not prevent agent pushback on **terms**. |

**Leverage:** One confirmed interpretation on an ambiguous clause prevents a dispute class. One Coastal-scale dispute costs more than years of optimizing flat-deal math. The slice is shippable on one route (`/settle`) with a hero demo and a credible path to adoption: interpret → confirm → calculate → explain.

---

## Insights from the repo and database

I treated the starter repo as operational ground truth, not the UI alone.

**Deal mix (~537 shows):** Vs (195), flat (185), percentage of net (109), door (30), percentage of gross (18). **334 shows** use deal types the in-app engine does not support.

**No audit trail for math:** `calculation_json` is **0/537**. When agents dispute, there is nothing to replay except Mariana’s spreadsheet and email.

**Trust ≠ lifecycle status:** 15 settlements are `disputed` with positive TM signoff (BC1). 21 are `paid` with recoups still marked disputed (BC3). The UI’s red badge is not the same as “the agent agrees.”

**Prose vs structured drift:** Planted breadcrumbs include bonus JSON vs renegotiated prose (BC2), prose “85/15” vs `percentage = 0.75` (BC6), prose Vs language with `deal_type = percentage_of_net` (BC9), and comp notes contradicting `counts_toward_gross` (BC10). Any extractor that trusts a single field will misfire.

**Pattern, not one-off:** Five disputed **marketing recoups** on Daniel Hwang (WME) shows (BC12)—the same semantic failure as Coastal Spell. Mariana’s email to Marcus cites **~3/year** on this pattern.

**CEO memo + dispute thread** align with the DB: routing risk (~$80K cited), ~25 hrs/month on settlement cleanup, concessions and reputation—not feature gaps on flat guarantees.

---

## Product philosophy

**LLM proposes; code calculates; humans confirm the canon.**

Settlement is where operational competence becomes a relationship asset. A spreadsheet can compute; only the product can carry **interpretation, explicit choices on ambiguous branches, and defensible explanation** into the conversation with Diego (tour manager) and Sarah (agent).

AI belongs where judgment is scarce: reading agent prose, surfacing contradictions, naming stacking ambiguity, drafting an agent-ready walkthrough. AI does **not** belong where auditability is required: the payout number. Diego needs line-by-line proof; Marcus needs to know what he is signing; Sarah needs itemization and provenance—not a single model output.

**North star behavior:** Nothing moves to finalize until the room trusts the canon. We are not building “AI does settlement.” We are building **“Greenroom makes the 2am conversation shorter and the Monday email rarer.”**

---

## Design decisions

**1. Confidence review on the existing settle page**  
Bookers already land here after the show. I preserved lifecycle bar, recoups, and sign-off sections and replaced the Vs “unsupported” dead end with the review panel—same workflow, new capability.

**2. Human-confirmed deal canon**  
Structured fields (`DealCanon`) are editable and gated behind **Confirm interpretation**. Walkthrough and agent copy stay locked until confirm. Recoup stacking is explicit (`inside_expense_cap` vs `deducted_before_net`) because Coastal proved implicit defaults are expensive.

**3. Dual preview before confirm**  
When marketing recoup is present, the UI runs both stacking readings and shows the **delta to artist** (~$720 on Coastal). Mariana chooses the reading that matches the agent memo; the system does not guess.

**4. Rules-first extraction, optional LLM garnish**  
`interpretDealSync()` uses deterministic parsing of `deal_notes_freetext` (85/15 = artist share, “against gross” on recoup, etc.). Optional OpenAI adds rationale only—no number changes. Degraded mode is visible when the API is missing.

**5. Deterministic waterfall + template explanations**  
`calculateWaterfall()` applies the confirmed canon. `explainSettlement()` produces step labels, flags, and markdown for copy/paste—operations tone, no marketing voice.

**6. Operational UI**  
Readiness chips, severity-tiered discrepancy cards, subtle confidence badges, locked walkthrough. Designed for 2am scanability, not demo polish.

---

## Tradeoffs

| Choice | Upside | Cost |
|--------|--------|------|
| Rules-first vs LLM-first extraction | Auditable, works offline, predictable for demo | Misses novel phrasing until rules expand |
| Confirm gate before math | Forces explicit agreement on ambiguity | Extra click; power users may chafe |
| Vs + standard path only in v1 | Depth on hero failure mode | Walkout, tier ratchets, door deals still flagged out of scope |
| Read-only lifecycle | Fits 5-day scope; no state-machine risk | Cannot “submit revision” from this slice |
| Surface BC flags, don’t fix seed | Shows product thinking on real mess | DB still looks broken—intentional for case study |
| Client-side recompute on canon edit | Instant feedback while editing | No server persistence of confirmed canon yet |

I accepted **slower v1 adoption** (Mariana still may spreadsheet first) in exchange for **trustworthy v1 behavior**. A wrong auto-settlement is worse than no settlement.

---

## What I intentionally cut

- **LLM performs payout math** — fails Diego/Sarah trust test.  
- **All deal types and mechanics** — walkout pots, tier ratchets, comps-in-gross: detected, not modeled.  
- **Full dispute / pay / revise workflow** — lifecycle stays read-only.  
- **Auto-send to agents** — system generates copy; Mariana sends.  
- **TM mobile / share links** — Diego pre-review is v2.  
- **Advance PDF ingestion** — adjacent Pri priority; different surface.  
- **Cleansing planted DB flaws** — product should flag BC1–BC12, not hide them.  
- **Replacing spreadsheets in week one** — success is starting settle **in Greenroom** for Vs with confidence, not 100% sheet abandonment.

---

## Risks of AI interpretation

| Risk | Mitigation in v1 |
|------|------------------|
| **Hallucinated terms** | Numbers come from regex/rules + structured fields; LLM does not set canon. |
| **Overconfidence** | Per-field and overall confidence; blocking discrepancies prevent confirm. |
| **Wrong 85/15 or % basis** | Explicit tests; merge logic prefers prose with surfaced conflict (BC6). |
| **Automation bias** | Confirm gate; dual preview on stacking; editable canon. |
| **Agent distrust of “AI settled this”** | Agent statement cites deterministic steps; human confirmed interpretation. |
| **Liability drift** | No auto-finalize; no payment rails; copy is draft for Mariana. |

**Residual risk:** Rules will not catch every agent drafting style. v1 must log **what was confirmed, by whom, when**—still not persisted to `calculation_json` in this build; that is the highest-priority hardening.

---

## Success metrics

**North star:** % of Vs (and flagged ambiguous) shows with a **confirmed interpretation record** before payout discussion ends.

**Leading indicators**

| Metric | Why it matters |
|--------|----------------|
| Interpretation completed before show date | Wednesday > Friday (Marcus + Mariana ask). |
| Ambiguous-clause flags resolved pre-settle | Recoup stacking explicit in canon. |
| Settlements with persisted interpretation/calculation JSON | ↑ from **0** — auditability. |
| In-app settle sessions on Vs shows (vs empty-state bounce) | Adoption proxy for 82% bypass. |
| Disputed rate on shows that used confidence review | Longitudinal trust (Pri’s reports). |
| Qualitative: agent “what is this?” follow-ups | ↓ — Sarah acceptance test. |

**Guardrails:** Do not optimize for “AI clicks confirm.” Track **time-to-agreement** and **dispute rate**, not model confidence scores.

---

## What I would ship next

**1. Persist confirmed canon** — Write interpretation + waterfall snapshot to `calculation_json` on confirm; version on revision. Without this, the slice improves conversation but not system of record.

**2. Vs in production calculator** — Wire confirmed canon into the same engine path flat deals use; retire empty state for standard Vs.

**3. Pre-settle warnings on show record** — Surface BC5 hospitality cap, BC2 bonus drift, BC12 agent-pattern flags before Friday night.

**4. Diego read-only view** — Share link or PDF from `bodyMarkdown` without edit rights; reduces 2am phone tag.

**5. Expand rules + evaluation set** — Golden tests from Coastal + 10 seeded edge deals; only then widen LLM role (clause tagging, not math).

**6. Dispute semantics** — Split TM signoff, agent dispute, and venue concession; stop overloading `status = disputed`.

---

## Summary

Greenroom’s craft gap is not missing multiplication—it is **missing agreement**. This slice uses AI where language is messy and code where money must be defensible, with a human confirm on the branches that actually start fights. Coastal Spell is not a calculator bug; it is a **canon bug**. The product job is to make the canon visible, choosable, and explainable before anyone presses send on a settlement email.

---

*Related artifacts: `docs/product-thesis.md`, `docs/database-audit.md`, `docs/ux-confidence-review-workflow.md`, `docs/ai-interpretation-layer.md`, `docs/settlement-explanation.md`.*
