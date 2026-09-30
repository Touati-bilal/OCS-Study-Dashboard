/**
 * Server-side AI for PRV.
 *
 * The API key lives only in an environment variable and only this file reads it, so it can never
 * reach the browser bundle. The provider is whatever OpenAI-compatible endpoint `AI_BASE_URL`
 * points at, which keeps the model swappable without code changes.
 *
 * Two hard rules, both enforced here:
 *   1. The AI only ever *proposes* a task. It never creates, edits or completes one; the browser
 *      shows the proposal and the owner confirms it through the normal task form.
 *   2. The AI receives a minimal, pre-aggregated payload - counts, titles and the owner's own
 *      notes. It never receives the access code, the recovery phrase, session data or any file.
 *
 * When no key is configured the module reports `unavailable` instead of throwing, so the rest of
 * PRV keeps working and the UI can say plainly that AI is not set up.
 */

import "server-only";

import { LIMITS } from "./snapshot";
import type { WeeklyMetrics } from "./metrics";
import type { Recommendation, ReportSettings } from "./trajectory";

export type AiStatus = "unconfigured" | "ok" | "error" | "disabled";

export interface AiTaskProposal {
  title: string;
  description: string;
  priority: "prof" | "important" | "normal";
  moduleId: string | null;
  /** Why the AI suggests this, shown before confirming. */
  rationale: string;
}

export interface AiTaskProposalResult {
  status: AiStatus;
  /** Always true: the AI cannot write to the task list. */
  requiresConfirmation: true;
  proposals: AiTaskProposal[];
  /** Present when the call failed, so the UI can explain itself. Never contains the key. */
  message?: string;
}

export interface AiAnalysis {
  status: AiStatus;
  /** 2-4 short paragraphs of interpretation. Facts stay in the deterministic section. */
  interpretation: string[];
  /** What the AI would focus on next, as text only. */
  focus: string[];
  message?: string;
}

interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getConfig(): AiConfig | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

export function isAiConfigured(): boolean {
  return getConfig() !== null;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/**
 * Builds the compact factual brief sent to the AI.
 *
 * Only what the AI can genuinely reason about: the week's counts, the overdue titles, the module
 * rates and the owner's own "not understood" notes. No identifiers, no descriptions, no links.
 */
export function buildAiBrief(metrics: WeeklyMetrics, settings: ReportSettings): string {
  const lines: string[] = [];
  lines.push(`Semaine du ${metrics.weekStart} au ${metrics.weekEnd}.`);
  lines.push(
    `Tâches : ${metrics.planned.length} prévue(s), ${metrics.completed.length} terminée(s), ` +
      `${metrics.incomplete.length} incomplète(s), taux ${metrics.completionRate ?? "n/a"} %.`
  );
  lines.push(
    `Reportées d'avant la semaine : ${metrics.carriedOver.length}. En retard de plus de ${settings.overdueWarningDays} jours : ${metrics.longOverdue.length}.`
  );
  lines.push(`Total encore ouvert : ${metrics.totals.openAtWeekEnd}.`);

  if (metrics.modules.length > 0) {
    lines.push(
      "Progression par module (objectifs validés) : " +
        metrics.modules
          .map((m) => `${m.code} ${m.objectiveRate} %`)
          .join(", ") +
        "."
    );
  }
  if (metrics.longOverdue.length > 0) {
    lines.push("Tâches les plus anciennes en retard : " + metrics.longOverdue.slice(0, 5).map((t) => `« ${clip(t.title, 80)} » (${t.daysOverdue} j)`).join(", ") + ".");
  }
  if (metrics.journal.unclear.length > 0) {
    lines.push("Points notés comme non compris : " + metrics.journal.unclear.slice(0, 8).map(clip).join(" ; ") + ".");
  }
  if (metrics.empty) lines.push("Aucune tâche enregistrée pour le moment.");

  return lines.join("\n").slice(0, LIMITS.aiTextBudget);
}

async function callAi(config: AiConfig, system: string, user: string, maxTokens: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.4,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return payload.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const TASK_SYSTEM = `Tu aides un étudiant à organiser ses tâches d'étude.
Tu ne fais QUE proposer des tâches. Tu ne peux jamais créer, modifier ou terminer une tâche.
Réponds uniquement par un JSON : {"proposals":[{"title":"...","description":"...","priority":"prof|important|normal","moduleId":null,"rationale":"..."}]}
Maximum 3 propositions. Titres courts (moins de 80 caractères), en français, sans numérotation.`;

const ANALYSIS_SYSTEM = `Tu analyses un rapport hebdomadaire d'étude.
Les faits chiffrés sont déjà calculés et affichés : ne les recalcule pas et ne les contredis pas.
Ton rôle est l'interprétation et le conseil. Réponds uniquement par un JSON :
{"interpretation":["...","..."],"focus":["...","..."]}
2 à 4 phrases d'interprétation, 1 à 3 priorités concrètes. En français.`;

const MAX_PROPOSALS = 3;

function sanitizeProposals(value: unknown): AiTaskProposal[] {
  if (!Array.isArray(value)) return [];
  const out: AiTaskProposal[] = [];
  for (const candidate of value.slice(0, MAX_PROPOSALS)) {
    if (candidate === null || typeof candidate !== "object") continue;
    const raw = candidate as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 80) : "";
    if (title.length === 0) continue;
    const priority =
      raw.priority === "prof" || raw.priority === "important" || raw.priority === "normal"
        ? raw.priority
        : "normal";
    out.push({
      title,
      description: typeof raw.description === "string" ? raw.description.trim().slice(0, 400) : "",
      priority,
      moduleId: typeof raw.moduleId === "string" && /^[A-Za-z0-9-]{1,16}$/.test(raw.moduleId) ? raw.moduleId : null,
      rationale: typeof raw.rationale === "string" ? raw.rationale.trim().slice(0, 300) : "",
    });
  }
  return out;
}

function sanitizeTextList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((v) => (typeof v === "string" ? v.trim().slice(0, maxLength) : ""))
    .filter((v) => v.length > 0);
}

