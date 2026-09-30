import { computeWeeklyMetrics, OVERDUE_WARNING_DAYS } from "@/lib/prv/metrics";
import { sanitizeSnapshot, emptySnapshot } from "@/lib/prv/snapshot";
import {
  assessTrajectory, buildRecommendations, weightedProgress, DEFAULT_SETTINGS,
  sanitizeSettings, getModuleWeight,
} from "@/lib/prv/trajectory";

let fail = 0;
function eq(a: unknown, b: unknown, l: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log(`FAIL ${l}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); }
  else console.log(`ok   ${l} = ${JSON.stringify(a)}`);
}
function ok(c: boolean, l: string) { if (!c) { fail++; console.log(`FAIL ${l}`); } else console.log(`ok   ${l}`); }

const WEEK = { weekStart: "2026-09-21", weekEnd: "2026-09-27" };
let idc = 0;
const t = (o: Record<string, unknown>) => ({ id: `task-${++idc}`, createdAt: "2026-09-01T08:00:00.000Z", status: "todo", priority: "normal", ...o });

// ---- 1. empty snapshot: no fabricated data, no division by zero ----
const empty = computeWeeklyMetrics(emptySnapshot(), WEEK);
ok(empty.empty, "empty snapshot flagged empty");
eq(empty.completionRate, null, "no plan => completionRate null not 0");
eq(empty.planned.length, 0, "no planned");
eq(empty.totals.openAtWeekEnd, 0, "no open tasks");
eq(empty.quiz.attemptsInWeek, 0, "no quiz attempts");

// ---- 2. sanitisation of hostile input ----
const hostile = sanitizeSnapshot({
  tasks: [
    { title: "ok task", moduleId: "M201", deadline: "2026-09-23", status: "completed", completedAt: "2026-09-24T10:00:00.000Z", priority: "prof" },
    { title: "  " },
    null,
    "string",
    { title: "bad enum", priority: "<script>", status: "deleted", deadline: "not-a-date", moduleId: 42 },
    { title: "x".repeat(5000) },
  ],
  moduleRuntime: { M201: { hoursStudied: 999999, objectiveStatus: { __proto__: true, "ch-1-o-1": true, bogus: true } } },
  chapterQuiz: { M201: { "ch-1": { correct: 5, total: 7, percentage: 71.4, completedAt: "2026-09-24T10:00:00.000Z" } } },
  legacyQuiz: {},
  journal: [{ date: "2026-09-22", notUnderstood: "injection attempt", questions: "", notes: "", problems: "" }, { date: "bogus" }],
});
eq(hostile.tasks.length, 3, "hostile tasks filtered (blank title, null, string dropped)");
eq(hostile.tasks[0].title, "ok task", "valid task kept");
eq(hostile.tasks[1].priority, "normal", "invalid priority defaulted");
eq(hostile.tasks[1].status, "todo", "invalid status defaulted");
eq(hostile.tasks[1].deadline, undefined, "invalid date dropped");
eq(hostile.tasks[1].moduleId, null, "non-string moduleId coerced to null");
ok(hostile.tasks[2].title.length <= 300, "title truncated to 300");
eq(hostile.moduleRuntime.M201.hoursStudied, 5000, "hours clamped to max");
ok(hostile.moduleRuntime.M201.objectiveStatus.__proto__ === undefined, "no prototype pollution via objectiveStatus");
eq(hostile.moduleRuntime.M201.objectiveStatus["ch-1-o-1"], true, "real objective kept");
eq(hostile.journal.length, 1, "journal with bad date dropped");
eq(sanitizeSnapshot(null).tasks.length, 0, "null payload => empty snapshot");
eq(sanitizeSnapshot("nope").tasks.length, 0, "string payload => empty snapshot");
eq(sanitizeSnapshot([]).tasks.length, 0, "array payload => empty snapshot");
eq(sanitizeSnapshot({ tasks: { a: 1 } }).tasks.length, 0, "object tasks => empty");

// ---- 3. real week: planned / completed / incomplete ----
const snap = sanitizeSnapshot({
  tasks: [
    t({ title: "Cours ch1", moduleId: "M201", chapterId: "ch-1", deadline: "2026-09-22", status: "completed", completedAt: "2026-09-22T14:00:00.000Z", priority: "prof" }),
    t({ title: "TP1", moduleId: "M201", deadline: "2026-09-24", status: "completed", completedAt: "2026-09-25T09:00:00.000Z" }),
    t({ title: "TD2", moduleId: "M201", deadline: "2026-09-26", status: "in_progress" }),
    t({ title: "Hors semaine", moduleId: "M202", deadline: "2026-10-05" }),
    t({ title: "Reportée", moduleId: "M201", deadline: "2026-09-10", status: "todo" }),
    t({ title: "Tres en retard", moduleId: "M201", deadline: "2026-08-20", status: "todo" }),
    t({ title: "Sans date", moduleId: "M201", status: "todo" }),
    t({ title: "Completee hors semaine", moduleId: "M201", deadline: "2026-09-15", status: "completed", completedAt: "2026-09-16T10:00:00.000Z" }),
  ],
  moduleRuntime: { M201: { hoursStudied: 12, objectiveStatus: { "ch-1-o-1": true, "ch-1-o-2": true, "ch-2-o-1": true } } },
  chapterQuiz: { M201: { "ch-1": { correct: 6, incorrect: 1, total: 7, percentage: 85.7, completedAt: "2026-09-23T10:00:00.000Z" } } },
  journal: [{ date: "2026-09-23", notUnderstood: "le chiffrement asymétrique", questions: "", notes: "", problems: "" }],
});
const m = computeWeeklyMetrics(snap, WEEK);
eq(m.planned.length, 3, "planned = deadlines inside the week");
eq(m.completed.length, 2, "completed = completedAt inside the week");
eq(m.completed.map(x => x.title), ["Cours ch1", "TP1"], "completed names");
eq(m.completionRate, 66.7, "completionRate = 2/3 rounded");
ok(!m.completed.some(x => x.title === "Completee hors semaine"), "completion outside week excluded");
ok(!m.planned.some(x => x.title === "Hors semaine"), "deadline outside week excluded");
eq(m.incomplete.length, 1, "incomplete = planned not completed");
eq(m.incomplete[0].title, "TD2", "incomplete name");
eq(m.carriedOver.map(x => x.title), ["Reportée", "Tres en retard"], "carried over = every open task whose deadline precedes the week");
ok(m.carriedOver.every(x => x.deadline! < WEEK.weekStart), "carryover invariant: deadline strictly before weekStart");
ok(m.longOverdue.every(x => m.carriedOver.some(c => c.id === x.id)), "long overdue is a subset of carryover (documented overlap)");
eq(m.longOverdue.map(x => x.title), ["Reportée", "Tres en retard"], "long overdue = both tasks are >14d late");
eq(m.longOverdue.map(x => x.daysOverdue), [17, 38], "days overdue measured against weekEnd");
eq(m.noDeadline.map(x => x.title), ["Sans date"], "no-deadline open tasks");
eq(m.byPriority.prof.total, 1, "prof bucket");
eq(m.byPriority.prof.completionRate, 100, "prof completed");
eq(m.quiz.attemptsInWeek, 1, "quiz attempt in week");
eq(m.quiz.bestInWeek?.percentage, 85.7, "best quiz");
eq(m.journal.entriesInWeek, 1, "journal entry in week");
eq(m.journal.unclear, ["le chiffrement asymétrique"], "unclear captured");
ok(m.totals.completedAllTime === 3, "completed all time counted");

// module / chapter progress from real objective ids
const m201 = m.modules.find(x => x.moduleId === "M201")!;
ok(m201 !== undefined, "M201 stat present");
eq(m201.objectivesDone, 3, "objectives done");
ok(m201.objectivesTotal > 3, "objectives total from module def");
eq(m201.chaptersTotal, 4, "M201 exposes all 4 real chapters");
eq(m201.chaptersDone, 0, "no chapter fully complete (ch-1 is 2/3)");
eq(m201.chapterRate, 0, "chapterRate 0 when no chapter is finished");
const m202 = m.modules.find(x => x.moduleId === "M202")!;
eq(m202.chaptersTotal, 4, "M202 with tasks but no runtime still lists its real chapters");
eq(m202.objectiveRate, 0, "M202 objectiveRate 0 when unrecorded");
eq(m201.hoursStudied, 12, "hours from snapshot");
ok(m.chapters.every(c => c.objectivesTotal > 0), "every reported chapter has real objectives");
ok(!Object.prototype.hasOwnProperty.call(m.chapters[0], "bogus"), "no leaked keys on chapters");

// determinism: same snapshot, byte-identical output
const again = computeWeeklyMetrics(snap, WEEK);
eq(JSON.stringify(again) === JSON.stringify(m), true, "metrics are deterministic (identical JSON)");

// ---- 4. trajectory ----
const base = { weekEnd: WEEK.weekEnd, completionRate: 66.7, weightedProgress: 30 };
const currentW = weightedProgress(m, DEFAULT_SETTINGS);
const up = assessTrajectory(m, [
  { weekEnd: "2026-09-20", completionRate: 50, weightedProgress: Math.round((currentW - 30) * 10) / 10 },
  { weekEnd: "2026-09-13", completionRate: 40, weightedProgress: Math.round((currentW - 30) * 10) / 10 },
], DEFAULT_SETTINGS);
ok(Math.abs(currentW - weightedProgress(m, DEFAULT_SETTINGS)) < 0.001, "weightedProgress is stable");
eq(up.trajectory, "improving", "trajectory improving");
ok(up.delta !== null && up.delta > 0, "improving has positive delta");
ok(up.rule.includes("écart"), "trajectory exposes its rule");
ok(up.points.length === 3, "trajectory keeps history");
const solo = assessTrajectory(m, [], DEFAULT_SETTINGS);
eq(solo.trajectory, "insufficient-data", "no history => insufficient data, not a guess");
const flatW = weightedProgress(m, DEFAULT_SETTINGS);
const flat = assessTrajectory(m, [
  { weekEnd: "2026-09-20", completionRate: 50, weightedProgress: flatW },
], DEFAULT_SETTINGS);
// weighting: 0.75 on M202/M203/M204 must actually move the number vs a flat 1.0
const noWeights = { ...DEFAULT_SETTINGS, moduleWeights: {}, defaultModuleWeight: 1 };
ok(weightedProgress(m, noWeights) !== weightedProgress(m, DEFAULT_SETTINGS),
  `0.75 weighting changes the result (${weightedProgress(m, noWeights)} vs ${weightedProgress(m, DEFAULT_SETTINGS)})`);
eq(flat.trajectory, "stable", "same progress => stable");
void base;

// ---- 5. weighting 0.75 actually changes the number ----
eq(getModuleWeight("M202", DEFAULT_SETTINGS), 0.75, "M202 default weight 0.75");
eq(getModuleWeight("M201", DEFAULT_SETTINGS), 1, "M201 default weight 1");
const custom = sanitizeSettings({ moduleWeights: { M201: 0.5 } });
eq(getModuleWeight("M201", custom), 0.5, "override applied");
eq(getModuleWeight("M999", custom), 1, "unknown module falls back");
eq(sanitizeSettings({ moduleWeights: { M201: 99 } }).moduleWeights.M201, undefined, "out-of-range weight rejected");
eq(sanitizeSettings({ moduleWeights: { M201: -1 } }).moduleWeights.M201, undefined, "negative weight rejected");
eq(sanitizeSettings({ reportDay: 7 }).reportDay, 0, "invalid reportDay rejected");
eq(sanitizeSettings({ reportDay: 5 }).reportDay, 5, "valid reportDay kept");
eq(sanitizeSettings({ onTrackRate: 150 }).onTrackRate, 70, "out-of-range onTrackRate rejected");
eq(sanitizeSettings({ aiEnabled: "yes" }).aiEnabled, false, "non-boolean aiEnabled => false");
eq(sanitizeSettings(null).reportDay, 0, "null settings => defaults");
eq(sanitizeSettings({ moduleWeights: JSON.parse('{"__proto__":{"x":1}}') }).moduleWeights.x, undefined, "__proto__ weight ignored");

// ---- 6. recommendations ----
const recs = buildRecommendations(m, up, DEFAULT_SETTINGS);
ok(recs.some(r => r.kind === "corrective" && r.title.includes("plus de 14 jours")), "long-overdue corrective recommendation");
ok(recs.some(r => r.kind === "corrective" && r.title.includes("reportée")), "carryover recommendation");
ok(recs.some(r => r.kind === "info" && r.title.includes("non compris")), "unclear-points info");
ok(recs.some(r => r.kind === "info" && r.title.includes("professeur")), "prof-priority info");
ok(!recs.some(r => r.kind === "reward"), "no reward while a task is 38 days late");
ok(recs.every(r => r.evidence.length > 0), "every recommendation shows its evidence");
ok(recs.find(r => r.proposal)?.proposal !== undefined, "corrective may propose a task");
ok(recs.every(r => !("done" in (r as object)) ), "recommendations never mark tasks done");
const cleanSnap = sanitizeSnapshot({ tasks: [t({ title: "A", deadline: "2026-09-22", status: "completed", completedAt: "2026-09-23T10:00:00.000Z" })] });
const cleanM = computeWeeklyMetrics(cleanSnap, WEEK);
const cleanRecs = buildRecommendations(cleanM, assessTrajectory(cleanM, [], DEFAULT_SETTINGS), DEFAULT_SETTINGS);
ok(cleanRecs.some(r => r.kind === "reward"), "clean week earns a reward");
ok(cleanRecs.some(r => r.kind === "info" && r.title.includes("Aucune tâche prévue")) === false, "no no-plan info when a plan exists");

// ---- 7. edge: overdue threshold boundary ----
const bound = sanitizeSnapshot({ tasks: [t({ title: "J15", deadline: "2026-09-12", status: "todo" })] });
eq(computeWeeklyMetrics(bound, WEEK).longOverdue.length, 1, "15 days late is long overdue");
const bound2 = sanitizeSnapshot({ tasks: [t({ title: "J14", deadline: "2026-09-13", status: "todo" })] });
eq(computeWeeklyMetrics(bound2, WEEK).longOverdue.length, 0, "exactly 14 days is not yet long overdue");
eq(computeWeeklyMetrics(bound2, WEEK).overdue.length, 1, "but is overdue");
console.log(`ok   threshold = strictly more than ${OVERDUE_WARNING_DAYS} days`);

// ---- 8. huge input is clamped, not fatal ----
const huge = sanitizeSnapshot({ tasks: Array.from({ length: 6000 }, (_, i) => t({ title: `T${i}` })) });
ok(huge.tasks.length <= 5000, `task array capped (${huge.tasks.length})`);
const bigRate = computeWeeklyMetrics(huge, WEEK);
ok(Number.isFinite(bigRate.totals.openAtWeekEnd), "large input still computes");

// ---- 9. regression: the completion rate can never exceed 100% ----
// A task finished during the week but never planned for it (no deadline, or a deadline in another
// week) must not be counted against the weekly plan.
const inflate = sanitizeSnapshot({
  tasks: [
    t({ title: "Planifiee A", deadline: "2026-09-22", status: "completed", completedAt: "2026-09-23T10:00:00.000Z" }),
    t({ title: "Sans echeance", status: "completed", completedAt: "2026-09-24T10:00:00.000Z" }),
    t({ title: "Semaine suivante", deadline: "2026-10-05", status: "completed", completedAt: "2026-09-24T10:00:00.000Z" }),
    t({ title: "Non faite", deadline: "2026-09-24", status: "todo" }),
  ],
});
const im = computeWeeklyMetrics(inflate, WEEK);
eq(im.planned.length, 2, "only two tasks are planned for the week");
eq(im.completed.length, 3, "three tasks were finished during the week");
eq(im.completedPlanned.length, 1, "only one of them was planned");
eq(im.completionRate, 50, "rate is planned-and-done over planned");
ok((im.completionRate ?? 0) <= 100, "rate can never exceed 100");
eq(im.incomplete.length, 1, "the unfinished planned task is reported incomplete");
eq(im.byPriority.normal.total + im.byPriority.prof.total + im.byPriority.important.total, 2, "priority buckets cover the plan only");

// A module cannot report more completions than it planned either.
const modSnap = sanitizeSnapshot({
  tasks: [
    t({ title: "M1 A", moduleId: "M201", deadline: "2026-09-22", status: "completed", completedAt: "2026-09-23T10:00:00.000Z" }),
    t({ title: "M1 hors plan", moduleId: "M201", status: "completed", completedAt: "2026-09-24T10:00:00.000Z" }),
  ],
});
const mm = computeWeeklyMetrics(modSnap, WEEK);
const m201stat = mm.modules.find(m => m.moduleId === "M201")!;
eq(m201stat.planned, 1, "module planned count");
eq(m201stat.completed, 1, "module completed count is scoped to the week");
ok(m201stat.completionRate <= 100, "module rate can never exceed 100");

// A task completed after the week closed is not credited to that week.
const lateDone = sanitizeSnapshot({
  tasks: [t({ title: "Tardive", deadline: "2026-09-22", status: "completed", completedAt: "2026-10-05T10:00:00.000Z" })],
});
const lm = computeWeeklyMetrics(lateDone, WEEK);
eq(lm.completedPlanned.length, 0, "work finished after the week is not credited to it");
eq(lm.completionRate, 0, "so the rate stays at zero");

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
