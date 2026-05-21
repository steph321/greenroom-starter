# Database audit — deliberate flaws & patterns

**Last run:** `npx tsx scripts/audit-db.ts`  
**Source of truth for planted issues:** `db/seed.ts` (lines ~1051–1430)  
**If Coastal Spell or breadcrumbs are missing:** run `npm run db:reset` (Windows: delete `data/greenroom.db`, then `npx drizzle-kit push` and `npx tsx db/seed.ts`).

---

## Why the data is messy (by design)

The case study evaluates whether you **read past the UI** and design for **prose vs structured drift**, not whether you trust badges and single fields. Twelve breadcrumbs (BC1–BC12) are planted in `db/seed.ts`, plus the **Coastal Spell** narrative show.

---

## Planted breadcrumbs (answer key)

| ID | What's wrong | How to spot | Product implication |
|----|----------------|-------------|---------------------|
| **BC1** | `status = disputed` but `signoff_text` is positive ("Looks good — TM") | Settle page shows red Disputed badge; expand signoff | Lifecycle status ≠ night-of agreement; need TM signoff vs agent dispute as separate facts |
| **BC2** | `bonuses_json` threshold ≠ prose (phone renegotiation; prose updated, JSON not) | Search deals for "structured field still reflects" | AI must surface prose/JSON conflicts before bonus applies |
| **BC3** | `status = paid` but recoup line still `disputed` | Paid show with open marketing recoup in `recoups_json` | Recoup lifecycle independent of payout; don't hide disputed lines after pay |
| **BC4** | Marketing recoup filed under `production_overage` category | Label says Spotify ad; category wrong | Extraction + categorization errors; agent sees wrong bucket |
| **BC5** | Hospitality expense > `hospitality_cap`, `absorbed_by_venue = false` | Query expenses vs cap | Wednesday flag: "hospitality will blow cap" |
| **BC6** | Prose says 85/15, `percentage = 0.75` | Prose contains "85/15" with structured 0.75 | % drift breaks Vs payout |
| **BC7** | `signed_at` < `submitted_at` | Timestamp inversion on one paid settlement | Audit trail / lifecycle UI can't trust timestamps blindly |
| **BC8** | Duplicate sound expense, same amount, ~3h apart, second entered by GM | Group expenses by show/category/amount | Duplicate detection in trust layer |
| **BC9** | Prose: "$X guarantee **vs** 85% net"; `deal_type = percentage_of_net` | `show_0001`-style deals | Wrong deal type → in-app tool uses wrong engine |
| **BC10** | `counts_toward_gross = false` but comp `notes` say Sarah agreed they count | Comp notes vs boolean flag | Gross basis ambiguity for % deals |
| **BC11** | `artists.prior_show_count = 0` for artists with 4+ past shows | Red Letter, Pen Pal, etc. | Stale CRM field; don't use for trust scoring |
| **BC12** | Cluster of **disputed marketing recoups** on Daniel Hwang (WME) shows | Agent-level pattern | Same failure mode as Coastal Spell ×3/year (Mariana's email) |

---

## Coastal Spell (`show_coastal_spell_dispute`) — canonical narrative

**Only present after a fresh seed.** Injected in `db/seed.ts` (March 14, 2025).

| Field | Seeded value | Notes |
|-------|----------------|-------|
| Deal | Vs $5k vs 80% net, cap $2,500, hospitality $500 | Prose includes **"marketing recoup $900 against gross"** |
| Tickets | Gross $19,840, fees $1,984 | Matches dispute thread |
| Expenses (rows) | Sound/lights/production/hospitality/backline sum **$1,600** | Marketing is a **recoup**, not expense row |
| Recoup | $900 marketing, `status: disputed` | |
| Settlement `total_to_artist` | **$12,285** | Agent-correct interpretation (recoup inside cap) |
| Mariana's original math | **$11,565** | Recoup off gross before cap → **$720 gap** |
| Settlement `status` | `disputed` | Marcus paid $720 but revision not formalized in system |
| `notes` | Documents both numbers + email thread | |

**Intentional product tension:** UI may still show unsupported Vs calculator; settlement row already stores $12,285 while recoup remains disputed — mirrors "paid concession, messy system."

---

## Audit results (live DB snapshot)

Counts from `scripts/audit-db.ts`:

| Check | Count |
|-------|------:|
| BC1 disputed + positive signoff | 10 |
| BC2 bonus prose/JSON drift (explicit marker) | 1 |
| BC3 paid + disputed recoup | 21 |
| BC6 prose 85% / structured 75% | 1 |
| BC7 reversed timestamps | 1 |
| BC9 prose Vs / structured % of net | 1 |
| BC10 comp flag vs note | 1 |
| BC11 priorShowCount stale (≥4 shows) | 5+ artists |
| BC12 Daniel Hwang disputed marketing recoups | 5 |
| BC8 duplicate expenses | 1+ |
| BC5 hospitality over cap (sample) | 5+ |

**Deal mix (~537 shows):**

| deal_type | count | In-app calculator |
|-----------|------:|-------------------|
| vs | 195 | Not supported |
| flat | 185 | Supported |
| percentage_of_net | 109 | Not supported |
| door | 30 | Not supported |
| percentage_of_gross | 18 | Supported |

**~334 / 537 deals** cannot be settled with current `lib/dealMath.ts` — aligns with Pri's 82% spreadsheet bypass story.

---

## Additional inconsistencies (not always a single BC row)

1. **`deal_notes_freetext` vs structured fields** — README states prose is truth; structured fields filled inconsistently (~half of bonuses only in prose).
2. **`bonuses_json` exists but in-app tool ignores it** for unsupported deal types; even for flat/gross, prose-only bonuses are invisible.
3. **`settlements.total_expenses` vs sum(`expenses`)** — can diverge; Coastal Spell notes vs rows are documented in seed comments.
4. **`calculation_json`** — often empty or stale on past settlements; UI may not reflect how number was derived.
5. **Recoup vs expense double-counting** — Coastal Spell keeps marketing in recoups, not expenses; conflating them recreates the dispute.
6. **Comp `counts_toward_gross`** — rules vary by deal; category defaults don't match negotiated exceptions.
7. **Agent `preferences_notes`** — Daniel Hwang seeded with Coastal Spell / ambiguity hint — pattern in data, not just one show.

---

## Queries to run yourself

```bash
npx tsx scripts/audit-db.ts
```

```sql
-- BC1
SELECT show_id, signoff_text FROM settlements
WHERE status = 'disputed' AND signoff_text LIKE '%good%';

-- Prose vs structured (manual review)
SELECT show_id, deal_type, percentage, guarantee_amount, expense_cap,
       substr(deal_notes_freetext, 1, 120)
FROM deals WHERE deal_type = 'vs' LIMIT 20;

-- WME marketing dispute pattern
SELECT a.name, COUNT(*) FROM settlements s
JOIN shows sh ON sh.id = s.show_id
JOIN artists ar ON ar.id = sh.artist_id
JOIN agents ag ON ag.id = ar.agent_id
WHERE ag.name = 'Daniel Hwang'
  AND s.recoups_json LIKE '%disputed%'
GROUP BY a.name;
```

---

## How this feeds the AI Trust Layer slice

Your product should **detect**, **explain**, and **force resolution** on:

1. Prose vs structured conflicts (BC2, BC6, BC9)
2. Recoup stacking ambiguity (Coastal Spell, BC12)
3. Status vs signoff mismatch (BC1)
4. Post-pay disputed recoups (BC3)
5. Cap overruns not absorbed (BC5)
6. Duplicate expenses (BC8)

**Do not** silently pick one interpretation — Mariana/Daniel/Sarah all need to see **why** and **confidence level**.
