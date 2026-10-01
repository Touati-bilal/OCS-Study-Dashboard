/**
 * Observation sanitising.
 *
 * The notes come from a text field in the browser and land in a stored report that is later rendered
 * into a PDF. These tests pin the boundary: nothing outside the six known keys survives, nothing
 * exceeds its cap, and an empty field is not stored as an empty string.
 */
import assert from "node:assert/strict";

import {
  OBSERVATION_FIELDS,
  OBSERVATION_LIMITS,
  filledObservations,
  hasObservations,
  sanitizeObservations,
} from "../../lib/prv/observations";

const tests: Array<[string, () => void]> = [
  [
    "keeps every known field",
    () => {
      const cleaned = sanitizeObservations({
        understood: "Les objectifs sont clairs",
        notUnderstood: "Le chapitre sur la normalisation",
        toRevise: "Normalisation",
        notes: "Cours noté",
        difficult: "Chapitre 4",
        improve: "Mieux répartir",
      });
      assert.equal(Object.keys(cleaned).length, 6);
      assert.equal(cleaned.understood, "Les objectifs sont clairs");
    },
  ],
  [
    "drops unknown keys instead of spreading them",
    () => {
      const cleaned = sanitizeObservations({ understood: "ok", evil: "<script>", __proto__: "x" } as never);
      assert.deepEqual(Object.keys(cleaned), ["understood"]);
    },
  ],
  [
    "drops non-string values",
    () => {
      const cleaned = sanitizeObservations({ understood: 42, notes: { a: 1 }, improve: ["x"] } as never);
      assert.deepEqual(cleaned, {});
    },
  ],
  [
    "caps each field at its documented limit",
    () => {
      const cleaned = sanitizeObservations({ understood: "a".repeat(5000) });
      assert.equal(cleaned.understood?.length, OBSERVATION_LIMITS.understood);
    },
  ],
  [
    "trims whitespace and omits an empty field",
    () => {
      const cleaned = sanitizeObservations({ understood: "   ", notes: "  utile  " });
      assert.equal("understood" in cleaned, false);
      assert.equal(cleaned.notes, "utile");
    },
  ],
  [
    "a non-object payload is empty, not a crash",
    () => {
      for (const payload of [null, undefined, "text", 7, [1, 2]]) {
        assert.deepEqual(sanitizeObservations(payload), {});
      }
    },
  ],
  [
    "strips null bytes so a note cannot truncate a stored file",
    () => {
      const cleaned = sanitizeObservations({ notes: "avant\u0000après" });
      assert.equal(cleaned.notes, "avantaprès");
    },
  ],
  [
    "hasObservations is false for an empty record and true otherwise",
    () => {
      assert.equal(hasObservations(undefined), false);
      assert.equal(hasObservations({}), false);
      assert.equal(hasObservations({ understood: "x" }), true);
    },
  ],
  [
    "filledObservations returns only written fields, in display order",
    () => {
      const filled = filledObservations({ notes: "n", understood: "u" });
      assert.equal(filled.length, 2);
      assert.equal(filled[0].key, "understood");
      assert.equal(filled[1].key, "notes");
      assert.ok(filled.every((entry) => entry.text.length > 0));
      // The label travels with the value so a renderer never re-derives the wording.
      assert.equal(filled[0].label, OBSERVATION_FIELDS[0].label);
    },
  ],
  [
    "every declared field has a label, a placeholder and a limit",
    () => {
      assert.equal(OBSERVATION_FIELDS.length, 6);
      for (const field of OBSERVATION_FIELDS) {
        assert.ok(field.label.length > 0);
        assert.ok(field.placeholder.length > 0);
        assert.ok(OBSERVATION_LIMITS[field.key] > 0);
      }
    },
  ],
];

let failures = 0;
for (const [name, run] of tests) {
  try {
    run();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    failures += 1;
    process.stdout.write(`not ok - ${name}\n`);
    process.stdout.write(`  ${(error as Error).message}\n`);
  }
}

if (failures > 0) {
  process.stdout.write(`\n${failures} test(s) failed\n`);
  process.exit(1);
}
process.stdout.write(`\nall ${tests.length} observation tests passed\n`);