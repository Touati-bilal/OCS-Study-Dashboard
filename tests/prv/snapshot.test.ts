/**
 * Unit tests for the two server-side trust boundaries the audit flagged.
 *
 *   1. `sanitizeSnapshot` used to accept whatever module ids the browser posted, so a crafted request
 *      could have the private report present OCC, ORS or EGTS modules - or invented ones - as the
 *      user's own work. The allowlist is now enforced here, on the server.
 *   2. `readRecoveryHash` used to fall back to a deterministic hash of a phrase hardcoded in
 *      `config.server.ts`, so any deployment without `PRV_RECOVERY_HASH` was recoverable by anyone
 *      who had read the source. It now fails closed.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { LIMITS, SNAPSHOT_VERSION, emptySnapshot, sanitizeSnapshot } from "@/lib/prv/snapshot";
import { getPrvAuthConfig, hashPepperedSecret, verifyPepperedSecret } from "@/lib/prv/config.server";

let fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail++;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);
  } else console.log(`ok   ${label} = ${JSON.stringify(actual)}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) {
    fail++;
    console.log(`FAIL ${label}`);
  } else console.log(`ok   ${label}`);
}

// ------------------------------------------------------------------ snapshot: OCS only
console.log("\n== snapshot accepts OCS module ids only ==");

const ocsModule = (id: string) => ({ moduleId: id, title: `task ${id}`, status: "todo" });

const clean = sanitizeSnapshot({
  version: SNAPSHOT_VERSION,
  tasks: [ocsModule("M201"), ocsModule("M206"), { title: "sans module", status: "todo" }],
  moduleRuntime: { M201: { hoursStudied: 3, objectiveStatus: { o1: true } } },
  chapterQuiz: { M203: { c1: { score: 4, total: 5, answeredAt: "2026-09-20T10:00:00.000Z" } } },
  legacyQuiz: { M204: { score: 3, total: 4, answeredAt: "2026-09-21T10:00:00.000Z" } },
  journal: [{ date: "2026-09-22", notUnderstood: "x", questions: "", notes: "", problems: "" }],
});
eq(clean.tasks.map((t) => t.moduleId), ["M201", "M206", null], "OCS tasks and module-less tasks are kept");
eq(Object.keys(clean.moduleRuntime), ["M201"], "OCS runtime kept");
eq(Object.keys(clean.chapterQuiz), ["M203"], "OCS chapter results kept");
eq(Object.keys(clean.legacyQuiz), ["M204"], "OCS legacy results kept");
eq(clean.journal.length, 1, "journal kept");

// A payload that tries to pass another option's modules off as OCS work.
const hostile = sanitizeSnapshot({
  version: SNAPSHOT_VERSION,
  tasks: [ocsModule("OCC-M204"), ocsModule("ORS-M401"), ocsModule("EGTS-M101"), ocsModule("M999"), ocsModule("../etc")],
  moduleRuntime: {
    "OCC-M204": { hoursStudied: 99, objectiveStatus: {} },
    "ORS-M401": { hoursStudied: 99, objectiveStatus: {} },
    "EGTS-M101": { hoursStudied: 99, objectiveStatus: {} },
    M999: { hoursStudied: 99, objectiveStatus: {} },
    M201: { hoursStudied: 1, objectiveStatus: {} },
  },
  chapterQuiz: {
    "OCC-M204": { c1: { score: 5, total: 5, answeredAt: "2026-09-20T10:00:00.000Z" } },
    M202: { c1: { score: 1, total: 5, answeredAt: "2026-09-20T10:00:00.000Z" } },
  },
  legacyQuiz: {
    "EGTS-M101": { score: 5, total: 5, answeredAt: "2026-09-20T10:00:00.000Z" },
    M205: { score: 2, total: 5, answeredAt: "2026-09-20T10:00:00.000Z" },
  },
});
eq(hostile.tasks.map((t) => t.moduleId), [null, null, null, null, null], "every foreign or invented module id is dropped");
eq(
  hostile.tasks.map((t) => t.title),
  ["task OCC-M204", "task ORS-M401", "task EGTS-M101", "task M999", "task ../etc"],
  "the task text itself is untouched, only its module attribution is dropped"
);
eq(Object.keys(hostile.moduleRuntime), ["M201"], "foreign runtime keys dropped");
eq(Object.keys(hostile.chapterQuiz), ["M202"], "foreign chapter results dropped");
eq(Object.keys(hostile.legacyQuiz), ["M205"], "foreign legacy results dropped");

// Prototype pollution and structural junk stay handled.
const polluted = sanitizeSnapshot(JSON.parse('{"__proto__":{"polluted":true},"constructor":1,"moduleRuntime":{"__proto__":{"hoursStudied":9}}}'));
eq(Object.keys(polluted.moduleRuntime), [], "no prototype keys become module entries");
ok((({}) as any).polluted === undefined, "Object.prototype is untouched");
eq(sanitizeSnapshot("nope").tasks, [], "a non-object payload yields an empty snapshot");
eq(sanitizeSnapshot(null).tasks, [], "null yields an empty snapshot");
eq(emptySnapshot().version, SNAPSHOT_VERSION, "emptySnapshot keeps the version");

// ------------------------------------------------------------------ recovery: no default
console.log("\n== recovery has no built-in phrase and fails closed ==");

const configSource = readFileSync(path.join(process.cwd(), "lib", "prv", "config.server.ts"), "utf-8");
ok(!/DEFAULT_RECOVERY_PHRASE/.test(configSource), "config.server.ts has no default recovery phrase constant");
ok(!/Mimi/.test(configSource), "the previously hardcoded phrase is gone from config.server.ts");
ok(!/hashSecretDeterministic/.test(configSource), "the deterministic hash helper is gone");
ok(
  /export function hashSecretDeterministic/.test(readFileSync(path.join(process.cwd(), "lib", "prv", "config.server.ts"), "utf-8")) ===
    false,
  "no deterministic hash helper is exported any more"
);

const savedHash = process.env.PRV_RECOVERY_HASH;
const savedPepper = process.env.PRV_SECRET_PEPPER;
const pepper = "unit-test-pepper-that-is-long-enough-32";
process.env.PRV_SECRET_PEPPER = pepper;

delete process.env.PRV_RECOVERY_HASH;
eq(getPrvAuthConfig().recoveryHash, null, "no PRV_RECOVERY_HASH means no recovery hash");
eq(getPrvAuthConfig().isRecoveryConfigured, false, "recovery reports itself unconfigured");

process.env.PRV_RECOVERY_HASH = "not-a-hash";
eq(getPrvAuthConfig().recoveryHash, null, "a malformed hash is refused, not used as a fallback");

const realHash = hashPepperedSecret("a private phrase", randomBytes(16), pepper);
process.env.PRV_RECOVERY_HASH = realHash;
eq(getPrvAuthConfig().isRecoveryConfigured, true, "a real peppered hash enables recovery");
ok(verifyPepperedSecret("a private phrase", realHash, pepper), "the owner's own phrase verifies");
ok(!verifyPepperedSecret("Mimi", realHash, pepper), "the old hardcoded phrase does not");
ok(!verifyPepperedSecret("wrong", realHash, pepper), "a wrong phrase does not");

if (savedHash === undefined) delete process.env.PRV_RECOVERY_HASH;
else process.env.PRV_RECOVERY_HASH = savedHash;
if (savedPepper === undefined) delete process.env.PRV_SECRET_PEPPER;
else process.env.PRV_SECRET_PEPPER = savedPepper;

console.log(`\n${fail === 0 ? "snapshot + recovery unit tests: all green" : `${fail} failed`}`);
process.exit(fail === 0 ? 0 : 1);
