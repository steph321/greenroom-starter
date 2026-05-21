-- Greenroom settlement inspection queries
-- Run against: data/greenroom.db
--
-- Options:
--   npx tsx scripts/run-sql-audit.ts          (runs all sections, prints counts)
--   sqlite3 data/greenroom.db < docs/sql-inspection-queries.sql   (if sqlite3 installed)
--   DB Browser for SQLite → Execute SQL

-- =============================================================================
-- A. SETTLEMENT LIFECYCLE & CONFLICTING STATES
-- =============================================================================

-- A1. Status distribution (Pri's dispute rate baseline)
SELECT status, COUNT(*) AS cnt,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM settlements), 1) AS pct
FROM settlements
GROUP BY status
ORDER BY cnt DESC;

-- A2. BC1 — Disputed settlement but positive TM sign-off (trust seam)
SELECT s.show_id, sh.date, a.name AS artist, s.status,
       s.signoff_text, substr(s.notes, 1, 120) AS notes_preview
FROM settlements s
JOIN shows sh ON sh.id = s.show_id
JOIN artists a ON a.id = sh.artist_id
WHERE s.status = 'disputed'
  AND (
    s.signoff_text LIKE '%good%'
    OR s.signoff_text LIKE '%OK%'
    OR s.signoff_text LIKE '%ok%'
    OR s.signoff_text LIKE '%Sign off%'
  )
ORDER BY sh.date DESC;

-- A3. disputed_at set but status is paid/signed (lifecycle drift)
SELECT show_id, status, disputed_at, signed_at, paid_at, notes
FROM settlements
WHERE disputed_at IS NOT NULL
  AND status IN ('paid', 'signed', 'finalized')
LIMIT 25;

-- A4. BC7 — Timestamps out of order (signed before submitted)
SELECT show_id, status,
       datetime(submitted_at/1000, 'unixepoch') AS submitted,
       datetime(signed_at/1000, 'unixepoch') AS signed
FROM settlements
WHERE submitted_at IS NOT NULL AND signed_at IS NOT NULL
  AND signed_at < submitted_at;

-- A5. In review / submitted but already has signoff (workflow oddity)
SELECT show_id, status, signoff_text, submitted_at, signed_at
FROM settlements
WHERE signoff_text IS NOT NULL
  AND status IN ('draft', 'submitted', 'in_review');

-- A6. calculation_json never populated (auditability gap)
SELECT
  COUNT(*) AS total_settlements,
  SUM(CASE WHEN calculation_json IS NOT NULL AND calculation_json != '' THEN 1 ELSE 0 END) AS has_calc_json
FROM settlements;


-- =============================================================================
-- B. RECOUPS — PATTERNS, DISPUTES, ANOMALIES
-- =============================================================================

-- B1. Settlements with any recoup
SELECT
  SUM(CASE WHEN recoups_json IS NOT NULL AND recoups_json != '[]' THEN 1 ELSE 0 END) AS with_recoups,
  COUNT(*) AS total
FROM settlements;

-- B2. BC3 — Paid out but recoup still disputed (post-pay trust hole)
SELECT s.show_id, sh.date, a.name AS artist, s.status, s.recoups_json, s.notes
FROM settlements s
JOIN shows sh ON sh.id = s.show_id
JOIN artists a ON a.id = sh.artist_id
WHERE s.status = 'paid'
  AND s.recoups_json LIKE '%"status":"disputed"%';

-- B3. Disputed recoups by category (recurring causes)
-- Note: JSON in SQLite — use LIKE heuristics; precise parse in app/script
SELECT
  CASE
    WHEN recoups_json LIKE '%"category":"marketing"%' AND recoups_json LIKE '%"status":"disputed"%' THEN 'marketing'
    WHEN recoups_json LIKE '%"category":"hospitality_overage"%' AND recoups_json LIKE '%"status":"disputed"%' THEN 'hospitality_overage'
    WHEN recoups_json LIKE '%"category":"production_overage"%' AND recoups_json LIKE '%"status":"disputed"%' THEN 'production_overage'
    ELSE 'other_disputed'
  END AS disputed_recoup_type,
  COUNT(*) AS cnt
FROM settlements
WHERE recoups_json LIKE '%"status":"disputed"%'
GROUP BY disputed_recoup_type
ORDER BY cnt DESC;

