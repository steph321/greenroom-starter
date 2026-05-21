/**
 * Runs key inspection queries and prints counts + samples.
 * npx tsx scripts/run-sql-audit.ts
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join } from "path";

const client = createClient({ url: "file:data/greenroom.db" });

type Section = { title: string; sql: string; limit?: number };

const SECTIONS: Section[] = [
  {
    title: "A1 Settlement status distribution",
    sql: `SELECT status, COUNT(*) AS cnt FROM settlements GROUP BY status ORDER BY cnt DESC`,
  },
  {
    title: "A2 Disputed + positive sign-off (BC1)",
    sql: `SELECT COUNT(*) AS cnt FROM settlements WHERE status = 'disputed' AND (signoff_text LIKE '%good%' OR signoff_text LIKE '%OK%' OR signoff_text LIKE '%ok%')`,
  },
  {
    title: "A3 disputed_at but status paid/signed/finalized",
    sql: `SELECT COUNT(*) AS cnt FROM settlements WHERE disputed_at IS NOT NULL AND status IN ('paid','signed','finalized')`,
  },
  {
    title: "A4 signed_at before submitted_at (BC7)",
    sql: `SELECT COUNT(*) AS cnt FROM settlements WHERE submitted_at IS NOT NULL AND signed_at IS NOT NULL AND signed_at < submitted_at`,
  },
  {
    title: "A6 calculation_json populated",
    sql: `SELECT COUNT(*) AS total, SUM(CASE WHEN calculation_json IS NOT NULL AND calculation_json != '' THEN 1 ELSE 0 END) AS has_json FROM settlements`,
  },
  {
    title: "B2 Paid + disputed recoup (BC3)",
    sql: `SELECT COUNT(*) AS cnt FROM settlements WHERE status = 'paid' AND recoups_json LIKE '%"status":"disputed"%'`,
  },
  {
    title: "B4 Agents with disputed marketing recoups",
    sql: `SELECT ag.name, COUNT(DISTINCT s.show_id) AS cnt FROM settlements s JOIN shows sh ON sh.id = s.show_id JOIN artists ar ON ar.id = sh.artist_id JOIN agents ag ON ag.id = ar.agent_id WHERE s.recoups_json LIKE '%"category":"marketing"%' AND s.recoups_json LIKE '%"status":"disputed"%' GROUP BY ag.id ORDER BY cnt DESC LIMIT 5`,
  },
  {
    title: "C1 Unsupported deal types (vs, % net, door)",
    sql: `SELECT COUNT(*) AS cnt FROM deals WHERE deal_type IN ('vs','percentage_of_net','door')`,
  },
  {
    title: "C3 Prose Vs / structured % of net (BC9)",
    sql: `SELECT COUNT(*) AS cnt FROM deals WHERE deal_type = 'percentage_of_net' AND deal_notes_freetext LIKE '%guarantee vs%'`,
  },
  {
    title: "C6 Vs with missing guarantee or percentage",
    sql: `SELECT COUNT(*) AS cnt FROM deals WHERE deal_type = 'vs' AND (guarantee_amount IS NULL OR percentage IS NULL)`,
  },
  {
    title: "D1 Deals with marketing recoup language",
    sql: `SELECT COUNT(*) AS cnt FROM deals WHERE deal_notes_freetext LIKE '%marketing recoup%' OR deal_notes_freetext LIKE '%recoup%'`,
  },
  {
    title: "D3 Vs + walkout/ratchet in prose",
    sql: `SELECT COUNT(*) AS cnt FROM deals WHERE deal_type = 'vs' AND (deal_notes_freetext LIKE '%walkout%' OR deal_notes_freetext LIKE '%ratchet%' OR deal_notes_freetext LIKE '%tier%')`,
  },
  {
    title: "E1 Hospitality over cap, not absorbed (BC5)",
    sql: `SELECT COUNT(*) AS cnt FROM expenses e JOIN deals d ON d.show_id = e.show_id WHERE e.category = 'hospitality' AND d.hospitality_cap IS NOT NULL AND e.amount > d.hospitality_cap AND e.absorbed_by_venue = 0`,
  },
  {
    title: "E2 Duplicate expenses (BC8)",
    sql: `SELECT COUNT(*) AS cnt FROM (SELECT show_id FROM expenses GROUP BY show_id, category, amount, description HAVING COUNT(*) > 1)`,
  },
  {
    title: "E3 total_expenses vs expense row sum mismatch",
    sql: `SELECT COUNT(*) AS cnt FROM settlements s WHERE ABS(IFNULL(s.total_expenses,0) - IFNULL((SELECT SUM(amount) FROM expenses e WHERE e.show_id = s.show_id AND e.absorbed_by_venue = 0),0)) > 1`,
  },
  {
    title: "F Coastal Spell show exists",
    sql: `SELECT COUNT(*) AS cnt FROM shows WHERE id = 'show_coastal_spell_dispute'`,
  },
];

async function run() {
  console.log("=== SQL INSPECTION SUMMARY ===\n");
  for (const { title, sql } of SECTIONS) {
    try {
      const r = await client.execute(sql);
      console.log(title);
      console.log(JSON.stringify(r.rows, null, 2));
      console.log("");
    } catch (e) {
      console.log(title);
      console.log("  ERROR:", (e as Error).message);
      console.log("");
    }
  }
  const coastal = await client.execute(`
    SELECT sh.id, s.status, s.total_to_artist, ts.gross, ts.fees, d.expense_cap
    FROM shows sh
    JOIN settlements s ON s.show_id = sh.id
    JOIN ticket_sales ts ON ts.show_id = sh.id
    JOIN deals d ON d.show_id = sh.id
    WHERE sh.id = 'show_coastal_spell_dispute'
  `);
  console.log("F Coastal Spell detail");
  console.log(JSON.stringify(coastal.rows, null, 2));
  client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
