/**
 * Optional LLM pass — only when OPENAI_API_KEY is set.
 * Never replaces rule-based extraction; may add narrative notes only.
 */

import type { DealCanon, ProseExtraction } from "./types";

type LlmEnhanceResult = {
  applied: boolean;
  rationale?: string;
  error?: string;
};

const SYSTEM = `You assist a live music venue booker interpreting deal notes for settlement.
Respond with JSON only: { "rationale": string (2-3 sentences, cite phrases from notes), "warnings": string[] }
Do NOT invent dollar amounts. Do NOT claim legal advice. If unsure, say so.`;

export async function tryLlmEnhance(
  dealNotes: string,
  prose: ProseExtraction,
  canon: DealCanon,
): Promise<LlmEnhanceResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    return { applied: false };
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              dealNotes: dealNotes.slice(0, 4000),
              ruleExtracted: prose,
              proposedCanon: canon,
            }),
          },
        ],
      }),
    });

    if (!res.ok) {
      return { applied: false, error: `OpenAI HTTP ${res.status}` };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { applied: false, error: "Empty LLM response" };

    const parsed = JSON.parse(content) as {
      rationale?: string;
      warnings?: string[];
    };
    return {
      applied: true,
      rationale: parsed.rationale,
    };
  } catch (e) {
    return {
      applied: false,
      error: e instanceof Error ? e.message : "LLM request failed",
    };
  }
}
