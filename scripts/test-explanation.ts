/**
 * npx tsx scripts/test-explanation.ts
 */
import { createClient } from "@libsql/client";
import type { Expense } from "../db/schema";
import { interpretDealSync } from "../lib/ai/interpretDeal";
import {
  explainSettlement,
  explainRecoupAlternatives,
} from "../lib/settlement/explainSettlement";

const client = createClient({ url: "file:data/greenroom.db" });

async function main() {
  const showId = "show_coastal_spell_dispute";
  const dealR = await client.execute(
    `SELECT * FROM deals WHERE show_id = '${showId}'`,
  );
  const tsR = await client.execute(
    `SELECT * FROM ticket_sales WHERE show_id = '${showId}'`,
  );
  const expR = await client.execute(
    `SELECT * FROM expenses WHERE show_id = '${showId}'`,
  );
  const stlR = await client.execute(
    `SELECT recoups_json FROM settlements WHERE show_id = '${showId}'`,
  );

  if (!dealR.rows[0]) {
    console.log("Run npm run db:reset");
    return;
  }

  const row = dealR.rows[0] as Record<string, unknown>;
  const deal = {
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

  const gross = (tsR.rows[0] as Record<string, unknown>).gross as number;
  const fees = (tsR.rows[0] as Record<string, unknown>).fees as number;
  const expenses = expR.rows.map((e) => {
    const r = e as Record<string, unknown>;
    return {
      id: r.id as string,
      showId: showId,
      category: r.category as Expense["category"],
      amount: r.amount as number,
      description: r.description as string | null,
      approved: true,
      absorbedByVenue: Boolean(r.absorbed_by_venue),
      enteredByUserId: null,
      enteredAt: new Date(),
    };
  });
  const recoups = JSON.parse(
    (stlR.rows[0] as Record<string, unknown>).recoups_json as string,
  );

  const interp = interpretDealSync({ deal, hasDisputedSettlement: true });
  console.log("=== Interpretation confidence:", interp.overallConfidence);

  const alts = explainRecoupAlternatives({
    canon: { ...interp.proposedCanon, recoupStacking: "ambiguous_unset" },
    grossBoxOffice: gross,
    totalFees: fees,
    expenses,
    recoups,
    ambiguities: interp.ambiguities,
    artistName: "Coastal Spell",
    showDate: "2025-03-14",
    venueName: "The Crescent",
  });
  if (alts) {
    console.log("\n=== Recoup alternatives (delta artist payout) ===");
    console.log("Inside cap:", alts.insideCap.totalToArtist);
    console.log("Before net:", alts.beforeNet.totalToArtist);
    console.log("Delta:", alts.delta);
  }

  for (const stacking of ["inside_expense_cap", "deducted_before_net"] as const) {
    const canon = { ...interp.proposedCanon, recoupStacking: stacking };
    const ex = explainSettlement({
      canon,
      grossBoxOffice: gross,
      totalFees: fees,
      expenses,
      recoups,
      ambiguities: interp.ambiguities,
      artistName: "Coastal Spell",
      showDate: "2025-03-14",
      venueName: "The Crescent",
    });
    if ("error" in ex) {
      console.log(stacking, ex.error);
      continue;
    }
    console.log(`\n=== Explanation (${stacking}) ===`);
    console.log(ex.openingSummary);
    console.log("\n--- body ---\n");
    console.log(ex.bodyMarkdown);
  }

  client.close();
}

main();
