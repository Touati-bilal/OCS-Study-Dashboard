/**
 * Validation for the UI cleanup request.
 *
 * Checks, in order:
 *   1. no example/demo content is shown as real data
 *   2. the task form no longer offers Notes / Source / Liens
 *   3. the task form no longer offers a Chapitre selector
 *   4. a task can be created directly from the form
 *   5. the Status selector is readable in dark mode (closed, open, hover, focus)
 *   6. the Status selector is readable in light mode (closed, open, hover, focus)
 *   7. Préparation is gone from OCS
 *   8. Préparation is gone from a module
 *   9. real OCS data still renders
 *  10. OCC and ORS are unchanged
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`ok   ${label}`);
  } else {
    fail += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** The "Ajouter" button that opens the task form: the one sitting next to the tasks heading. */
const ADD_TASK = 'xpath=//h2[contains(., "Tâches")]/parent::div//button[contains(., "Ajouter")]';
/** The Status select is the one offering the todo / in_progress / completed values. */
const STATUS_SELECT = 'form select:has(option[value="completed"])';

const OCS_STORE = {
  state: {
    theme: "black",
    studyOption: "OCS",
    tasks: [
      {
        id: "real-task-1",
        title: "Reviser le chapitre 3",
        moduleId: "M201",
        deadline: "2026-10-02",
        priority: "important",
        status: "todo",
        createdAt: "2026-09-01T09:00:00.000Z",
      },
    ],
    modules: {},
    chapterQuizResults: {},
    quizResults: {},
    journalEntries: [],
  },
  version: 0,
};

const BADGES = [
  "owasp",
  "recherche owasp",
  "cheatsheetseries",
  "exemple",
  "exemple de tâche",
  "example task",
  "lorem",
  "placeholder",
  "demo",
  "sample",
  "todo:",
];

async function seed(page: Page, option: string) {
  await page.addInitScript((store) => {
    window.localStorage.setItem("ocs-study-dashboard", JSON.stringify(store));
  }, { ...OCS_STORE, state: { ...OCS_STORE.state, studyOption: option } });
}

type Rgba = { r: number; g: number; b: number; a: number };

/**
 * getComputedStyle can return `rgb(0-255)`, `color(srgb 0-1)` or `oklab(...)` depending on how the
 * value was authored, so the strings are normalised by letting the browser's own colour engine
 * resolve them: the colour is painted into a canvas and the pixel is read back as 0-255.
 */
async function normalize(page: Page, color: string): Promise<Rgba> {
  return page.evaluate((value) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { r: 0, g: 0, b: 0, a: 0 };
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000000";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  }, color);
}
function luminance({ r, g, b }: Rgba) {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** Alpha-composites a possibly translucent foreground over an opaque background. */
function flatten(fg: Rgba, bg: Rgba): Rgba {
  if (fg.a >= 1) return fg;
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}
function ratio(fg: Rgba, bg: Rgba) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/** The page background, used as the backdrop when a control is translucent. */
async function pageBackground(page: Page): Promise<Rgba> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { r: 0, g: 0, b: 0, a: 1 };
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  });
}

const browser = await chromium.launch();

// ------------------------------------------------------------------ 1. no demo content
console.log("\n== 1. no example/demo content appears as real data ==");
for (const option of ["OCS", "OCC", "ORS"]) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await seed(page, option);
  for (const route of ["/", "/modules", "/planning"]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const body = ((await page.textContent("body")) ?? "").toLowerCase();
    const hits = BADGES.filter((b) => body.includes(b));
    ok(hits.length === 0, `${option} ${route} shows no example/demo content`, hits.join(", "));
  }
  await ctx.close();
}

// ------------------------------------------------------------------ 2-4. the task form
console.log("\n== 2-4. the task creation form ==");
const ctx = await browser.newContext();
const page = await ctx.newPage();
await seed(page, "OCS");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

ok((await page.textContent("body"))?.includes("Reviser le chapitre 3") === true, "the real OCS task still renders");

await page.locator(ADD_TASK).first().click();
await page.waitForTimeout(700);

const labels = () => page.locator("form label").allTextContents();
const formLabels = (await labels()).map((l) => l.trim());

for (const gone of ["Notes (optionnel)", "Source / référence (optionnel)", "Liens (optionnel)"]) {
  ok(!formLabels.includes(gone), `the form no longer offers "${gone}"`, formLabels.join(" | "));
}
ok(
  !formLabels.some((l) => /chapitre|partie/i.test(l)),
  "the form no longer offers a Chapitre/Partie selector",
  formLabels.join(" | ")
);
ok(formLabels.includes("Titre"), "the form still has a Titre field", formLabels.join(" | "));
ok(formLabels.includes("Statut"), "the form still has a Statut field", formLabels.join(" | "));

