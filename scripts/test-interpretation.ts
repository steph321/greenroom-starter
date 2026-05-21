/**
 * Smoke tests for deal interpretation (rules-only).
 * npx tsx scripts/test-interpretation.ts
 */
import { createClient } from "@libsql/client";
import { interpretDealSync } from "../lib/ai/interpretDeal";

const client = createClient({ url: "file:data/greenroom.db" });

async function loadDeal(showId: string) {
  const r = await client.execute(
    `SELECT * FROM deals WHERE show_id = '${showId}'`,
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    showId: row.show_id as string,
    dealType: row.deal_type as "vs",
    guaranteeAmount: row.guarantee_amount as number,
    percentage: row.percentage as number,
    percentageBasis: row.percentage_basis as "net",
    expenseCap: row.expense_cap as number,
    hospitalityCap: row.hospitality_cap as number,
    bonusesJson: row.bonuses_json as string,
    dealNotesFreetext: row.deal_notes_freetext as string,
    createdAt: new Date(),
  };
}

function printResult(label: string, r: ReturnType<typeof interpretDealSync>) {
  console.log(`\n=== ${label} ===`);
  console.log("Overall:", r.overallConfidence, "—", r.confidenceSummary);
  console.log("Canon:", JSON.stringify(r.proposedCanon, null, 2));
  console.log(
    "Discrepancies:",
    r.discrepancies.map((d) => `[${d.severity}] ${d.title}`).join("\n  ") || "none",
  );
  console.log(
    "Ambiguities:",
    r.ambiguities.map((a) => a.question).join("\n  ") || "none",
  );
  console.log("Notes:", r.extractionNotes.join("\n  "));
}

async function main() {
  const coastal = await loadDeal("show_coastal_spell_dispute");
  if (coastal) {
    printResult(
      "Coastal Spell",
      interpretDealSync({
        deal: coastal,
        hasDisputedSettlement: true,
      }),
    );
  } else {
    console.log("Coastal Spell not found — run npm run db:reset");
  }

  const bc6 = await client.execute(
    `SELECT show_id FROM deals WHERE deal_notes_freetext LIKE '%85/15%' AND percentage = 0.75 LIMIT 1`,
  );
  if (bc6.rows[0]) {
    const d = await loadDeal(bc6.rows[0].show_id as string);
    if (d) printResult("BC6 percentage drift", interpretDealSync({ deal: d }));
  }

  const bc9 = await client.execute(
    `SELECT show_id FROM deals WHERE deal_type = 'percentage_of_net' AND deal_notes_freetext LIKE '%guarantee vs%' LIMIT 1`,
  );
  if (bc9.rows[0]) {
    const d = await loadDeal(bc9.rows[0].show_id as string);
    if (d) printResult("BC9 Vs vs % of net", interpretDealSync({ deal: d }));
  }

  client.close();
}

main();
