/**
 * Free-period date handling.
 *
 * These tests pin the rules the server relies on to reject a bad range, so a future change that
 * loosens `normalisePeriod` has to fail here rather than silently accept an inverted range.
 */
import assert from "node:assert/strict";

import {
  MAX_PERIOD_DAYS,
  formatWeekRange,
  getLastCompletedWeek,
  isCanonicalWeek,
  eachDay,
  normalisePeriod,
  parsePeriodKey,
  parseReportRef,
  periodKey,
  periodLength,
  toIsoDate,
} from "../../lib/prv/weekly";

const tests: Array<[string, () => void]> = [
  [
    "normalisePeriod accepts an ordered, real range",
    () => {
      const period = normalisePeriod("2026-09-01", "2026-09-27");
      assert.ok(period);
      assert.equal(period.weekStart, "2026-09-01");
      assert.equal(period.weekEnd, "2026-09-27");
      assert.equal(periodLength(period), 27);
    },
  ],
  [
    "normalisePeriod refuses an inverted range",
    () => {
      assert.equal(normalisePeriod("2026-09-27", "2026-09-01"), null);
    },
  ],
  [
    "normalisePeriod refuses a range longer than the cap",
    () => {
      // The cap is inclusive: exactly MAX_PERIOD_DAYS days is accepted, one more is not.
      const start = "2025-06-01";
      assert.equal(normalisePeriod(start, addDays(start, MAX_PERIOD_DAYS)), null);
      assert.ok(normalisePeriod(start, addDays(start, MAX_PERIOD_DAYS - 1)));
    },
  ],
  [
    "normalisePeriod refuses a missing or malformed end",
    () => {
      assert.equal(normalisePeriod("2026-09-01", undefined), null);
      assert.equal(normalisePeriod("2026-09-01", "not-a-date"), null);
      assert.equal(normalisePeriod(undefined, "2026-09-27"), null);
    },
  ],
  [
    "a single day is a valid period",
    () => {
      const period = normalisePeriod("2026-09-27", "2026-09-27");
      assert.ok(period);
      assert.equal(periodLength(period), 1);
    },
  ],
  [
    "periodKey round-trips through parsePeriodKey",
    () => {
      const period = normalisePeriod("2026-09-21", "2026-09-27");
      assert.ok(period);
      const key = periodKey(period);
      const parsed = parsePeriodKey(key);
      assert.ok(parsed);
      assert.equal(parsed.weekStart, "2026-09-21");
      assert.equal(parsed.weekEnd, "2026-09-27");
    },
  ],
  [
    "parseReportRef accepts both the period key and a bare week end",
    () => {
      const fromKey = parseReportRef(periodKey({ weekStart: "2026-09-21", weekEnd: "2026-09-27" }));
      assert.ok(fromKey);
      assert.equal(fromKey.weekStart, "2026-09-21");

      const fromWeekEnd = parseReportRef("2026-09-27");
      assert.ok(fromWeekEnd);
      assert.equal(fromWeekEnd.weekEnd, "2026-09-27");
      assert.equal(fromWeekEnd.weekStart, "2026-09-21");
    },
  ],
  [
    "parseReportRef refuses nonsense",
    () => {
      assert.equal(parseReportRef("2026-13-45"), null);
      assert.equal(parseReportRef("../../etc/passwd"), null);
      assert.equal(parseReportRef(""), null);
    },
  ],
  [
    "a legacy w- key still resolves, so old reports remain readable",
    () => {
      const legacy = parseReportRef("w-2026-09-27");
      assert.ok(legacy);
      assert.equal(legacy.weekStart, "2026-09-21");
      assert.equal(legacy.weekEnd, "2026-09-27");
    },
  ],
  [
    "isCanonicalWeek tells a real week from a custom range",
    () => {
      assert.equal(isCanonicalWeek({ weekStart: "2026-09-21", weekEnd: "2026-09-27" }), true);
      assert.equal(isCanonicalWeek({ weekStart: "2026-09-01", weekEnd: "2026-09-27" }), false);
    },
  ],
  [
    "eachDay covers the period inclusively",
    () => {
      const days = eachDay("2026-09-25", "2026-09-27");
      assert.deepEqual(days, ["2026-09-25", "2026-09-26", "2026-09-27"]);
      assert.deepEqual(eachDay("2026-09-25", "2026-09-24"), []);
    },
  ],
  [
    "the default period is the last completed week, not today",
    () => {
      // 2026-10-01 is a Thursday; with the default report day the last completed week ends 09-27.
      const week = getLastCompletedWeek("2026-10-01");
      assert.equal(week.weekStart, "2026-09-21");
      assert.equal(week.weekEnd, "2026-09-27");
    },
  ],
  [
    "formatWeekRange renders both ends",
    () => {
      assert.match(formatWeekRange("2026-09-21", "2026-09-27"), /2026/);
    },
  ],
];

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
process.stdout.write(`\nall ${tests.length} period tests passed\n`);