// A task is created with only the title.
await page.locator('input[placeholder="Titre de la tâche"]').fill("Nouvelle tâche de validation");
// Scoped to the form: the tasks list has its own date input for the day navigator.
await page.locator('form input[type="date"]').first().fill(new Date().toISOString().slice(0, 10));
await page.getByRole("button", { name: /ajouter la tâche/i }).click();
await page.waitForTimeout(900);
const afterBody = (await page.textContent("body")) ?? "";
ok(afterBody.includes("Nouvelle tâche de validation"), "the task was created and appears in the list");

const stored = await page.evaluate(() => {
  const raw = window.localStorage.getItem("ocs-study-dashboard");
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { state: { tasks: Array<Record<string, unknown>> } };
  return parsed.state.tasks.find((t) => t.title === "Nouvelle tâche de validation") ?? null;
});
ok(stored !== null, "the task was persisted to the store");
ok(
  stored !== null && stored.notes === undefined && stored.source === undefined && (stored.links ?? []).length === 0,
  "the created task carries no notes / source / links",
  JSON.stringify({ notes: stored?.notes, source: stored?.source, links: stored?.links })
);

// The pre-existing task keeps its own data: editing must not wipe anything.
const realTask = await page.evaluate(() => {
  const parsed = JSON.parse(window.localStorage.getItem("ocs-study-dashboard") ?? "{}") as {
    state: { tasks: Array<Record<string, unknown>> };
  };
  return parsed.state.tasks.find((t) => t.id === "real-task-1") ?? null;
});
ok(realTask !== null, "the pre-existing real task was not modified", JSON.stringify(realTask));
await ctx.close();

// ------------------------------------------------------------------ 5-6. the Status selector
console.log("\n== 5-6. the Status selector follows the theme ==");
for (const theme of ["black", "white"]) {
  const mode = theme === "black" ? "DARK" : "LIGHT";
  const tctx = await browser.newContext();
  const tpage = await tctx.newPage();
  await tpage.addInitScript((t) => {
    window.localStorage.setItem(
      "ocs-study-dashboard",
      JSON.stringify({ state: { theme: t, studyOption: "OCS", tasks: [], modules: {}, chapterQuizResults: {}, quizResults: {}, journalEntries: [] }, version: 0 })
    );
  }, theme);
  await tpage.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await tpage.waitForTimeout(600);
  await tpage.locator(ADD_TASK).first().click();
  await tpage.waitForTimeout(700);

  const statusSelect = tpage.locator(STATUS_SELECT).first();
  const readState = async (state: "closed" | "hover" | "focus") => {
    if (state === "hover") await statusSelect.hover();
    if (state === "focus") await statusSelect.focus();
    return tpage.evaluate((sel: HTMLSelectElement) => {
      const cs = getComputedStyle(sel);
      const first = sel.options[0];
      const ocs = first ? getComputedStyle(first) : null;
      return {
        theme: document.documentElement.getAttribute("data-theme"),
        bg: cs.backgroundColor,
        color: cs.color,
        optionBg: ocs?.backgroundColor ?? "",
        optionColor: ocs?.color ?? "",
      };
    }, await statusSelect.elementHandle() as HTMLSelectElement);
  };

  const closed = await readState("closed");
  const hovered = await readState("hover");
  const focused = await readState("focus");
  const pageBg = await pageBackground(tpage);

  const cbg = flatten(await normalize(tpage, closed.bg), pageBg);
  const ctext = flatten(await normalize(tpage, closed.color), cbg);
  const hbg = flatten(await normalize(tpage, hovered.bg), pageBg);
  const htext = flatten(await normalize(tpage, hovered.color), hbg);
  const fbg = flatten(await normalize(tpage, focused.bg), pageBg);
  const ftext = flatten(await normalize(tpage, focused.color), fbg);
  const obg = flatten(await normalize(tpage, closed.optionBg), pageBg);
  const otext = flatten(await normalize(tpage, closed.optionColor), obg);

  ok((await normalize(tpage, closed.bg)).a === 1, `${mode}: the selected control background is opaque`, closed.bg);
  ok(ratio(ctext, cbg) >= 4.5, `${mode}: selected text is readable on the selected background`,
    `ratio=${ratio(ctext, cbg).toFixed(2)} text=rgb(${ctext.r},${ctext.g},${ctext.b}) bg=rgb(${cbg.r},${cbg.g},${cbg.b})`);
  ok(ratio(htext, hbg) >= 4.5, `${mode}: hover state is readable`,
    `ratio=${ratio(htext, hbg).toFixed(2)} text=rgb(${htext.r},${htext.g},${htext.b}) bg=rgb(${hbg.r},${hbg.g},${hbg.b})`);
  ok(ratio(ftext, fbg) >= 4.5, `${mode}: focus state is readable`,
    `ratio=${ratio(ftext, fbg).toFixed(2)} text=rgb(${ftext.r},${ftext.g},${ftext.b}) bg=rgb(${fbg.r},${fbg.g},${fbg.b})`);

  // The dropdown list itself, which is the part that used to turn white.
  ok((await normalize(tpage, closed.optionBg)).a === 1, `${mode}: the dropdown list background is opaque`, closed.optionBg);
  ok(ratio(otext, obg) >= 4.5, `${mode}: dropdown text is readable`,
    `ratio=${ratio(otext, obg).toFixed(2)} text=rgb(${otext.r},${otext.g},${otext.b}) bg=rgb(${obg.r},${obg.g},${obg.b})`);

  // The whole point of the bug: the selected row must never be white-on-white in dark mode, nor
  // black-on-black in light mode.
  if (theme === "black") {
    ok(cbg.r < 128, "DARK: the selected background is dark, not white", `rgb(${cbg.r},${cbg.g},${cbg.b})`);
    ok(obg.r < 128, "DARK: the dropdown background is dark, not white", `rgb(${obg.r},${obg.g},${obg.b})`);
    ok(ctext.r > 200, "DARK: the selected text is light", `rgb(${ctext.r},${ctext.g},${ctext.b})`);
  } else {
    ok(cbg.r > 200, "LIGHT: the selected background is light", `rgb(${cbg.r},${cbg.g},${cbg.b})`);
    ok(obg.r > 200, "LIGHT: the dropdown background is light", `rgb(${obg.r},${obg.g},${obg.b})`);
    ok(ctext.r < 60, "LIGHT: the selected text is dark", `rgb(${ctext.r},${ctext.g},${ctext.b})`);
  }
  console.log(`     ${mode} closed bg=rgb(${cbg.r},${cbg.g},${cbg.b}) text=rgb(${ctext.r},${ctext.g},${ctext.b}) | option bg=rgb(${obg.r},${obg.g},${obg.b}) text=rgb(${otext.r},${otext.g},${otext.b})`);
  await tctx.close();
}