-- B4. BC12 — Agent-level pattern: Daniel Hwang + disputed marketing recoups
SELECT ag.name AS agent, ag.agency_id, COUNT(DISTINCT s.show_id) AS shows_with_disputed_mkt_recoup
FROM settlements s
JOIN shows sh ON sh.id = s.show_id
JOIN artists ar ON ar.id = sh.artist_id
JOIN agents ag ON ag.id = ar.agent_id
WHERE s.recoups_json LIKE '%"category":"marketing"%'
  AND s.recoups_json LIKE '%"status":"disputed"%'
GROUP BY ag.id
ORDER BY shows_with_disputed_mkt_recoup DESC
LIMIT 10;

-- B5. Marketing expense row AND marketing recoup on same show (double-count risk)
SELECT d.show_id, sh.date, a.name,
       (SELECT SUM(amount) FROM expenses e WHERE e.show_id = d.show_id AND e.category = 'marketing') AS mkt_expense,
       s.recoups_json
FROM deals d
JOIN shows sh ON sh.id = d.show_id
JOIN artists a ON a.id = sh.artist_id
JOIN settlements s ON s.show_id = d.show_id
WHERE s.recoups_json LIKE '%"category":"marketing"%'
  AND EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.show_id = d.show_id AND e.category = 'marketing'
  )
LIMIT 20;

-- B6. BC4 — Label says marketing (Spotify) but category production_overage
SELECT s.show_id, s.recoups_json
FROM settlements s
WHERE recoups_json LIKE '%Spotify%'
  AND recoups_json LIKE '%"category":"production_overage"%';


-- =============================================================================
-- C. PROSE vs STRUCTURED DEAL FIELDS
-- =============================================================================

-- C1. Deal type mix vs in-app support
SELECT deal_type, COUNT(*) AS cnt
FROM deals
GROUP BY deal_type
ORDER BY cnt DESC;

-- C2. BC6 — Prose says 85/15, structured percentage still 0.75
SELECT show_id, deal_type, percentage, guarantee_amount, expense_cap,
       substr(deal_notes_freetext, 1, 200) AS notes
FROM deals
WHERE deal_notes_freetext LIKE '%85/15%'
  AND percentage = 0.75;

-- C3. BC9 — Prose describes Vs; structured type is percentage_of_net
SELECT show_id, deal_type, guarantee_amount, percentage, expense_cap,
       substr(deal_notes_freetext, 1, 250) AS notes
FROM deals
WHERE deal_type = 'percentage_of_net'
  AND (
    deal_notes_freetext LIKE '%guarantee vs%'
    OR deal_notes_freetext LIKE '%whichever greater%'
  );

-- C4. BC2 — Explicit prose warning that structured field is stale
SELECT show_id, deal_type, bonuses_json,
       substr(deal_notes_freetext, 1, 300) AS notes
FROM deals
WHERE deal_notes_freetext LIKE '%structured field still reflects%'
   OR deal_notes_freetext LIKE '%confirm before settlement%';

-- C5. Bonuses in JSON but prose-only bonus language (no JSON) — sample
SELECT show_id, deal_type,
       CASE WHEN bonuses_json IS NULL OR bonuses_json = '' THEN 'no_json' ELSE 'has_json' END AS json_flag,
       substr(deal_notes_freetext, 1, 150) AS notes
FROM deals
WHERE deal_notes_freetext LIKE '%bonus%'
   OR deal_notes_freetext LIKE '%sellout%'
   OR deal_notes_freetext LIKE '%threshold%'
ORDER BY json_flag, show_id
LIMIT 30;

-- C6. Vs deal with NULL guarantee or percentage (incomplete structured capture)
SELECT show_id, guarantee_amount, percentage, percentage_basis, expense_cap,
       substr(deal_notes_freetext, 1, 120) AS notes
FROM deals
WHERE deal_type = 'vs'
  AND (guarantee_amount IS NULL OR percentage IS NULL);


-- =============================================================================
-- D. AMBIGUOUS CLAUSES IN deal_notes_freetext
-- =============================================================================

-- D1. Marketing recoup language (Coastal Spell class)
SELECT show_id, deal_type, expense_cap,
       substr(deal_notes_freetext, 1, 280) AS notes
FROM deals
WHERE deal_notes_freetext LIKE '%marketing recoup%'
   OR deal_notes_freetext LIKE '%recoup%against gross%'
   OR deal_notes_freetext LIKE '%against gross%';

-- D2. Expense cap + recoup in same deal (stacking ambiguity)
SELECT show_id, deal_type, expense_cap,
       substr(deal_notes_freetext, 1, 280) AS notes
FROM deals
WHERE deal_notes_freetext LIKE '%expense%cap%'
  AND deal_notes_freetext LIKE '%recoup%';