/** Asks the AI for task suggestions. The caller shows them for confirmation; nothing is written. */
export async function proposeTasks(
  brief: string,
  input: { note: string; moduleIds: string[]; existingTitles: string[] }
): Promise<AiTaskProposalResult> {
  const config = getConfig();
  if (!config) {
    return {
      status: "unconfigured",
      requiresConfirmation: true,
      proposals: [],
      message: "Aucune clé IA configurée (AI_API_KEY).",
    };
  }

  const user = [
    brief,
    "",
    `Modules disponibles : ${input.moduleIds.slice(0, 20).join(", ") || "aucun"}.`,
    input.existingTitles.length > 0
      ? `Tâches déjà existantes (ne pas les dupliquer) : ${input.existingTitles.slice(0, 40).map((t) => `« ${clip(t, 60)} »`).join(", ")}.`
      : "",
    `Demande de l'étudiant : ${clip(input.note, 1000) || "aucune demande précise"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const content = await callAi(config, TASK_SYSTEM, user, 600);
  const parsed = parseJson(content);
  if (!parsed) {
    return {
      status: "error",
      requiresConfirmation: true,
      proposals: [],
      message: "Réponse IA illisible. Réessayez dans un instant.",
    };
  }
  return { status: "ok", requiresConfirmation: true, proposals: sanitizeProposals(parsed.proposals) };
}

/** Interprets a week. It comments on the facts; it does not produce them. */
export async function analyzeWeek(
  brief: string,
  recommendations: Recommendation[]
): Promise<AiAnalysis> {
  const config = getConfig();
  if (!config) {
    return {
      status: "unconfigured",
      interpretation: [],
      focus: [],
      message: "Aucune clé IA configurée (AI_API_KEY).",
    };
  }

  const user = [brief, "", "Recommandations déterministes déjà affichées :", recommendations
    .slice(0, 6)
    .map((r) => `- [${r.kind}] ${r.title}`)
    .join("\n")].join("\n");

  const content = await callAi(config, ANALYSIS_SYSTEM, user, 700);
  const parsed = parseJson(content);
  if (!parsed) {
    return {
      status: "error",
      interpretation: [],
      focus: [],
      message: "Réponse IA illisible. Réessayez dans un instant.",
    };
  }
  return {
    status: "ok",
    interpretation: sanitizeTextList(parsed.interpretation, 4, 500),
    focus: sanitizeTextList(parsed.focus, 3, 200),
  };
}
