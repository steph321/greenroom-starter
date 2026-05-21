"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Lock,
  FileText,
} from "lucide-react";
import type { Deal, Expense, Recoup } from "@/db/schema";
import type { DealCanon, DealInterpretationResult, RecoupStacking } from "@/lib/ai/types";
import { computeReviewState } from "@/lib/ai/reviewState";
import {
  explainSettlement,
  explainRecoupAlternatives,
} from "@/lib/settlement/explainSettlement";
import { formatMoney } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "./confidence-badge";
import { WarningBanner } from "./warning-banner";
import { DiscrepancyCards } from "./discrepancy-cards";

const INPUT_CLASS =
  "h-8 w-full rounded-lg border border-ink-200/80 bg-white px-2.5 text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-700/25 disabled:opacity-60 disabled:bg-ink-50 font-mono tabular";

export type ConfidenceReviewProps = {
  compact?: boolean;
  artistName: string;
  showDate: string;
  venueName: string;
  deal: Deal;
  interpretation: DealInterpretationResult;
  grossBoxOffice: number;
  totalFees: number;
  expenses: Expense[];
  recoups: Recoup[];
  hospitalityCap: number | null;
  existingTotalToArtist?: number | null;
  trustBanner?: { title: string; body: string } | null;
};

export function SettlementConfidenceReview(props: ConfidenceReviewProps) {
  const {
    compact = false,
    artistName,
    showDate,
    venueName,
    deal,
    interpretation,
    grossBoxOffice,
    totalFees,
    expenses,
    recoups,
    hospitalityCap,
    existingTotalToArtist,
    trustBanner,
  } = props;

  const [canon, setCanon] = useState<DealCanon>(
    () => interpretation.proposedCanon,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [copied, setCopied] = useState<"walkthrough" | "agent" | null>(null);

  const hospitalityTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.category === "hospitality")
        .reduce((s, e) => s + e.amount, 0),
    [expenses],
  );

  const marketingExpenseTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.category === "marketing" && !e.absorbedByVenue)
        .reduce((s, e) => s + e.amount, 0),
    [expenses],
  );

  const review = useMemo(
    () =>
      computeReviewState(deal, canon, {
        hospitalityExpenseTotal: hospitalityTotal,
        marketingExpenseTotal,
        hasDisputedSettlement: Boolean(trustBanner),
      }),
    [deal, canon, hospitalityTotal, marketingExpenseTotal, trustBanner],
  );

  const blockingCount = review.discrepancies.filter(
    (d) => d.severity === "blocking",
  ).length;

  const canConfirm =
    !confirmed &&
    (canon.recoupStacking !== "ambiguous_unset" ||
      (canon.marketingRecoupAmount ?? 0) === 0) &&
    blockingCount === 0;

  const explainInput = useMemo(
    () => ({
      canon,
      grossBoxOffice,
      totalFees,
      expenses,
      recoups,
      ambiguities: review.ambiguities,
      artistName,
      showDate,
      venueName,
    }),
    [
      canon,
      grossBoxOffice,
      totalFees,
      expenses,
      recoups,
      review.ambiguities,
      artistName,
      showDate,
      venueName,
    ],
  );

  const explanation = useMemo(() => {
    if (!confirmed) return null;
    return explainSettlement(explainInput);
  }, [confirmed, explainInput]);

  const recoupAlts = useMemo(() => {
    if ((canon.marketingRecoupAmount ?? 0) <= 0) return null;
    return explainRecoupAlternatives(explainInput);
  }, [explainInput, canon.marketingRecoupAmount]);

  const readiness = useMemo(() => {
    const items: { label: string; ok: boolean; warn?: string }[] = [
      {
        label: "Box office",
        ok: grossBoxOffice > 0,
        warn: grossBoxOffice <= 0 ? "No sales" : undefined,
      },
      {
        label: "Expenses",
        ok: expenses.length > 0,
        warn: expenses.length === 0 ? "None entered" : undefined,
      },
      {
        label: "Deal notes",
        ok: Boolean(deal.dealNotesFreetext?.trim()),
        warn: !deal.dealNotesFreetext?.trim() ? "Missing" : undefined,
      },
      {
        label: "Interpretation",
        ok: confirmed,
        warn: confirmed ? undefined : "Not confirmed",
      },
    ];
    if (
      hospitalityCap != null &&
      hospitalityTotal > hospitalityCap
    ) {
      items.push({
        label: "Hospitality",
        ok: false,
        warn: `Over $${hospitalityCap} cap`,
      });
    }
    return items;
  }, [
    grossBoxOffice,
    expenses.length,
    deal.dealNotesFreetext,
    confirmed,
    hospitalityCap,
    hospitalityTotal,
  ]);

  async function copyText(text: string, kind: "walkthrough" | "agent") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  if (compact) {
    return (
      <div className="space-y-4">
        <Card accent={review.overallConfidence === "low" ? "rose" : review.overallConfidence === "medium" ? "amber" : undefined}>
          <CardHeader>
            <div>
              <CardTitle>Deal confidence</CardTitle>
              <CardDescription>{review.confidenceSummary}</CardDescription>
            </div>
            <ConfidenceBadge level={review.overallConfidence} />
          </CardHeader>
          {review.discrepancies.length > 0 && (
            <CardContent className="pt-0 border-t border-ink-100/80">
              <DiscrepancyCards items={review.discrepancies} />
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {trustBanner && (
        <WarningBanner variant="info" title={trustBanner.title}>
          {trustBanner.body}
        </WarningBanner>
      )}

      {/* Readiness */}
      <div className="flex flex-wrap gap-2">
        {readiness.map((r) => (
          <span
            key={r.label}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ring-1 ring-inset ${
              r.ok
                ? "bg-brand-50 text-brand-800 ring-brand-200/70"
                : r.warn
                  ? "bg-amber-50 text-amber-900 ring-amber-200/70"
                  : "bg-ink-50 text-ink-500 ring-ink-200/70"
            }`}
          >
            {r.ok ? (
              <Check className="h-3 w-3" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
            {r.label}
            {r.warn && !r.ok && (
              <span className="text-amber-800/80">· {r.warn}</span>
            )}
          </span>
        ))}
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Gross box office" mono value={formatMoney(grossBoxOffice)} />
            <Field label="Fees" mono value={formatMoney(totalFees)} />
            <Field
              label="Net box office"
              mono
              value={formatMoney(grossBoxOffice - totalFees)}
            />
            <Field
              label="Expenses (passed)"
              mono
              value={formatMoney(
                expenses
                  .filter((e) => !e.absorbedByVenue)
                  .reduce((s, e) => s + e.amount, 0),
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Confidence gate */}
      <Card accent={review.overallConfidence === "low" ? "rose" : review.overallConfidence === "medium" ? "amber" : "brand"}>
        <CardHeader>
          <div>
            <CardTitle>Settlement confidence</CardTitle>
            <CardDescription>{review.confidenceSummary}</CardDescription>
          </div>
          <ConfidenceBadge level={review.overallConfidence} />
        </CardHeader>
        {interpretation.extractionNotes.length > 0 && (
          <CardContent className="pt-0 border-t border-ink-100/80">
            <p className="text-[11.5px] text-ink-500 leading-relaxed">
              {interpretation.extractionNotes[0]}
            </p>
          </CardContent>
        )}
      </Card>

      {/* Deal interpretation */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Deal interpretation</CardTitle>
            <CardDescription>
              What we use for tonight&apos;s math. Confirm when this matches
              the agent deal memo.
            </CardDescription>
          </div>
          {confirmed && (
            <span className="text-[10px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded ring-1 ring-brand-200/80">
              Confirmed
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <button
            type="button"
            onClick={() => setNotesOpen(!notesOpen)}
            className="flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"
          >
            {notesOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Agent deal notes (source)
          </button>
          {notesOpen && deal.dealNotesFreetext && (
            <div className="text-[12.5px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/60 leading-relaxed max-h-40 overflow-y-auto">
              {deal.dealNotesFreetext}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CanonField label="Structure">
              <span className="text-[13px] font-medium capitalize">
                {canon.structure.replace(/_/g, " ")}
              </span>
            </CanonField>
            <CanonField label="Guarantee">
              <input
                type="number"
                disabled={confirmed}
                className={INPUT_CLASS}
                value={canon.guaranteeAmount ?? ""}
                onChange={(e) =>
                  setCanon((c) => ({
                    ...c,
                    guaranteeAmount: numOrNull(e.target.value),
                  }))
                }
              />
            </CanonField>
            <CanonField label="Artist %">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  disabled={confirmed}
                  className={`${INPUT_CLASS} w-20`}
                  min={0}
                  max={100}
                  value={
                    canon.artistPercentage != null
                      ? Math.round(canon.artistPercentage * 100)
                      : ""
                  }
                  onChange={(e) =>
                    setCanon((c) => ({
                      ...c,
                      artistPercentage: e.target.value
                        ? Number(e.target.value) / 100
                        : null,
                    }))
                  }
                />
                <span className="text-[12px] text-ink-500">
                  % of {canon.percentageBasis ?? "net"}
                </span>
              </div>
            </CanonField>
            <CanonField label="Expense cap">
              <input
                type="number"
                disabled={confirmed}
                className={INPUT_CLASS}
                value={canon.expenseCap ?? ""}
                onChange={(e) =>
                  setCanon((c) => ({
                    ...c,
                    expenseCap: numOrNull(e.target.value),
                  }))
                }
              />
            </CanonField>
            {(canon.marketingRecoupAmount ?? 0) > 0 && (
              <>
                <CanonField label="Marketing recoup">
                  <input
                    type="number"
                    disabled={confirmed}
                    className={INPUT_CLASS}
                    value={canon.marketingRecoupAmount ?? ""}
                    onChange={(e) =>
                      setCanon((c) => ({
                        ...c,
                        marketingRecoupAmount: numOrNull(e.target.value),
                      }))
                    }
                  />
                </CanonField>
                <CanonField label="Recoup stacking">
                  <select
                    disabled={confirmed}
                    className={INPUT_CLASS}
                    value={canon.recoupStacking}
                    onChange={(e) =>
                      setCanon((c) => ({
                        ...c,
                        recoupStacking: e.target.value as RecoupStacking,
                      }))
                    }
                  >
                    <option value="ambiguous_unset">Choose…</option>
                    <option value="inside_expense_cap">
                      Inside expense cap
                    </option>
                    <option value="deducted_before_net">
                      Off gross before cap (like fees)
                    </option>
                  </select>
                </CanonField>
              </>
            )}
          </div>

          {interpretation.unsupportedClauses.length > 0 && (
            <WarningBanner variant="warning" title="Not fully modeled in v1">
              {interpretation.unsupportedClauses.join(", ")} — use a
              spreadsheet for those mechanics.
            </WarningBanner>
          )}

          {!confirmed && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="brand"
                disabled={!canConfirm}
                onClick={() => setConfirmed(true)}
              >
                Confirm interpretation
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCanon(interpretation.proposedCanon)
                }
              >
                Reset to suggested
              </Button>
            </div>
          )}
          {confirmed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmed(false)}
            >
              Edit interpretation
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Checks</CardTitle>
          <CardDescription>
            Conflicts between notes, booking fields, and tonight&apos;s
            expenses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DiscrepancyCards items={review.discrepancies} />
          {review.ambiguities.length > 0 && (
            <div>
              <div className="eyebrow text-[10px] text-ink-500 mb-2">
                Open questions
              </div>
              <ul className="space-y-2">
                {review.ambiguities.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-amber-200/60 bg-amber-50/25 px-4 py-3"
                  >
                    <div className="text-[13px] font-medium text-ink-900">
                      {a.question}
                    </div>
                    <p className="text-[12px] text-ink-600 mt-1 leading-relaxed">
                      {a.impact}
                    </p>
                    {a.financialImpact && (
                      <p className="text-[11.5px] text-amber-900/90 mt-1.5 font-mono tabular">
                        {a.financialImpact}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recoup dual preview */}
      {recoupAlts && !confirmed && (
        <Card accent="amber">
          <CardHeader>
            <CardTitle>Recoup stacking preview</CardTitle>
            <CardDescription>
              Same deal language, two readings — choose one before you
              confirm.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <RecoupPreview
              label="Inside expense cap"
              total={
                "error" in recoupAlts.insideCap
                  ? null
                  : recoupAlts.insideCap.totalToArtist
              }
            />
            <RecoupPreview
              label="Deducted before net"
              total={
                "error" in recoupAlts.beforeNet
                  ? null
                  : recoupAlts.beforeNet.totalToArtist
              }
            />
            <p className="sm:col-span-2 text-[12px] text-amber-900/90 font-mono tabular">
              Difference to artist: {formatMoney(Math.abs(recoupAlts.delta))}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Walkthrough */}
      {!confirmed ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center text-center gap-3">
            <Lock className="h-5 w-5 text-ink-300" />
            <p className="text-[13px] text-ink-500 max-w-sm">
              Confirm deal interpretation to show the payout walkthrough for
              the tour manager.
            </p>
          </CardContent>
        </Card>
      ) : explanation && "error" in explanation ? (
        <WarningBanner variant="danger" title="Cannot calculate">
          {explanation.error}
        </WarningBanner>
      ) : explanation ? (
        <>
          <div className="text-center py-8">
            <div className="eyebrow text-[10px] text-ink-400 mb-2">
              Total to artist
            </div>
            <div
              className="text-[56px] font-mono tabular font-bold text-ink-900 leading-none"
              style={{ letterSpacing: "-0.03em" }}
            >
              {formatMoney(explanation.totalToArtist)}
            </div>
            {existingTotalToArtist != null &&
              Math.abs(existingTotalToArtist - explanation.totalToArtist) >
                1 && (
                <p className="text-[12px] text-ink-400 mt-3">
                  Logged in Greenroom:{" "}
                  <span className="font-mono tabular text-ink-600">
                    {formatMoney(existingTotalToArtist)}
                  </span>
                </p>
              )}
            <p className="text-[13px] text-ink-600 mt-4 max-w-lg mx-auto leading-relaxed">
              {explanation.openingSummary}
            </p>
          </div>

          <Card accent="brand">
            <CardHeader>
              <CardTitle>Settlement walkthrough</CardTitle>
              <CardDescription>{explanation.dealTermsLine}</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-ink-100/80">
              {explanation.steps
                .filter((s) => s.id !== "absorbed_note")
                .map((step) => (
                  <div
                    key={step.id}
                    className="py-3 flex justify-between gap-4 items-start"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] text-ink-800">
                        {step.label}
                      </div>
                      {step.note && (
                        <div className="text-[11.5px] text-ink-400 mt-0.5">
                          {step.note}
                        </div>
                      )}
                    </div>
                    <div className="text-[13.5px] font-mono tabular text-ink-900 shrink-0">
                      {step.effect < 0
                        ? `−${formatMoney(Math.abs(step.effect))}`
                        : formatMoney(step.amount)}
                    </div>
                  </div>
                ))}
            </CardContent>
            {explanation.vsResolution && (
              <CardFooter className="block">
                <div className="text-[12px] text-ink-600 space-y-1">
                  <div>
                    <span className="font-medium">Guarantee:</span>{" "}
                    {formatMoney(explanation.vsResolution.guaranteePayout)}
                  </div>
                  <div>
                    <span className="font-medium">
                      {(explanation.vsResolution.artistPercentage * 100).toFixed(0)}%
                      of net:
                    </span>{" "}
                    {formatMoney(explanation.vsResolution.percentagePayout)}
                  </div>
                  <div className="font-medium text-ink-900">
                    Paid on:{" "}
                    {explanation.vsResolution.winner === "percentage"
                      ? "percentage (higher)"
                      : "guarantee (higher)"}
                  </div>
                </div>
              </CardFooter>
            )}
          </Card>

          {explanation.flags.length > 0 && (
            <div className="space-y-2">
              {explanation.flags.map((f, i) => (
                <WarningBanner
                  key={i}
                  variant={
                    f.kind === "disputed" || f.kind === "ambiguous"
                      ? "danger"
                      : f.kind === "caution"
                        ? "warning"
                        : "info"
                  }
                  title={flagTitle(f.kind)}
                >
                  {f.text}
                </WarningBanner>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-ink-400" />
                <div>
                  <CardTitle>Statement for the agent</CardTitle>
                  <CardDescription>
                    Copy for Monday — not sent from Greenroom.
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  copyText(explanation.agentStatementMarkdown, "agent")
                }
              >
                <Copy className="h-3.5 w-3.5" />
                {copied === "agent" ? "Copied" : "Copy"}
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="text-[11.5px] text-ink-700 leading-relaxed whitespace-pre-wrap font-sans bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/50 max-h-64 overflow-y-auto">
                {explanation.agentStatementMarkdown}
              </pre>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyText(explanation.bodyMarkdown, "walkthrough")}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied === "walkthrough" ? "Copied" : "Copy walkthrough"}
              </Button>
            </CardFooter>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function CanonField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow text-[10px] text-ink-500 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function RecoupPreview({
  label,
  total,
}: {
  label: string;
  total: number | null;
}) {
  return (
    <div className="rounded-lg bg-white ring-1 ring-amber-200/60 p-4">
      <div className="text-[11px] font-medium text-amber-900 mb-1">
        {label}
      </div>
      <div className="text-[22px] font-mono tabular font-semibold text-ink-900">
        {total != null ? formatMoney(total) : "—"}
      </div>
    </div>
  );
}

function numOrNull(v: string): number | null {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function flagTitle(kind: string): string {
  switch (kind) {
    case "disputed":
      return "Disputed line item";
    case "ambiguous":
      return "Needs clarity";
    case "absorbed":
      return "Venue absorbed";
    case "caution":
      return "Check with tour manager";
    default:
      return "Note";
  }
}