-- D3. Unsupported Vs flavors in prose (walkout, ratchet, vs gross)
SELECT show_id, deal_type,
       substr(deal_notes_freetext, 1, 200) AS notes
FROM deals
WHERE deal_type = 'vs'
  AND (
    deal_notes_freetext LIKE '%walkout%'
    OR deal_notes_freetext LIKE '%ratchet%'
    OR deal_notes_freetext LIKE '%tier%'
    OR deal_notes_freetext LIKE '%vs gross%'
    OR deal_notes_freetext LIKE '%of gross%whichever%'
  );

-- D4. Renegotiation / phone call updates (stale structured fields signal)
SELECT show_id, deal_type,
       substr(deal_notes_freetext, 1, 250) AS notes
FROM deals
WHERE deal_notes_freetext LIKE '%Renegotiated%'
   OR deal_notes_freetext LIKE '%phone call%'
   OR deal_notes_freetext LIKE '%Updated%days before%';


-- =============================================================================
-- E. EXPENSES, COMPS, OPERATIONAL MESSINESS
-- =============================================================================

-- E1. BC5 — Hospitality over cap, not absorbed
SELECT e.show_id, sh.date, a.name, d.hospitality_cap, e.amount, e.absorbed_by_venue
FROM expenses e
JOIN deals d ON d.show_id = e.show_id
JOIN shows sh ON sh.id = e.show_id
JOIN artists a ON a.id = sh.artist_id
WHERE e.category = 'hospitality'
  AND d.hospitality_cap IS NOT NULL
  AND e.amount > d.hospitality_cap
  AND e.absorbed_by_venue = 0
ORDER BY e.amount - d.hospitality_cap DESC
LIMIT 25;

-- E2. BC8 — Duplicate expense lines
SELECT show_id, category, amount, description, COUNT(*) AS cnt
FROM expenses
GROUP BY show_id, category, amount, description
HAVING cnt > 1;

-- E3. settlement.total_expenses vs sum(expenses) mismatch (> $1)
SELECT s.show_id, s.total_expenses AS settlement_expenses,
       (SELECT SUM(amount) FROM expenses e
        WHERE e.show_id = s.show_id AND e.absorbed_by_venue = 0) AS expense_row_sum,
       s.total_expenses - (SELECT SUM(amount) FROM expenses e
        WHERE e.show_id = s.show_id AND e.absorbed_by_venue = 0) AS delta
FROM settlements s
WHERE ABS(
  IFNULL(s.total_expenses, 0) - IFNULL(
    (SELECT SUM(amount) FROM expenses e WHERE e.show_id = s.show_id AND e.absorbed_by_venue = 0), 0)
) > 1
ORDER BY ABS(delta) DESC
LIMIT 20;

-- E4. BC10 — Comp counts_toward_gross contradicts notes
SELECT show_id, category, counts_toward_gross, notes
FROM comps
WHERE counts_toward_gross = 0
  AND notes LIKE '%count toward gross%';

-- E5. BC11 — Stale artist prior_show_count
SELECT a.name, a.prior_show_count,
       (SELECT COUNT(*) FROM shows s WHERE s.artist_id = a.id AND s.date < date('now')) AS actual_past_shows
FROM artists a
WHERE a.prior_show_count = 0
  AND (SELECT COUNT(*) FROM shows s WHERE s.artist_id = a.id AND s.date < date('now')) >= 4
ORDER BY actual_past_shows DESC
LIMIT 15;


-- =============================================================================
-- F. COASTAL SPELL — CANONICAL DISPUTE
-- =============================================================================

SELECT
  sh.id AS show_id, sh.date, a.name,
  d.deal_type, d.guarantee_amount, d.percentage, d.expense_cap,
  ts.gross, ts.fees,
  s.status, s.total_to_artist, s.total_expenses, s.recoups_json,
  s.signoff_text, substr(s.notes, 1, 200) AS settlement_notes,
  substr(d.deal_notes_freetext, 1, 200) AS deal_notes
FROM shows sh
JOIN artists a ON a.id = sh.artist_id
JOIN deals d ON d.show_id = sh.id
JOIN ticket_sales ts ON ts.show_id = sh.id
JOIN settlements s ON s.show_id = sh.id
WHERE sh.id = 'show_coastal_spell_dispute'
   OR (a.name = 'Coastal Spell' AND sh.date = '2025-03-14');

-- Implied payout gap (Mariana vs agent read) when gross/fees/recoup/cap known:
-- Mariana: (gross - fees - 900 recoup - cap) * pct
-- Agent:   (gross - fees - cap) * pct  [recoup inside cap]
