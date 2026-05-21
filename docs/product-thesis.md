# Product thesis — Phase 2 (locked slice)

**Working title:** Settlement confidence review  
**Company bet context:** Pri’s Q1 craft focus on settlement; 82% of venues bypass the in-app tool.

---

## Thesis (one paragraph)

Independent venues do not lose artist and agent trust because they cannot multiply percentages—they lose it because **no one agrees what the deal means** by the time money is due. Greenroom already holds tickets, expenses, and deal prose, but it does not help Mariana **confirm an interpretation**, **surface ambiguity before 2am**, or **show defensible math** to the tour manager and agent. This slice adds an **AI-assisted settlement confidence review**: extract and stress-test deal terms from messy inputs, require human confirmation on ambiguous branches (especially recoup stacking), then run **deterministic** payout math and produce an agent-ready walkthrough. We are not building “AI does settlement”; we are building **“nothing moves to finalize until the room trusts the canon.”**

---

## Core user pain

**Primary user:** Mariana Reyes, lead booker at The Crescent.

**The pain is not “I need a calculator.”** She already has a Google Sheet that calculates Vs deals. Her pain is:

1. **Interpretation risk** — The deal lives in an 80-word agent email and `deal_notes_freetext`. Structured fields drift (BC2, BC6, BC9). At settlement she must defend *what the deal meant*, not just the arithmetic.

2. **Conversation risk at 2am** — Settlement is a negotiation with the tour manager (Diego). Long nights happen when terms were ambiguous, expenses were surprises, or math was opaque. Mariana: *“The math is the easy part. The hard part is the back-and-forth.”*

3. **No system of record for agreement** — TM may sign off; the agent disputes Monday (BC1: disputed status + “Looks good — TM”). There is no canonical “we agreed recoup is inside the cap” stored anywhere (`calculation_json` is 0/537).

4. **Downstream trust collapse** — Sarah (agent) reads a PDF and asks “what is this?” — already a failure. Coastal Spell: **$720 + hours + goodwill** over one ambiguous phrase.

**Secondary users:** Marcus (signs on faith, cares about routing/reputation), Diego (needs line-by-line proof), Sarah (needs itemization + provenance + unambiguous terms).

---

## Why this matters operationally

| Stake | Mechanism |
|-------|-----------|
| **Revenue routing** | Agents route around venues with settlement friction; Marcus cited ~$80K/year loss from one bad experience. |
| **Labor** | ~25 hrs/month venue-wide on settlement + cleanup (Marcus); half a Wednesday chasing expenses (Mariana). |
| **Direct cash** | Concessions ($720 Coastal Spell), hospitality disputes, marketing recoup patterns (Daniel Hwang ×5 disputed marketing recoups in DB). |
| **Product adoption** | 334/537 deals use types the in-app tool cannot settle; Greenroom is a **data warehouse for the 2am spreadsheet**, not the ritual itself. |
| **Strategic** | Pri: settlement is trust-critical and existential (82% bypass). Winning independents = agents trust you to settle cleanly. |

Settlement is where **operational competence becomes a relationship asset**. A spreadsheet can compute; only the product can **carry interpretation, audit trail, and confidence** into the conversation.

---

## Why ambiguity and trust beat “calculation” as the problem

**Evidence from the repo and DB:**

- **Dual math already exists** — Seed `computeSettlement()` handles Vs; `dealMath.ts` does not. The gap is not unknown formulas; it is **which formula applies to *this* deal email**.
- **Coastal Spell** — Gross and % were agreed; **$720** came from “marketing recoup against gross” vs “inside $2,500 cap.” Daniel: *“I think it can be read either way.”*
- **15 settlements** — `disputed` + positive TM signoff: status models agent dispute, not TM night-of agreement.
- **21 paid settlements** — still carry **disputed recoups**: money moved, liability remains.
- **0 calculation_json** — no persisted “how we got here.”

**Implication:** Adding Vs to `dealMath` alone would not prevent the next Coastal Spell. **Calculation without confirmed interpretation repeats the failure mode.** Trust requires:

- **Itemization** (Sarah)
- **Provenance** (Diego)
- **Explicit choices** on ambiguous clauses (Mariana + agent)
- **Confidence signal** before Marcus signs blind

AI is suited to **extraction, contradiction detection, and explanation**—not to inventing the payout number.

---

## Why this is the highest-leverage slice

**Compared to alternatives in the brief:**

| Alternative | Why lower leverage *for this bet* |
|-------------|-----------------------------------|
| Full Vs / door / ratchet calculator | Necessary eventually; does not fix prose/structured drift or recoup semantics; 59 Vs deals mention walkout/ratchet in prose alone. |
| Dispute lifecycle / ticketing | Symptoms; BC1 shows status field is wrong abstraction. |
| Agent email automation | Output without canon = fancier black box. |
| Expense aggregation only | Reduces prep time; does not fix agent pushback on *terms*. |
| Real-time prediction | Different job; doesn’t move 82% into product. |