// ------------------------------------------------------------------ 7-8. Préparation is gone
console.log("\n== 7-8. Préparation no longer appears in OCS ==");
const pctx = await browser.newContext();
const ppage = await pctx.newPage();
await seed(ppage, "OCS");
for (const route of ["/", "/modules", "/planning", "/secondary"]) {
  await ppage.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await ppage.waitForTimeout(400);
  const body = (await ppage.textContent("body")) ?? "";
  const links = await ppage.locator('a[href="/preparation"]').count();
  ok(!/Préparation/i.test(body) && links === 0, `${route} no longer mentions Préparation`,
    `links=${links} bodyHas=${/Préparation/i.test(body)}`);
}
// Inside a module.
await ppage.goto(`${BASE}/modules/M201`, { waitUntil: "networkidle" });
await ppage.waitForTimeout(800);
for (const tab of ["Aperçu", "Les parties", "Documents", "Notes", "Tâches"]) {
  ok(await ppage.getByRole("button", { name: tab, exact: true }).count() > 0, `M201 still has the "${tab}" tab`);
}
const mBody = (await ppage.textContent("body")) ?? "";
ok(!/Préparation/i.test(mBody), "M201 no longer mentions Préparation");
// Every tab of the module, one by one.
for (const tab of ["Aperçu", "Les parties", "Documents", "Notes", "Tâches"]) {
  await ppage.getByRole("button", { name: tab, exact: true }).first().click();
  await ppage.waitForTimeout(500);
  const b = (await ppage.textContent("body")) ?? "";
  ok(!/Préparation/i.test(b), `M201 "${tab}" tab has no Préparation`);
}
const route = await ppage.goto(`${BASE}/preparation`, { waitUntil: "networkidle" });
ok(route?.status() === 404, "/preparation is no longer a route", `status=${route?.status()}`);
await pctx.close();

// ------------------------------------------------------------------ 9-10. OCC and ORS
console.log("\n== 9-10. OCC and ORS are unchanged ==");
for (const option of ["OCC", "ORS"]) {
  const c = await browser.newContext();
  const pg = await c.newPage();
  await seed(pg, option);
  await pg.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pg.waitForTimeout(600);
  const body = (await pg.textContent("body")) ?? "";
  ok(body.length > 40, `${option} home still renders`);
  ok(!/Préparation/i.test(body), `${option} home has no Préparation`);
  ok((await pg.locator(ADD_TASK).count()) > 0, `${option} can still add a task`);
  for (const m of option === "OCC" ? ["OCC-M201", "OCC-M207"] : ["ORS-M201", "ORS-M207"]) {
    const r = await pg.goto(`${BASE}/modules/${m}`, { waitUntil: "networkidle" });
    ok(r?.status() === 200, `${option} module ${m} still resolves`, String(r?.status()));
  }
  await c.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(` - ${f}`);
}
await browser.close();
process.exit(fail === 0 ? 0 : 1);
