/**
 * The report's own weekly notes.
 *
 * These are the owner's words about a period: what clicked, what did not, what needs another pass.
 * Everything in this file is optional and starts empty - nothing is ever generated on their behalf,
 * because a note the app wrote would be indistinguishable from something they actually thought.
 *
 * The six fields are stored inside the report record itself rather than in a second collection, so a
 * period has exactly one document: its figures and its notes travel together and cannot drift apart.
 *
 * This module is intentionally free of `server-only` so the screen can import the labels; only the
 * sanitiser below is meaningful on the server, and it is the server that calls it.
 */

/** Ceilings per field. A report is a document, not an archive of everything ever written. */
export const OBSERVATION_LIMITS = {
  understood: 2000,
  notUnderstood: 2000,
  toRevise: 2000,
  notes: 2000,
  difficult: 2000,
  improve: 2000,
} as const;

export type ObservationField = keyof typeof OBSERVATION_LIMITS;

/** Display order and wording, shared by the form, the report and the PDF. */
export const OBSERVATION_FIELDS: ReadonlyArray<{
  key: ObservationField;
  label: string;
  placeholder: string;
}> = [
  {
    key: "understood",
    label: "Ce que j'ai compris",
    placeholder: "Notions acquises cette période, modules où tout est clair.",
  },
  {
    key: "notUnderstood",
    label: "Ce que je n'ai pas compris",
    placeholder: "Points restés flous, sansfonds où il faudra revenir.",
  },
  {
    key: "toRevise",
    label: "À réviser",
    placeholder: "Matières à reprendre avant le prochain contrôle.",
  },
  { key: "notes", label: "Notes importantes", placeholder: "Consignes du professeur, informations utiles." },
  { key: "difficult", label: "Chapitres difficiles", placeholder: "Ce qui a demandé le plus d'effort." },
  {
    key: "improve",
    label: "À améliorer la prochaine fois",
    placeholder: "Organisation, rythme, répartition entre modules.",
  },
];

export type Observations = Partial<Record<ObservationField, string>>;

function field(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}

/**
 * Validates a notes payload coming from the browser.
 *
 * Unknown keys are dropped rather than spread, every value is capped and trimmed, and a field left
 * empty is omitted instead of stored as `""` - so "no note written" and "an empty note" stay the same
 * thing on disk. An object with nothing usable in it yields `{}`, the same state as a report that
 * was never annotated.
 */
export function sanitizeObservations(input: unknown): Observations {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const out: Observations = {};
  for (const { key } of OBSERVATION_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = field(raw[key], OBSERVATION_LIMITS[key]);
    if (value.length > 0) out[key] = value;
  }
  return out;
}

/** True when at least one field holds something, so the UI can hide an untouched form. */
export function hasObservations(observations: Observations | null | undefined): boolean {
  if (!observations) return false;
  return OBSERVATION_FIELDS.some(({ key }) => (observations[key] ?? "").trim().length > 0);
}

/** Fields that actually hold text, as label/value pairs, in display order. */
export function filledObservations(
  observations: Observations | null | undefined
): Array<{ key: ObservationField; label: string; text: string }> {
  if (!observations) return [];
  return OBSERVATION_FIELDS.filter(({ key }) => (observations[key] ?? "").trim().length > 0).map(
    ({ key, label }) => ({ key, label, text: (observations[key] ?? "").trim() })
  );
}
