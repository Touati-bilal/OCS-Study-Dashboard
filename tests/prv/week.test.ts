import {
  addDays, dayOfWeek, daysBetween, formatWeekRange, getLastCompletedWeek, getWeekContaining,
  getWeekEndFor, isWithin, listWeekEnds, toIsoDate, weekKey,
} from "@/lib/prv/weekly";

let fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail++; console.log(`FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);
  } else console.log(`ok   ${label} = ${JSON.stringify(actual)}`);
}
function ok(cond: boolean, label: string) { if (!cond) { fail++; console.log(`FAIL ${label}`); } else console.log(`ok   ${label}`); }

// --- date normalisation (both stored shapes) ---
eq(toIsoDate("2026-09-30"), "2026-09-30", "date-only");
eq(toIsoDate("2026-09-30T14:23:05.123Z"), "2026-09-30", "iso timestamp truncated");
eq(toIsoDate("2026-02-30"), null, "impossible day rejected (no rollover)");
eq(toIsoDate("2026-13-01"), null, "impossible month rejected");
eq(toIsoDate("2026-00-10"), null, "impossible month 00 rejected");
eq(toIsoDate(""), null, "empty");
eq(toIsoDate(undefined), null, "undefined");
eq(toIsoDate("garbage"), null, "garbage");
eq(toIsoDate("2026-02-29"), null, "2026 not a leap year");
eq(toIsoDate("2028-02-29"), "2028-02-29", "2028 is a leap year");

// --- day of week anchors ---
eq(dayOfWeek("2026-09-27"), 0, "2026-09-27 Sunday");
eq(dayOfWeek("2026-10-03"), 6, "2026-10-03 Saturday");
eq(dayOfWeek("2026-10-04"), 0, "2026-10-04 Sunday");
eq(dayOfWeek("2026-01-01"), 4, "2026-01-01 Thursday");

// --- last COMPLETED week (what a report describes) ---
eq(getWeekEndFor("2026-09-30"), "2026-09-27", "weekEnd from Wed");
eq(getLastCompletedWeek("2026-09-30"), { weekStart: "2026-09-21", weekEnd: "2026-09-27" }, "completed week from Wed");
eq(getLastCompletedWeek("2026-09-27"), { weekStart: "2026-09-21", weekEnd: "2026-09-27" }, "completed week on report day");
eq(getLastCompletedWeek("2026-09-28"), { weekStart: "2026-09-21", weekEnd: "2026-09-27" }, "Monday still previous week");
eq(getLastCompletedWeek("2026-09-30", 5), { weekStart: "2026-09-19", weekEnd: "2026-09-25" }, "completed week reportDay=Friday");
eq(getLastCompletedWeek("2026-09-30", 9), { weekStart: "2026-09-21", weekEnd: "2026-09-27" }, "invalid day falls back");
eq(getLastCompletedWeek("2026-09-30", -1), { weekStart: "2026-09-21", weekEnd: "2026-09-27" }, "negative day falls back");
eq(getLastCompletedWeek("2026-09-30", 1.5), { weekStart: "2026-09-21", weekEnd: "2026-09-27" }, "non-integer day falls back");

// --- containing week (in-progress) ---
for (const d of ["2026-09-21", "2026-09-25", "2026-09-27"]) {
  eq(getWeekContaining(d), { weekStart: "2026-09-21", weekEnd: "2026-09-27" }, `containing ${d} (same week)`);
}
for (const d of ["2026-09-28", "2026-10-01", "2026-10-03"]) {
  eq(getWeekContaining(d), { weekStart: "2026-09-28", weekEnd: "2026-10-04" }, `containing ${d} (next in-progress week)`);
}
eq(getWeekContaining("2026-09-26"), { weekStart: "2026-09-21", weekEnd: "2026-09-27" }, "Sat belongs to week ending Sun");

// --- helpers ---
eq(daysBetween("2026-09-30", "2026-10-07"), 7, "daysBetween");
eq(addDays("2026-12-31", 1), "2027-01-01", "year rollover");
eq(addDays("2026-03-01", -1), "2026-02-28", "month rollover");
ok(isWithin("2026-09-27", "2026-09-27", "2026-10-03"), "isWithin start inclusive");
ok(isWithin("2026-10-03", "2026-09-27", "2026-10-03"), "isWithin end inclusive");
ok(!isWithin("2026-09-26", "2026-09-27", "2026-10-03"), "isWithin excludes before");
ok(!isWithin("2026-10-04", "2026-09-27", "2026-10-03"), "isWithin excludes after");
eq(listWeekEnds("2026-09-01", "2026-10-03"), ["2026-08-30", "2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"], "listWeekEnds incl. boundary weeks");
eq(listWeekEnds("2026-09-01", "2026-09-01"), ["2026-08-30"], "listWeekEnds single day");
eq(weekKey("2026-10-03"), "w-2026-10-03", "weekKey");
eq(formatWeekRange("2026-09-27", "2026-10-03"), "27 sept. – 3 oct. 2026", "format cross-month");
eq(formatWeekRange("2026-09-21", "2026-09-27"), "21 – 27 sept. 2026", "format same month");

// --- properties that must never break ---
// a completed week is always exactly 7 days
for (let i = 0; i < 400; i++) {
  const anchor = addDays("2026-01-01", i);
  for (const rd of [0, 1, 3, 5, 6]) {
    const w = getLastCompletedWeek(anchor, rd);
    if (daysBetween(w.weekStart, w.weekEnd) !== 6) { fail++; console.log(`FAIL span ${anchor} rd=${rd}`); }
    if (dayOfWeek(w.weekEnd) !== rd) { fail++; console.log(`FAIL weekEnd weekday ${anchor} rd=${rd}`); }
    if (toUtcMsGuard(w.weekEnd) > toUtcMsGuard(anchor)) { fail++; console.log(`FAIL weekEnd in future ${anchor} rd=${rd}`); }
    const c = getWeekContaining(anchor, rd);
    if (!(toUtcMsGuard(anchor) >= toUtcMsGuard(c.weekStart) && toUtcMsGuard(anchor) <= toUtcMsGuard(c.weekEnd))) {
      fail++; console.log(`FAIL containing does not contain ${anchor} rd=${rd}`);
    }
  }
}
console.log("ok   2000 window invariants (span, weekday, not-future, containment)");
function toUtcMsGuard(iso: string) { return Date.parse(`${iso}T00:00:00Z`); }

// DST transitions (Europe/Paris): weeks must stay 7 days
for (const d of ["2026-03-29", "2026-10-25", "2026-03-08", "2026-11-01"]) {
  const w = getLastCompletedWeek(d, 6);
  ok(daysBetween(w.weekStart, w.weekEnd) === 6, `DST-safe window for ${d}`);
}

// idempotency: same week => same key, whatever the day of the run
const k1 = weekKey(getWeekEndFor("2026-09-28"));
const k2 = weekKey(getWeekEndFor("2026-10-03"));
ok(k1 === k2, "week key stable across a whole week");
ok(weekKey(getWeekEndFor("2026-10-05")) !== k1, "next week gets a different key");

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
