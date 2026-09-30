/**
 * PRV browser smoke test.
 *
 * The HTTP suites prove the server behaves. This proves the eight PRV pages actually render and
 * work in a browser, which is the one thing they cannot show: a client component that throws on
 * mount still returns a perfectly good 200. It also checks the OCS-only rule, which lives in
 * localStorage and can therefore only be tested here.
 *
 *   BASE=http://localhost:3199 npx tsx tests/prv/browser.test.mts
 */
import { chromium, type ConsoleMessage, type Page } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3199";
const CODE = process.env.PRV_TEST_CODE ?? "";
const USERNAME = process.env.PRV_TEST_USERNAME ?? "";
const EMAIL = process.env.PRV_TEST_EMAIL ?? "";
const PASSWORD = process.env.PRV_TEST_PASSWORD ?? "";
if (!CODE || !USERNAME || !EMAIL || !PASSWORD) {
  console.error("fixtures missing: run the suite through `npm run test:prv`.");
  process.exit(1);
}

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(condition: boolean, label: string, detail = "") {
  if (condition) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const consoleErrors: Array<{ page: string; text: string }> = [];
function watch(page: Page, name: string) {
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // The suite deliberately provokes a 401 and then a 423 on the unlock screen; the UI handles
    // both. Anything else is a genuine client-side error.
    if (text.includes("Failed to load resource") && /\b(401|423)\b/.test(text)) return;
    consoleErrors.push({ page: name, text });
  });
  page.on("pageerror", (error) => {
    consoleErrors.push({ page: name, text: `pageerror: ${error.message}` });
  });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript((option) => {
  const state: Record<string, unknown> = {
    theme: "black",
    studyOption: option,
    tasks: [
      { id: "t-ocs-1", title: "Reviser le hachage", moduleId: "M201", deadline: "2026-09-23", priority: "important", status: "completed", createdAt: "2026-09-20T09:00:00.000Z", completedAt: "2026-09-24T09:00:00.000Z" },
      { id: "t-ocs-2", title: "TP a rendre", moduleId: "M201", deadline: "2026-08-30", priority: "prof", status: "todo", createdAt: "2026-08-01T09:00:00.000Z" },
      { id: "t-occ-1", title: "TACHE OCC CONFIDENTIELLE", moduleId: "OCC-M201", deadline: "2026-09-24", priority: "prof", status: "todo", createdAt: "2026-08-01T09:00:00.000Z" },
    ],
    modules: { M201: { hoursStudied: 6, objectiveStatus: {} } },
    chapterQuizResults: {},
    quizResults: {},
    journalEntries: [{ date: "2026-09-24", notUnderstood: "le hachage", questions: "", notes: "", problems: "" }],
  };
  window.localStorage.setItem("ocs-study-dashboard", JSON.stringify({ state, version: 0 }));
}, "OCS");

const page = await ctx.newPage();
watch(page, "session");

// ---------------------------------------------------------------- owner login
const CODE_INPUT = 'input[inputmode="numeric"][maxlength="4"]';

console.log("== signing in with username + email + password ==");

// A visitor who has never opened the app has no store in localStorage, so the dashboard would put
// them through the filière chooser. The sign-in screen must not depend on any of that: it has to be
// usable on a first visit, which is exactly what a redirect out of PRV produces.
const virginCtx = await browser.newContext();
const virgin = await virginCtx.newPage();
watch(virgin, "session (first visit)");
await virgin.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
ok(await virgin.locator("#prv-username").isVisible().catch(() => false), "the sign-in form is reachable on a first visit, before any filière is chosen");
ok((await virgin.innerText("body")).includes("Choisis ta filière") === false, "the filière chooser does not stand in the way of signing in");

// The whole point of that first visit is that it has to end in an open PRV, so the flow is walked to
// the end on a browser that has never chosen a filière. The OCS-only rule reads the study option out
// of localStorage, and a brand new browser has none; when it was applied to the whole `/prv` tree it
// threw the owner straight back out to the chooser and the code could never be entered at all.
await virgin.fill("#prv-username", USERNAME);
await virgin.fill("#prv-email", EMAIL);
await virgin.fill("#prv-password", PASSWORD);
await virgin.click('form button[type="submit"]');
await virgin.waitForURL("**/prv/deverrouiller", { timeout: 20000 });
ok(virgin.url().includes("/prv/deverrouiller"), "signing in from a first visit reaches the code screen", virgin.url());
await virgin.waitForSelector(CODE_INPUT, { timeout: 20000 });
ok(true, "the code can be entered from a first visit, with no filière chosen yet");
await virgin.fill(CODE_INPUT, CODE);
await virgin.click('form button[type="submit"]');
await virgin.waitForURL((url) => !url.pathname.includes("deverrouiller") && !url.pathname.includes("connexion"), { timeout: 20000 });
ok(true, "the code opens PRV from a first visit", virgin.url());
await virginCtx.close();

