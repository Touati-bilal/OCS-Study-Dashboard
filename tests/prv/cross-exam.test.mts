/**
 * Cross-exam regression check.
 *
 * PRV is OCS-only and was given its own root layout, so the thing most at risk from that change is
 * the *other* exams: OCC, ORS and EGTS must still render, must not see a PRV link, and their data
 * must never appear in PRV.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3211";

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

const EXAMS = [
  { option: "OCC", modules: ["OCC-M201", "OCC-M202", "OCC-M207"] },
  { option: "ORS", modules: ["ORS-M201", "ORS-M207"] },
  { option: "EGTS", modules: ["EGTS202", "EGTS208"] },
];

const browser = await chromium.launch();

for (const exam of EXAMS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((option) => {
    const state = {
      theme: "black",
      studyOption: option,
      tasks: [
        { id: `${option}-secret`, title: `TACHE ${option} CONFIDENTIELLE`, moduleId: "M201", deadline: "2026-09-24", priority: "prof", status: "todo", createdAt: "2026-08-01T09:00:00.000Z" },
      ],
      modules: {},
      chapterQuizResults: {},
      quizResults: {},
      journalEntries: [],
    };
    window.localStorage.setItem("ocs-study-dashboard", JSON.stringify({ state, version: 0 }));
  }, exam.option);
  const page = await ctx.newPage();

  console.log(`== ${exam.option} ==`);

  // Every page of the exam still renders.
  for (const route of ["/", "/modules", "/planning", "/secondary"]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const body = ((await page.textContent("body")) ?? "").trim();
    ok(body.length > 40, `${exam.option} ${route} renders`, `${body.length} chars`);
  }

  for (const moduleId of exam.modules) {
    const response = await page.goto(`${BASE}/modules/${moduleId}`, { waitUntil: "networkidle" });
    ok(response?.status() === 200, `${exam.option} module ${moduleId} still resolves`, String(response?.status()));
  }

  // The PRV entry point must not be offered to another exam.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const nav = await page.locator('a[href="/prv"]').count();
  ok(nav === 0, `${exam.option} has no PRV link in the navigation`, `${nav} link(s)`);

  // And the PRV area itself bounces them out.
  await page.goto(`${BASE}/prv/rapports`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  ok(!page.url().endsWith("/prv/rapports"), `${exam.option} is redirected off PRV`, page.url());

  // The server must not hand out PRV data to a stranger either.
  const api = await page.evaluate(async () => {
    const reports = await fetch("/api/prv/reports", { credentials: "include" });
    return { status: reports.status, body: (await reports.text()).slice(0, 120) };
  });
  ok(api.status === 401, `${exam.option} gets 401 from the PRV API`, `${api.status} ${api.body.slice(0, 40)}`);

  await ctx.close();
}

// The OCS side: PRV exists in the navigation, and stays absent for everyone else.
const ocs = await browser.newContext();
await ocs.addInitScript(() => {
  window.localStorage.setItem(
    "ocs-study-dashboard",
    JSON.stringify({ state: { theme: "black", studyOption: "OCS", tasks: [], modules: {}, chapterQuizResults: {}, quizResults: {}, journalEntries: [] }, version: 0 })
  );
});
const ocsPage = await ocs.newPage();
await ocsPage.goto(`${BASE}/`, { waitUntil: "networkidle" });
await ocsPage.waitForTimeout(600);
ok((await ocsPage.locator('a[href="/prv"]').count()) > 0, "OCS does see the PRV link");
const prvHref = await ocsPage.locator('a[href="/prv"]').first().getAttribute("href");
ok(prvHref === "/prv", "the PRV link points at /prv", String(prvHref));
await ocs.close();

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(` - ${f}`);
}
await browser.close();
process.exit(fail === 0 ? 0 : 1);