**Why confidence review wins:**

1. **Hits the documented failure** — Coastal Spell, BC12 WME marketing pattern, BC2/6/9 prose drift.
2. **Unblocks adoption path** — Interpretation → confirm → deterministic math → explain; Vs calculator becomes *safe* to use.
3. **Uses AI where judgment is scarce** — Reading agent prose, flagging stacking ambiguity, summarizing for Monday agent.
4. **Fits 5-day depth** — Shippable on `/settle` with Coastal Spell as hero demo.
5. **Matches CEO narrative** — Craft and trust, not feature count.

**Leverage sentence:** *One confirmed interpretation prevents a dispute class; one dispute prevented protects more margin than optimizing flat-deal math.*

---

## What we intentionally do NOT build

| Cut | Rationale |
|-----|-----------|
| **LLM performs payout math** | Unauditable; fails Diego/Sarah trust test. Code calculates after human confirms canon. |
| **All deal types** | Standard Vs + flat/% gross path only; walkout/tier ratchet flagged “out of scope.” |
| **Full lifecycle workflow** | No submit/revise/pay state machine; read-only lifecycle stays. |
| **TM mobile app / share links** | Diego pre-review = v2. |
| **Auto-send agent emails** | Mariana sends; system generates draft summary. |
| **Replace spreadsheets entirely** | Success = Mariana starts settle *in Greenroom* for Vs shows with confidence, not 100% sheet abandonment in v1. |
| **Advance PDF ingestion** | Adjacent Pri priority; different surface. |
| **Fix all BC1–BC12 in data** | Surface flags; don’t cleanse seed data. |

---

## Success metrics

**North star (venue):** % of **Vs (and ambiguous) shows** settled with a **confirmed interpretation record** before payout discussion ends.

**Leading indicators (product):**

| Metric | Target direction | Why |
|--------|------------------|-----|
| Interpretation completed before show date | ↑ | Wednesday > Friday (Mariana + Marcus ask). |
| Ambiguous-clause flags resolved pre-settle | ↑ | Recoup + cap stacking explicit. |
| Settlements with persisted calculation/interpretation JSON | ↑ from 0 | Auditability. |
| In-app settle sessions on Vs shows (vs empty state bounce) | ↑ | Adoption proxy. |
| Disputed rate on shows with confidence review | ↓ (longitudinal) | Pri’s reports metric. |
| Agent “what is this?” follow-ups (qualitative) | ↓ | Sarah test in validation. |

**Guardrail metrics:**

| Metric | Watch for |
|--------|-----------|
| Time to complete confidence review | Must be < sheet re-entry for Vs. |
| Override rate on AI extraction | High = prompts/rules need tuning; not hidden. |
| False “high confidence” on BC2/6/9 deals | Must stay low in labeled eval set. |

**Validation plan (case study scale):**

- Label **20 deals** (prose + structured) for extraction/contradiction accuracy.
- **Coastal Spell** must show dual outcome ($11,565 vs $12,285) until Mariana picks.
- **5 shadow scenarios** with Mariana script: “Would you email the agent Wednesday?”

---

## Positioning vs generic “AI feature”

**Generic (avoid):** “We use AI to automate settlement.”

**Our framing:** “We use AI to make settlement **defensible**—by turning agent prose into a confirmed deal canon, flagging contradictions before the back office, and explaining deterministic math to the people who have to trust it.”

**Design principles:**

1. **Propose, don’t prescribe** — AI suggests interpretation; Mariana confirms.
2. **Calculate in code** — Same input → same output; LLM never owns dollars.
3. **Confidence is honest** — Low confidence blocks “ready to settle,” not hidden in UI.
4. **Optimize for the conversation** — Outputs are for TM + agent readability, not internal JSON.

---

## Interview elevator pitch (45 sec)

> “Greenroom’s settlement tool fails on trust, not arithmetic. Sixty-two percent of Crescent deals are Vs, and the app can’t settle them—but even where it can, prose and structured fields disagree, recoups aren’t in the math, and we have fifteen disputed settlements where the tour manager already said ‘looks good.’ I’m building settlement **confidence review**: AI extracts deal terms and flags ambiguity—especially marketing recoup vs expense cap—Mariana confirms one canon, code runs the waterfall, and we export an agent-ready summary. We’re not automating 2am; we’re making sure nothing ambiguous ships as a final number.”

---

## Slice lock checklist

- [x] User pain named (interpretation + 2am conversation, not calculator)
- [x] Operational stakes tied to routing, labor, cash, adoption
- [x] Ambiguity > calculation defended with DB/repo evidence
- [x] Cuts explicit (no LLM math, no full lifecycle, no all deal types)
- [x] Metrics: north star + leading + guardrails + validation
- [x] Hero narrative: Coastal Spell + confidence gate

**Next phase:** Implement on `/shows/[id]/settle` per `docs/5-day-plan.md` Day 2–4.
