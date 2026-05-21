/**
 * One-off database audit for case study documentation.
 * Run: npx tsx scripts/audit-db.ts
 */
import { createClient } from "@libsql/client";

const client = createClient({ url: "file:data/greenroom.db" });

async function q<T>(sql: string): Promise<T[]> {
  const r = await client.execute(sql);
  return r.rows as T[];
}

async function main() {
  console.log("=== GREENROOM DB AUDIT ===\n");

  // BC1: disputed + positive signoff
  const bc1 = await q<{ show_id: string; status: string; signoff_text: string; artist: string }>(
    `SELECT s.show_id, s.status, s.signoff_text, a.name as artist
     FROM settlements s
     JOIN shows sh ON sh.id = s.show_id
     JOIN artists a ON a.id = sh.artist_id
     WHERE s.status = 'disputed' AND s.signoff_text LIKE '%good%'`,
  );
  console.log("BC1 — Disputed status + positive TM signoff:", bc1.length);
  bc1.slice(0, 3).forEach((r) => console.log("  ", r.artist, r.signoff_text?.slice(0, 60)));

  // BC2: bonus threshold prose vs json (heuristic: prose mentions threshold, json exists)
  const bc2 = await q<{ show_id: string; deal_type: string; notes: string; bonuses_json: string }>(
    `SELECT d.show_id, d.deal_type, d.deal_notes_freetext as notes, d.bonuses_json
     FROM deals d
     WHERE d.deal_notes_freetext LIKE '%structured field still reflects%'
        OR d.deal_notes_freetext LIKE '%confirm before settlement%'`,
  );
  console.log("\nBC2 — Bonus threshold prose/structured drift:", bc2.length);
  bc2.slice(0, 2).forEach((r) => console.log("  ", r.show_id, r.notes?.slice(0, 80) + "..."));

  // BC3: paid + disputed recoup
  const bc3 = await q<{ show_id: string; status: string; recoups_json: string; notes: string }>(
    `SELECT show_id, status, recoups_json, notes FROM settlements
     WHERE status = 'paid' AND recoups_json LIKE '%"status":"disputed"%'`,
  );
  console.log("\nBC3 — Paid settlement with disputed recoup:", bc3.length);

  // BC6: prose 85% vs structured 75%
  const bc6 = await q<{ show_id: string; percentage: number; notes: string }>(
    `SELECT show_id, percentage, deal_notes_freetext as notes FROM deals
     WHERE deal_notes_freetext LIKE '%85/15%' AND percentage = 0.75`,
  );
  console.log("\nBC6 — Prose 85% vs structured 75%:", bc6.length);

  // BC7: signed before submitted
  const bc7 = await q<{ show_id: string; submitted_at: number; signed_at: number }>(
    `SELECT show_id, submitted_at, signed_at FROM settlements
     WHERE submitted_at IS NOT NULL AND signed_at IS NOT NULL AND signed_at < submitted_at`,
  );
  console.log("\nBC7 — signedAt before submittedAt:", bc7.length);

  // BC9: vs in prose, percentage_of_net in structured
  const bc9 = await q<{ show_id: string; deal_type: string; guarantee: number; notes: string }>(
    `SELECT show_id, deal_type, guarantee_amount as guarantee, deal_notes_freetext as notes FROM deals
     WHERE deal_type = 'percentage_of_net' AND deal_notes_freetext LIKE '%guarantee vs%'`,
  );
  console.log("\nBC9 — Prose Vs deal, structured percentage_of_net:", bc9.length);
  bc9.slice(0, 1).forEach((r) => console.log("  ", r.show_id, r.notes?.slice(0, 100)));

  // BC10: comps countsTowardGross false but note says counts
  const bc10 = await q<{ show_id: string; category: string; notes: string }>(
    `SELECT show_id, category, notes FROM comps
     WHERE counts_toward_gross = 0 AND notes LIKE '%count toward gross%'`,
  );
  console.log("\nBC10 — Comp flag vs note contradiction:", bc10.length);

  // BC11: stale priorShowCount
  const bc11 = await q<{ id: string; name: string; prior_show_count: number; actual: number }>(
    `SELECT a.id, a.name, a.prior_show_count,
            (SELECT COUNT(*) FROM shows s WHERE s.artist_id = a.id AND s.date < date('now')) as actual
     FROM artists a
     WHERE a.prior_show_count = 0
       AND (SELECT COUNT(*) FROM shows s WHERE s.artist_id = a.id AND s.date < date('now')) >= 4
     ORDER BY actual DESC
     LIMIT 5`,
  );
  console.log("\nBC11 — priorShowCount=0 but many past shows:", bc11.length);
  bc11.forEach((r) => console.log("  ", r.name, "prior=", r.prior_show_count, "actual=", r.actual));

  // Coastal Spell by canonical show id
  const coastalById = await q<Record<string, unknown>>(
    `SELECT st.*, ts.gross, ts.fees, d.deal_notes_freetext, d.guarantee_amount, d.percentage, d.expense_cap
     FROM settlements st
     JOIN ticket_sales ts ON ts.show_id = st.show_id
     JOIN deals d ON d.show_id = st.show_id
     WHERE st.show_id = 'show_coastal_spell_dispute'`,
  );
  console.log("\nCoastal Spell (show_coastal_spell_dispute):");
  if (coastalById[0]) {
    const c = coastalById[0] as Record<string, unknown>;
    console.log("  gross/fees:", c.gross, c.fees);
    console.log("  total_to_artist:", c.total_to_artist);
    console.log("  total_expenses:", c.total_expenses);
    console.log("  status:", c.status);
    console.log("  notes:", String(c.notes).slice(0, 120) + "...");
  } else {
    console.log("  NOT FOUND — run npm run db:reset");
  }

  // Coastal Spell internal inconsistency (any show on 3/14)
  const coastal = await q<{
    status: string;
    total_to_artist: number;
    total_expenses: number;
    gross: number;
    fees: number;
    notes: string;
    deal_notes: string;
  }>(
    `SELECT st.status, st.total_to_artist, st.total_expenses, ts.gross, ts.fees, st.notes, d.deal_notes_freetext as deal_notes
     FROM settlements st
     JOIN shows sh ON sh.id = st.show_id
     JOIN artists a ON a.id = sh.artist_id
     JOIN ticket_sales ts ON ts.show_id = st.show_id
     JOIN deals d ON d.show_id = st.show_id
     WHERE a.name = 'Coastal Spell' AND sh.date = '2025-03-14'`,
  );
  console.log("\nCoastal Spell settlement record:");
  if (coastal[0]) {
    const c = coastal[0];
    console.log("  status:", c.status);
    console.log("  total_to_artist:", c.total_to_artist, "(agent expects 12285, venue calc was 11565)");
    console.log("  total_expenses:", c.total_expenses, "(sum of expense rows may differ)");
    console.log("  gross/fees:", c.gross, c.fees);
    // Mariana math: 19840-1984-900=16956, -2500=14456, *0.8=11565
    // Agent math: (19840-1984-2500)*0.8=12285
    const mariana = (c.gross - c.fees - 900 - 2500) * 0.8;
    const agent = (c.gross - c.fees - 2500) * 0.8;
    console.log("  implied Mariana payout:", mariana);
    console.log("  implied Agent payout:", agent);
    console.log("  gap:", agent - mariana);
  }

  // Expense sum vs settlement.total_expenses for Coastal
  const coastalExp = await q<{ sum: number }>(
    `SELECT SUM(amount) as sum FROM expenses WHERE show_id = 'show_coastal_spell_dispute'`,
  );
  console.log("  expense rows sum:", coastalExp[0]?.sum, "(settlement says 1600)");

  // Daniel Hwang pattern
  const hwang = await q<{ cnt: number }>(
    `SELECT COUNT(DISTINCT s.show_id) as cnt
     FROM settlements s
     JOIN shows sh ON sh.id = s.show_id
     JOIN artists ar ON ar.id = sh.artist_id
     JOIN agents ag ON ag.id = ar.agent_id
     WHERE ag.name = 'Daniel Hwang' AND s.recoups_json LIKE '%"category":"marketing"%'
       AND s.recoups_json LIKE '%"status":"disputed"%'`,
  );
  console.log("\nBC12 — Daniel Hwang disputed marketing recoups:", hwang[0]?.cnt);

  // Prose vs deal_type mismatches (sample)
  const unsupported = await q<{ deal_type: string; cnt: number }>(
    `SELECT deal_type, COUNT(*) as cnt FROM deals GROUP BY deal_type ORDER BY cnt DESC`,
  );
  console.log("\nDeal type distribution:");
  unsupported.forEach((r) => console.log("  ", r.deal_type, r.cnt));

  // Settlements where total_to_artist doesn't match simple flat calc (sample vs deals)
  const vsNoCalc = await q<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM deals WHERE deal_type IN ('vs','percentage_of_net','door')`,
  );
  console.log("\nDeals in-app calculator cannot settle:", vsNoCalc[0]?.cnt, "of ~541");

  // Duplicate expenses (BC8)
  const dupes = await q<{ show_id: string; category: string; amount: number; cnt: number }>(
    `SELECT show_id, category, amount, COUNT(*) as cnt
     FROM expenses
     GROUP BY show_id, category, amount, description
     HAVING cnt > 1
     LIMIT 5`,
  );
  console.log("\nBC8 — Potential duplicate expenses:", dupes.length);
  dupes.forEach((r) => console.log("  ", r.show_id, r.category, r.amount, "x", r.cnt));

  // Hospitality over cap (BC5)
  const hosp = await q<{ show_id: string; cap: number; amount: number }>(
    `SELECT e.show_id, d.hospitality_cap as cap, e.amount
     FROM expenses e
     JOIN deals d ON d.show_id = e.show_id
     WHERE e.category = 'hospitality' AND d.hospitality_cap IS NOT NULL
       AND e.amount > d.hospitality_cap AND e.absorbed_by_venue = 0
     LIMIT 5`,
  );
  console.log("\nBC5 — Hospitality over cap, not absorbed:", hosp.length);
  hosp.forEach((r) => console.log("  ", r.show_id, "cap", r.cap, "actual", r.amount));

  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