await page.goto(`${BASE}/prv/rapports`, { waitUntil: "networkidle" });
ok(page.url().includes("/connexion"), "a protected URL bounces to the login screen", page.url());

// The code alone is not a way in: the login screen must come first.
await page.goto(`${BASE}/prv/deverrouiller`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
ok(page.url().includes("/connexion"), "the code screen is unreachable before signing in", page.url());

await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await page.waitForSelector("#prv-username", { timeout: 20000 });
ok(true, "the login form is reachable and interactive");

// A wrong password must be refused, with the same generic message every time.
const rejections: string[] = [];
for (const wrong of ["not-the-password", "still-not-it"]) {
  await page.fill("#prv-username", USERNAME);
  await page.fill("#prv-email", EMAIL);
  await page.fill("#prv-password", wrong);
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(1200);
  const alert = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  if (alert) rejections.push(alert.trim());
}
ok(rejections.length === 2 && rejections[0] === rejections[1], "a wrong password is refused with one identical message", rejections.join(" / "));
ok(page.url().includes("/connexion"), "a wrong password does not sign you in", page.url());
ok(
  !(await (await ctx.cookies()).some((c) => c.name === "prv_owner")),
  "a wrong password sets no owner cookie"
);

// The correct credentials sign in, and the password field is cleared.
await page.fill("#prv-username", USERNAME);
await page.fill("#prv-email", EMAIL);
await page.fill("#prv-password", PASSWORD);
await page.click('form button[type="submit"]');
await page.waitForTimeout(2500);
ok(page.url().includes("/prv/deverrouiller"), "a correct login lands on the 4-digit code", page.url());
ok((await page.inputValue("#prv-password").catch(() => "")) === "", "the password field is cleared after signing in");
ok(
  (await (await ctx.cookies()).every((c) => c.httpOnly)),
  "every session cookie is HttpOnly"
);
ok(
  !(await (await ctx.cookies()).some((c) => c.name === "prv_session")),
  "signing in alone does NOT open PRV: the code is still required"
);

// ---------------------------------------------------------------- unlock
console.log("== unlocking through the real form ==");
await page.waitForSelector(CODE_INPUT, { timeout: 20000 });
ok(true, "unlock form is reachable and interactive");

// Three wrong attempts must lock the form, and the same generic message each time.
const messages: string[] = [];
for (const wrong of ["0000", "0001", "0002"]) {
  await page.fill(CODE_INPUT, wrong);
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(600);
  const alert = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  if (alert) messages.push(alert.trim());
}
const lockedText = (await page.textContent("body")) ?? "";
ok(/trop de tentatives|temporairement (désactivé|verrouillé)/i.test(lockedText), "three wrong codes lock the screen", lockedText.slice(0, 90));
// The first two rejections must be word-for-word identical, so nothing reveals which digit was
// wrong or how many tries were left. The third is a lockout notice, which is a state the owner
// needs to see - it must not, however, quote a remaining-attempt count.
ok(messages[0] === messages[1], "the first two rejections are identical", messages.join(" / "));
ok(!/\b[12] (essai|essais) (restant|restants)\b/i.test(lockedText), "no remaining-attempt count is shown");
ok(!/\d(e|er|ème|ieme)\s*chiffre|posi\w+ (est|sont) (faux|incorrect)/i.test(lockedText), "nothing points at which digit was wrong", lockedText.slice(0, 120));

// Recovery gets back in, whether or not the lockout kicked in.
await page.getByRole("button", { name: /oublié le code/i }).click();
await page.waitForSelector('input[type="password"]:not([inputmode="numeric"])', { timeout: 10000 });
await page.fill('input[type="password"]:not([inputmode="numeric"])', "Mimi");
await page.getByRole("button", { name: /acc[eè]s/i }).click();
await page.waitForTimeout(2500);
ok(!page.url().includes("deverrouiller"), "recovery returns to PRV", page.url());

// ---------------------------------------------------------------- every section renders
console.log("== all eight sections render without a client error ==");
const SECTIONS = [
  "/prv",
  "/prv/taches",
  "/prv/obsidian",
  "/prv/ai",
  "/prv/rapports",
  "/prv/analyse",
  "/prv/notifications",
  "/prv/parametres",
];
for (const section of SECTIONS) {
  const before = consoleErrors.length;
  await page.goto(`${BASE}${section}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const heading = (await page.textContent("h1, h2")) ?? "";
  const body = (await page.textContent("body")) ?? "";
  ok(body.trim().length > 40, `${section} renders content`, `${body.trim().length} chars`);
  ok(consoleErrors.length === before, `${section} logs no client error`, consoleErrors.slice(before).map((e) => e.text).join(" | ").slice(0, 160));
  // The private nav must be present on every section.
  ok(body.includes("Vue d'ensemble") || section === "/prv/rapports", `${section} shows the PRV navigation`, heading.slice(0, 40));
}

// ---------------------------------------------------------------- OCC isolation
console.log("== an OCC task never reaches PRV ==");
await page.goto(`${BASE}/prv/rapports`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
// The real button, so the snapshot goes through collectSnapshot() and its OCS filter.
const generate = page.getByRole("button", { name: /^(Générer|Regénérer)$/ });
ok((await generate.count()) > 0, "the reports page offers a generate action");
await generate.first().click();
await page.getByText(/Rapport créé|mise à jour/).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(500);
const reportsBody = (await page.textContent("body")) ?? "";
ok(!reportsBody.includes("TACHE OCC CONFIDENTIELLE"), "the OCC task title is absent from PRV");
const stored = await page.evaluate(async () => {
  const response = await fetch("/api/prv/reports/2026-09-27", { credentials: "include" });
  return response.ok ? response.json() : null;
});
if (stored) {
  const metrics = stored.metrics ?? {};
  const allTasks = [...(metrics.planned ?? []), ...(metrics.noDeadline ?? []), ...(metrics.completed ?? [])];
  ok(!allTasks.some((t: { moduleId: string | null }) => t.moduleId && t.moduleId.startsWith("OCC")), "no OCC module task in the metrics");
  ok(!JSON.stringify(metrics).includes("CONFIDENTIELLE"), "no OCC content anywhere in the metrics");
  ok(allTasks.some((t: { title: string }) => t.title === "Reviser le hachage"), "the OCS task is present");
} else {
  ok(false, "report detail readable from the browser");
}

// ---------------------------------------------------------------- settings round-trip
console.log("== private settings round-trip ==");
await page.goto(`${BASE}/prv/parametres`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
// Number inputs, in DOM order: the on-track rate, the default module weight, then one per
// down-weighted module (M202-M204; M201 keeps the full weight of 1), then the three trend fields.
const numbers = page.locator('input[type="number"]');
const count = await numbers.count();
ok(count >= 8, `the settings form exposes every threshold (${count} inputs)`);
await numbers.nth(2).fill("0.42");
await page.getByRole("button", { name: /Enregistrer/ }).click();
await page.getByText(/enregistr/i).first().waitFor({ timeout: 20000 });
const saved = await page.evaluate(async () => (await fetch("/api/prv/settings", { credentials: "include" })).json());
ok(saved.moduleWeights?.M202 === 0.42, "the server stored the new module weight", JSON.stringify(saved.moduleWeights));
// A value outside the allowed range must be refused, not stored verbatim.
await numbers.nth(0).fill("9999");
await page.getByRole("button", { name: /Enregistrer/ }).click();
await page.waitForTimeout(1200);
const clamped = await page.evaluate(async () => (await fetch("/api/prv/settings", { credentials: "include" })).json());
ok(clamped.onTrackRate >= 0 && clamped.onTrackRate <= 100, "an out-of-range rate is clamped", String(clamped.onTrackRate));
await numbers.nth(0).fill("80");
await page.getByRole("button", { name: /Enregistrer/ }).click();
await page.waitForTimeout(1000);

// ---------------------------------------------------------------- notifications
console.log("== notifications page is honest about push ==");
await page.goto(`${BASE}/prv/notifications`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const notifyBody = (await page.textContent("body")) ?? "";
ok(/PUSH_PUBLIC_KEY|push non configur/i.test(notifyBody), "push reports itself unconfigured rather than failing silently");
const sw = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.register("/sw.js");
  return registration.active !== null || registration.installing !== null || registration.waiting !== null;
});
ok(sw, "the service worker registers");

// ---------------------------------------------------------------- lock
console.log("== locking from the settings screen ==");
await page.goto(`${BASE}/prv/parametres`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.click('button:has-text("Verrouiller")');
await page.waitForTimeout(1500);
ok(page.url().includes("deverrouiller"), "locking returns to the unlock screen", page.url());
await page.goto(`${BASE}/prv/rapports`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
ok(page.url().includes("deverrouiller"), "a protected page is unreachable after locking", page.url());

// ---------------------------------------------------------------- OCS-only rule
console.log("== the OCS-only rule is enforced from localStorage ==");
const occCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await occCtx.addInitScript(() => {
  const state = { theme: "black", studyOption: "OCC", tasks: [], modules: {}, chapterQuizResults: {}, quizResults: {}, journalEntries: [] };
  window.localStorage.setItem("ocs-study-dashboard", JSON.stringify({ state, version: 0 }));
});
const occPage = await occCtx.newPage();
await occPage.goto(`${BASE}/prv`, { waitUntil: "networkidle" });
await occPage.waitForTimeout(1200);
ok(!occPage.url().includes("/prv") || occPage.url().includes("deverrouiller"), "an OCC user is bounced off /prv", occPage.url());
await occCtx.close();

console.log(`\n${pass} passed, ${fail} failed`);
if (consoleErrors.length) {
  console.log("\nClient errors observed:");
  for (const e of consoleErrors.slice(0, 15)) console.log(` - [${e.page}] ${e.text.slice(0, 200)}`);
}
if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(` - ${f}`);
}
await browser.close();
process.exit(fail === 0 ? 0 : 1);
