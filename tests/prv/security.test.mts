/**
 * PRV security test suite. Black-box, against a running server.
 *   BASE=http://localhost:3111 npx tsx /tmp/prv/security.ts
 */
const BASE = process.env.BASE ?? "http://localhost:3199";
const CODE = process.env.PRV_TEST_CODE ?? "";
const CRON = process.env.PRV_TEST_CRON_SECRET ?? "prv-test-cron-secret-0123456789";
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
function eq(actual: unknown, expected: unknown, label: string) {
  ok(
    JSON.stringify(actual) === JSON.stringify(expected),
    label,
    `got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`
  );
}

/** The PRV-area cookie, i.e. the one the 4-digit code grants. */
function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/prv_session=([^;]*)/);
  return match ? `prv_session=${match[1]}` : "";
}

/** The owner account cookie, i.e. the one the username + email + password grants. */
function ownerCookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/prv_owner=([^;]*)/);
  return match ? `prv_owner=${match[1]}` : "";
}

/** Signs the owner in and returns the account cookie, or "" when the login was refused. */
async function login(body: Record<string, string> = {}) {
  return json("/api/prv/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, email: EMAIL, password: PASSWORD, ...body }),
  });
}

async function json(path: string, init: RequestInit = {}): Promise<{ status: number; body: any; response: Response }> {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual", ...init });
  const text = await response.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body, response };
}

// ---------------------------------------------------------------- unauthenticated
console.log("\n== 1. every PRV API refuses an unauthenticated caller ==");
const API_PATHS: Array<[string, string]> = [
  ["/api/prv/session", "GET"],
  ["/api/prv/reports", "GET"],
  ["/api/prv/reports", "POST"],
  ["/api/prv/reports/2026-09-27", "GET"],
  ["/api/prv/reports/2026-09-27/pdf", "GET"],
  ["/api/prv/settings", "GET"],
  ["/api/prv/settings", "POST"],
  ["/api/prv/review", "GET"],
  ["/api/prv/review", "POST"],
  ["/api/prv/review", "DELETE"],
  ["/api/prv/push", "GET"],
  ["/api/prv/push", "POST"],
  ["/api/prv/push", "DELETE"],
  ["/api/prv/obsidian", "GET"],
  ["/api/prv/ai/tasks", "POST"],
  ["/api/prv/ai/analyze/2026-09-27", "POST"],
];
for (const [path, method] of API_PATHS) {
  const { status } = await json(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : "{}",
  });
  // /session is the one endpoint that must answer without a session (it reports "locked out").
  const expected = path === "/api/prv/session" ? 200 : 401;
  ok(status === expected, `${method} ${path} without session => ${expected}`, `got ${status}`);
}

// ---------------------------------------------------------------- direct URL pages
console.log("== 2. direct URL access to every PRV page redirects to the login ==");
const PAGES = ["/prv", "/prv/taches", "/prv/obsidian", "/prv/ai", "/prv/rapports", "/prv/analyse", "/prv/notifications", "/prv/parametres"];
for (const path of PAGES) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  // With no account session at all, the first gate is the one that is missing.
  ok(
    response.status >= 300 && response.status < 400 && location.includes("/connexion"),
    `GET ${path} answers with a real redirect to the login`,
    `status ${response.status} location ${location}`
  );
  // The body of a redirect must carry no report data, task titles or session material.
  const body = await response.text();
  ok(
    !/Rapport hebdomadaire|downloadId|scrypt[.$]v1|prv_session|prv_owner|TP en retard/.test(body),
    `GET ${path} leaks no private content`,
    `len ${body.length}`
  );
}
const unlockPage = await fetch(`${BASE}/prv/deverrouiller`, { redirect: "manual" });
ok(unlockPage.status === 200, "unlock page reachable without a session", `got ${unlockPage.status}`);

// ---------------------------------------------------------------- owner login
console.log("== 3. owner login: username + email + password ==");

// The code alone must not open anything: the first gate is the account.
const codeFirst = await json("/api/prv/unlock", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: CODE }),
});
eq(codeFirst.status, 401, "the correct code without an account session is refused");
ok(/connectez-vous/i.test(codeFirst.body.error ?? ""), "the refusal says the account is missing first", String(codeFirst.body.error));

const loginFailures = new Map<string, string>();
for (const [label, override] of [
  ["a wrong password", { password: "definitely-not-the-password" }],
  ["a wrong username", { username: "Someone Else" }],
  ["a wrong email", { email: "someone.else@example.invalid" }],
  ["an empty password", { password: "" }],
] as Array<[string, Record<string, string>]>) {
  const attempt = await login(override);
  eq(attempt.status, 401, `${label} => 401`);
  eq(ownerCookieFrom(attempt.response), "", `${label} sets no owner cookie`);
  loginFailures.set(label, String(attempt.body.error));
}

// The generic denial must be identical for every wrong field, so the endpoint cannot be used to
// discover which account exists or which part of the input was the problem.
const distinctMessages = new Set(loginFailures.values());
ok(
  distinctMessages.size === 1 && !/mot de passe|password|utilisateur|email|courriel/i.test([...distinctMessages][0] ?? ""),
  "every login failure returns the identical generic message",
  [...loginFailures.entries()].map(([k, v]) => `${k}: ${v}`).join(" | ")
);

const good = await login();
eq(good.status, 200, "correct username + email + password => 200");
let ownerCookie = ownerCookieFrom(good.response);
ok(ownerCookie.length > 0, "login sets an owner cookie");
ok(ownerCookieFrom(good.response).startsWith("prv_owner="), "the cookie is the owner cookie, not the PRV one");
ok(cookieFrom(good.response) === "", "login does NOT set a PRV session: the code is still required");

// The account cookie alone must not open PRV.
const afterLoginOnly = await fetch(`${BASE}/prv/rapports`, { redirect: "manual", headers: { cookie: ownerCookie } });
ok(
  afterLoginOnly.status >= 300 && afterLoginOnly.status < 400,
  "the account session alone still cannot open a PRV page",
  `status ${afterLoginOnly.status}`
);
ok(
  (afterLoginOnly.headers.get("location") ?? "").includes("/prv/deverrouiller"),
  "the second gate is the 4-digit code",
  String(afterLoginOnly.headers.get("location"))
);

// The API refuses the owner cookie on its own, exactly as it refuses no cookie at all.
const apiWithOwnerOnly = await json("/api/prv/reports", { headers: { cookie: ownerCookie } });
eq(apiWithOwnerOnly.status, 401, "the PRV API rejects the account cookie on its own");

// ---------------------------------------------------------------- wrong codes + lockout
console.log("== 4. wrong codes, lockout after 3 attempts, lockout holds ==");
const AUTH = { "Content-Type": "application/json", cookie: ownerCookie };
const wrong1 = await json("/api/prv/unlock", { method: "POST", headers: AUTH, body: JSON.stringify({ code: "0000" }) });
eq(wrong1.status, 401, "1st wrong code => 401");
const wrong2 = await json("/api/prv/unlock", { method: "POST", headers: AUTH, body: JSON.stringify({ code: "0001" }) });
eq(wrong2.status, 401, "2nd wrong code => 401");
ok(wrong1.body.error === wrong2.body.error, "failure message is identical for each attempt", `${wrong1.body.error} vs ${wrong2.body.error}`);

const wrong3 = await json("/api/prv/unlock", { method: "POST", headers: AUTH, body: JSON.stringify({ code: "0002" }) });
eq(wrong3.status, 423, "3rd wrong code => 423 locked");
eq(wrong3.body.error, wrong1.body.error, "lockout message identical to generic failure");

// Even the CORRECT code must now fail while locked.
const correctWhileLocked = await json("/api/prv/unlock", { method: "POST", headers: AUTH, body: JSON.stringify({ code: CODE }) });
eq(correctWhileLocked.status, 423, "correct code refused during lockout");
ok(correctWhileLocked.body.locked === true, "lockout is signalled");

// Recovery lifts the lockout.
const recovered = await json("/api/prv/recover", { method: "POST", headers: AUTH, body: JSON.stringify({ phrase: "Mimi" }) });
eq(recovered.status, 200, "recovery phrase unlocks");
let cookie = cookieFrom(recovered.response);
ok(cookie.length > 0, "recovery sets a session cookie");

// The code itself must open PRV, not only the recovery phrase. This is checked explicitly because a
// mismatch between the peppered and unpeppered verifiers makes every code fail while recovery, which
// is hashed separately, keeps working - the lockout and the recovery both still "pass" on their own.
const signOut = await json("/api/prv/logout", { method: "POST", headers: { cookie: `${ownerCookie}; ${cookie}` } });
eq(signOut.status, 200, "signed out to test the code on its own");

const ownerAgain = await login();
const ownerCookie2 = ownerCookieFrom(ownerAgain.response);
ok(ownerCookie2.length > 0, "signed in again after the sign-out");
const unlockedByCode = await json("/api/prv/unlock", {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie: ownerCookie2 },
  body: JSON.stringify({ code: CODE }),
});
eq(unlockedByCode.status, 200, "the CORRECT 4-digit code opens PRV");
ok(cookieFrom(unlockedByCode.response).length > 0, "the correct code sets the PRV session cookie");
eq(
  (await json("/api/prv/reports", { headers: { cookie: `${ownerCookie2}; ${cookieFrom(unlockedByCode.response)}` } })).status,
  200,
  "account + correct code reads the private reports"
);
// The new session replaces the recovery one for the rest of the suite.
ownerCookie = ownerCookie2;
cookie = cookieFrom(unlockedByCode.response);

/** From here on PRV requires both cookies, so every authenticated call sends both. */
const bothCookies = `${ownerCookie}; ${cookie}`;

// With both cookies, PRV opens.
const openWithBoth = await fetch(`${BASE}/prv/rapports`, {
  redirect: "manual",
  headers: { cookie: `${ownerCookie}; ${cookie}` },
});
eq(openWithBoth.status, 200, "account session + code opens a PRV page");

// The owner cookie must not be usable as a PRV session, and vice versa.
const ownerAsPrv = await json("/api/prv/reports", { headers: { cookie: ownerCookie } });
eq(ownerAsPrv.status, 401, "the owner cookie cannot be replayed as a PRV session");
const prvAsOwner = await json("/api/prv/logout", { method: "POST" });
eq(prvAsOwner.status, 200, "signing out without a session is still safe");

// Wrong recovery phrase is refused.
const badRecovery = await json("/api/prv/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phrase: "nope" }) });
eq(badRecovery.status, 401, "wrong recovery phrase => 401");

// ---------------------------------------------------------------- session hardening
console.log("== 5. session cookie is httpOnly and tamper-proof ==");
const setCookieHeader = recovered.response.headers.get("set-cookie") ?? "";
ok(/HttpOnly/i.test(setCookieHeader), "cookie is HttpOnly", setCookieHeader);
ok(/SameSite=Lax/i.test(setCookieHeader), "cookie is SameSite=Lax", setCookieHeader);
ok(/Path=\//.test(setCookieHeader), "cookie is scoped to /", setCookieHeader);

const token = cookie.replace("prv_session=", "");
// Flip one character of the signature.
const sig = token.slice(token.lastIndexOf(".") + 1);
const tampered = `${token.slice(0, token.lastIndexOf("."))}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;
const withTampered = await json("/api/prv/reports", { headers: { cookie: `${ownerCookie}; prv_session=${tampered}` } });
eq(withTampered.status, 401, "tampered signature rejected");

// Change the payload but keep a valid-looking shape.
const [payloadPart] = token.split(".");
const payloadMutated = Buffer.from(
  JSON.stringify({ iat: 0, exp: Date.now() + 9e8, jti: "forged" })
).toString("base64url");
const forged = `${payloadMutated}.${sig}`;
eq((await json("/api/prv/reports", { headers: { cookie: `${ownerCookie}; prv_session=${forged}` } })).status, 401, "forged payload rejected");
ok(payloadPart !== payloadMutated, "forged payload really differs");

// Garbage cookies.
for (const bad of ["", "x", "a.b", "null", "undefined", "eyJ9.sig", `${token}x`]) {
  eq((await json("/api/prv/reports", { headers: { cookie: `${ownerCookie}; prv_session=${bad}` } })).status, 401, `garbage cookie "${bad.slice(0, 12)}" rejected`);
}
// No cookie at all.
eq((await json("/api/prv/reports")).status, 401, "no cookie rejected");
eq((await json("/api/prv/reports", { headers: { cookie: ownerCookie } })).status, 401, "account cookie alone rejected");
eq((await json("/api/prv/reports", { headers: { cookie: cookie } })).status, 401, "code cookie alone rejected");

// ---------------------------------------------------------------- authorised access
console.log("== 6. authenticated access works, and the report is idempotent ==");
const auth = { cookie: bothCookies, "Content-Type": "application/json" };
const snapshot = {
  tasks: [
    { title: "Cours ch1", moduleId: "M201", chapterId: "ch-1", deadline: "2026-09-23", status: "completed", completedAt: "2026-09-24T10:00:00.000Z", priority: "prof" },
    { title: "TP en retard", moduleId: "M201", deadline: "2026-08-01", status: "todo" },
    { title: "Sans module", status: "todo" },
  ],
  moduleRuntime: { M201: { hoursStudied: 8, objectiveStatus: { "ch-1-o-1": true } } },
  chapterQuiz: { M201: { "ch-1": { correct: 5, incorrect: 2, total: 7, percentage: 71.4, completedAt: "2026-09-24T10:00:00.000Z" } } },
  legacyQuiz: {},
  journal: [{ date: "2026-09-24", notUnderstood: "le hachage", questions: "", notes: "", problems: "" }],
};

const gen1 = await json("/api/prv/reports", { method: "POST", headers: auth, body: JSON.stringify({ snapshot, weekEnd: "2026-09-27" }) });
eq(gen1.status, 201, "first generation => 201");
eq(gen1.body.generation, 1, "generation starts at 1");
const gen2 = await json("/api/prv/reports", { method: "POST", headers: auth, body: JSON.stringify({ snapshot, weekEnd: "2026-09-27" }) });
eq(gen2.status, 200, "second generation => 200 (updated, not created)");
eq(gen2.body.generation, 2, "generation incremented");
const list = await json("/api/prv/reports", { headers: auth });
const sameWeek = (list.body.reports as any[]).filter((r) => r.weekEnd === "2026-09-27");
eq(sameWeek.length, 1, "exactly ONE report for the week after two generations");
ok(list.body.reports.length >= 1, "report listed");

const detail = await json("/api/prv/reports/2026-09-27", { headers: auth });
eq(detail.status, 200, "report detail readable with session");
eq(detail.body.metrics.completed.length, 1, "metrics computed from real snapshot");
eq(detail.body.metrics.longOverdue.length, 1, "long overdue detected");
ok(detail.body.metrics.journal.unclear.includes("le hachage"), "journal point captured");
eq(detail.body.ai.status, "pending", "AI absent until requested");

// The AI route used to verify only the 4-digit-code cookie. It must need the account cookie too,
// otherwise holding that one cookie was enough to spend AI calls and write into a stored report.
const analyzeBoth = { "Content-Type": "application/json", cookie: bothCookies };
const analyzeCodeOnly = { "Content-Type": "application/json", cookie: cookie };
const analyzeAccountOnly = { "Content-Type": "application/json", cookie: ownerCookie };
const analyzeNoSession = { "Content-Type": "application/json" };
const ANALYZE = "/api/prv/ai/analyze/2026-09-27";
const analyzeOrigin = { origin: BASE };
eq((await json(ANALYZE, { method: "POST", headers: { ...analyzeNoSession, ...analyzeOrigin } })).status, 401, "AI analyze without any session => 401");
eq((await json(ANALYZE, { method: "POST", headers: { ...analyzeCodeOnly, ...analyzeOrigin } })).status, 401, "AI analyze with the code cookie alone => 401");
eq((await json(ANALYZE, { method: "POST", headers: { ...analyzeAccountOnly, ...analyzeOrigin } })).status, 401, "AI analyze with the account cookie alone => 401");
// Both cookies pass authorisation. AI is disabled in the fixtures, so the route answers without
// calling a model - enough to show the gate was reached.
eq((await json(ANALYZE, { method: "POST", headers: { ...analyzeBoth, ...analyzeOrigin } })).status, 200, "AI analyze with both cookies reaches the route");
eq(
  (await json(ANALYZE, { method: "POST", headers: { ...analyzeBoth, origin: "https://evil.example" } })).status,
  403,
  "AI analyze from a foreign origin => 403"
);

// ---------------------------------------------------------------- PDF authorisation
console.log("== 7. PDF needs a session AND the unguessable download id ==");
eq((await json("/api/prv/reports/2026-09-27/pdf")).status, 401, "PDF without session => 401");
eq((await json("/api/prv/reports/2026-09-27/pdf?d=guess", { headers: auth })).status, 403, "PDF with guessed id => 403");
eq((await json("/api/prv/reports/2026-09-27/pdf?d=", { headers: auth })).status, 403, "PDF with empty id => 403");
const downloadId = list.body.reports.find((r: any) => r.weekEnd === "2026-09-27").downloadId;
ok(typeof downloadId === "string" && downloadId.length >= 20, "download id is long and opaque", String(downloadId));
const pdf = await fetch(`${BASE}/api/prv/reports/2026-09-27/pdf?d=${encodeURIComponent(downloadId)}`, { headers: auth });
eq(pdf.status, 200, "PDF with session + correct id => 200");
eq(pdf.headers.get("content-type"), "application/pdf", "PDF content type");
ok((pdf.headers.get("cache-control") ?? "").includes("no-store"), "PDF is not cached");
ok((pdf.headers.get("x-content-type-options") ?? "") === "nosniff", "PDF nosniff");
const pdfBytes = Buffer.from(await pdf.arrayBuffer());
ok(pdfBytes.subarray(0, 5).toString() === "%PDF-", "body really is a PDF", pdfBytes.subarray(0, 8).toString());
ok(pdfBytes.length > 1000, "PDF has content", `${pdfBytes.length} bytes`);
// Another session's data must not be reachable by swapping weeks.
eq((await json("/api/prv/reports/1999-01-03/pdf?d=" + encodeURIComponent(downloadId), { headers: auth })).status, 404, "PDF for unknown week => 404");

// ---------------------------------------------------------------- input validation
console.log("== 8. untrusted input is sanitised ==");
const hostile = await json("/api/prv/reports", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    weekEnd: "2026-09-27",
    snapshot: {
      tasks: [
        { title: "<script>alert(1)</script>", moduleId: "M201", deadline: "2026-09-23" },
        { title: "x".repeat(9000) },
        null,
        "string",
        { title: "  ", priority: "__proto__" },
        { title: "ok", priority: "important", status: "in_progress", moduleId: "M201" },
      ],
      moduleRuntime: JSON.parse('{"M201":{"hoursStudied":1e12,"objectiveStatus":{"__proto__":true,"ch-1-o-1":true}}}'),
    },
  }),
});
eq(hostile.status, 200, "hostile snapshot accepted without crashing");
const hostileDetail = await json("/api/prv/reports/2026-09-27", { headers: auth });
// A task title is data, so storing "<script>alert(1)</script>" verbatim is correct - the escaping
// happens when React renders it. What must never happen is an *executable* script in the page.
const rendered = await (await fetch(`${BASE}/prv/taches`, { headers: { cookie: bothCookies } })).text();
ok(!/<script>alert\(1\)<\/script>/.test(rendered), "script payload is not rendered as a live script tag");
ok(rendered.includes("&lt;script&gt;") || !rendered.includes("alert(1)"), "payload is HTML-escaped on render");
ok(!JSON.stringify(hostileDetail.body).includes('"__proto__"'), "prototype keys are not stored");
eq(hostileDetail.body.metrics.longOverdue.length, 0, "the hostile snapshot contains no overdue task");
ok(hostileDetail.body.metrics.modules[0].hoursStudied <= 5000, "hours clamped", String(hostileDetail.body.metrics.modules[0].hoursStudied));
// Six raw entries are posted: two well-formed dated tasks, one undated, plus `null`, a string and
// an empty-title object. Only the three well-formed ones may reach the metrics, each with a unique id.
const hostilePlanned = hostileDetail.body.metrics.planned as Array<{ id: string; title: string }>;
const hostileNoDeadline = hostileDetail.body.metrics.noDeadline as Array<{ id: string; title: string }>;
eq(hostilePlanned.length, 1, "only the dated task is planned");
eq(hostileNoDeadline.length, 2, "both undated tasks are kept as open work");
const survivors = [...hostilePlanned, ...hostileNoDeadline];
eq(survivors.length, 3, "null, a string and an empty-title entry are all rejected");
ok(survivors.every((t) => typeof t.title === "string" && t.title.trim().length > 0), "survivors have a real title");
eq(new Set(survivors.map((t) => t.id)).size, survivors.length, "survivor ids are unique, not a shared fallback");

// Prototype pollution must not reach Object.prototype.
eq(({} as any).polluted, undefined, "Object.prototype not polluted");
eq(([] as any).polluted, undefined, "Array.prototype not polluted");

// Bad week values.
for (const bad of ["not-a-date", "2026-13-45", "../../etc/passwd", "'; DROP TABLE--"]) {
  const r = await json("/api/prv/reports/2026-13-45", { headers: auth });
  eq(r.status, 400, `bad week "${bad.slice(0, 14)}" => 400`);
}
eq((await json("/api/prv/reports/2026-09-27", { headers: auth })).status, 200, "valid week still works after bad ones");

// Oversized payload.
const huge = await json("/api/prv/reports", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ weekEnd: "2026-09-27", snapshot: { tasks: Array.from({ length: 30000 }, (_, i) => ({ title: `T${i}` })) } }),
});
ok(huge.status === 200 || huge.status === 201, "huge payload does not 500", `status ${huge.status}`);

// Settings clamping.
const badSettings = await json("/api/prv/settings", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ reportDay: 99, moduleWeights: { M201: 500 }, onTrackRate: -20, aiEnabled: "yes" }),
});
eq(badSettings.status, 200, "settings saved");
eq(badSettings.body.reportDay, 0, "out-of-range reportDay rejected");
eq(badSettings.body.moduleWeights.M201, undefined, "out-of-range weight rejected");
eq(badSettings.body.aiEnabled, false, "non-boolean aiEnabled rejected");

// ---------------------------------------------------------------- cron
console.log("== 9. cron endpoint requires the shared secret ==");
eq((await json("/api/prv/cron/weekly-report", { method: "POST" })).status, 401, "cron without secret => 401");
eq((await json("/api/prv/cron/weekly-report", { method: "POST", headers: { "x-prv-cron-secret": "wrong" } })).status, 401, "cron with wrong secret => 401");
eq((await json("/api/prv/cron/weekly-report", { method: "POST", headers: { "x-prv-cron-secret": CRON + "x" } })).status, 401, "cron with near-miss secret => 401");
// The session cookie alone must NOT unlock the cron.
const cronWithCookieOnly = await json("/api/prv/cron/weekly-report", { method: "POST", headers: { cookie: bothCookies } });
eq(cronWithCookieOnly.status, 401, "session cookie does not authorise cron");
const cronOk = await json("/api/prv/cron/weekly-report", { method: "POST", headers: { "x-prv-cron-secret": CRON }, body: "{}" });
eq(cronOk.status, 200, "cron with correct secret => 200");
eq(cronOk.body.ok, true, "cron succeeded");
ok(typeof cronOk.body.snapshotAt === "string", "cron used the stored real snapshot", String(cronOk.body.snapshotAt));

// ---------------------------------------------------------------- cross-origin
console.log("== 10. cross-origin writes are refused ==");
eq((await json("/api/prv/unlock", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ code: CODE }) })).status, 403, "cross-origin unlock => 403");
eq((await json("/api/prv/review", { method: "POST", headers: { ...auth, origin: "https://evil.example" }, body: JSON.stringify({ text: "x" }) })).status, 403, "cross-origin review => 403");
eq((await json("/api/prv/settings", { method: "POST", headers: { ...auth, origin: "https://evil.example" }, body: "{}" })).status, 403, "cross-origin settings => 403");
eq((await json("/api/prv/push", { method: "POST", headers: { ...auth, origin: "https://evil.example" }, body: "{}" })).status, 403, "cross-origin push => 403");

// ---------------------------------------------------------------- review items
console.log("== 11. review items are session-scoped and validated ==");
const added = await json("/api/prv/review", { method: "POST", headers: auth, body: JSON.stringify({ text: "  revoir le TP  " }) });
eq(added.status, 201, "review item added");
eq(added.body.item.text, "revoir le TP", "text trimmed");
eq((await json("/api/prv/review", { method: "POST", headers: auth, body: JSON.stringify({ text: "   " }) })).status, 400, "blank text rejected");
eq((await json("/api/prv/review", { method: "POST", headers: auth, body: JSON.stringify({ text: "x".repeat(900) }) })).status, 201, "long text accepted");
eq((await json("/api/prv/review", { method: "POST", headers: auth, body: JSON.stringify({ text: "ok", moduleId: "'; drop--" }) })).status, 201, "weird moduleId does not crash");
const items = await json("/api/prv/review", { headers: auth });
ok((items.body.items as any[]).every((i) => i.moduleId === null || /^[A-Za-z0-9-]+$/.test(i.moduleId)), "moduleId sanitised");

// ---------------------------------------------------------------- lock
console.log("== 12. locking ends the session ==");
// Captured *before* locking, then replayed after it. `/api/prv/lock` used to clear the browser's
// cookie, which is only a request to be polite: a cookie the caller kept would still verify,
// because nothing in the stored state changed. So a stolen session survived a lock.
const capturedBeforeLock = cookieFrom((await json("/api/prv/unlock", { method: "POST", headers: { "Content-Type": "application/json", cookie: ownerCookie }, body: JSON.stringify({ code: CODE }) })).response);
ok(capturedBeforeLock.length > 0, "a session cookie is captured before the lock");

const lockCookie = cookieFrom((await json("/api/prv/lock", { method: "POST", headers: auth })).response);
ok(lockCookie.length > 0, "lock clears the cookie");
const afterLock = await json("/api/prv/reports", { headers: { cookie: lockCookie ? `${ownerCookie}; ${lockCookie}` : `${ownerCookie}; prv_session=` } });
eq(afterLock.status, 401, "old session no longer works after lock");
// The replay that matters: a cookie the caller kept, plus the still-valid account cookie.
eq(
  (await json("/api/prv/reports", { headers: { cookie: `${ownerCookie}; ${capturedBeforeLock}` } })).status,
  401,
  "a captured session cookie is dead after the lock, even alongside a valid account cookie"
);
// Locking ends the code session but leaves the account signed in, so the page asks for the code
// again rather than sending the visitor back to the login form.
const pageAfterLock = await fetch(`${BASE}/prv/rapports`, {
  redirect: "manual",
  headers: { cookie: `${ownerCookie}; ${lockCookie || "prv_session="}` },
});
ok(
  (pageAfterLock.status === 307 || pageAfterLock.status === 302) &&
    (pageAfterLock.headers.get("location") ?? "").includes("deverrouiller"),
  "page redirects back to the code after lock",
  `status ${pageAfterLock.status} location ${pageAfterLock.headers.get("location")}`
);
// With no account cookie at all it goes one step further back, to the login.
const pageAfterLockNoOwner = await fetch(`${BASE}/prv/rapports`, { redirect: "manual" });
ok(
  (pageAfterLockNoOwner.status === 307 || pageAfterLockNoOwner.status === 302) &&
    (pageAfterLockNoOwner.headers.get("location") ?? "").includes("/connexion"),
  "page without any session redirects to the login",
  `status ${pageAfterLockNoOwner.status}`
);

// ---------------------------------------------------------------- no secret disclosure
console.log("== 13. no secret ever reaches the browser ==");
const pages = ["/", "/prv", "/prv/deverrouiller", "/modules/M201", "/planning"];
const scriptUrls = new Set<string>();
for (const path of pages) {
  const html = await (await fetch(`${BASE}${path}`, { redirect: "manual" })).text();
  for (const m of html.matchAll(/\/_next\/static\/[^"']+\.js/g)) scriptUrls.add(m[0]);
}
ok(scriptUrls.size > 0, "found client bundles to inspect", `${scriptUrls.size}`);
// Values, never names: a bundle may legitimately mention a variable *name* in setup help text, but
// never a value. Both new secrets are checked, plus the pepper and the stored hashes themselves.
const HASHES = [
  process.env.PRV_OWNER_PASSWORD_HASH ?? "",
  process.env.PRV_ACCESS_CODE_HASH ?? "",
  process.env.PRV_SECRET_PEPPER ?? "",
  process.env.PRV_SESSION_SECRET ?? "",
].filter((value) => value.length > 0);
const SECRETS = [CODE, PASSWORD, CRON, "prv-test-ai-key-must-never-reach-a-browser", "scrypt.v1.", "Mimi", "PRV_SESSION_SECRET", "PRV_RECOVERY_HASH", "AI_API_KEY", "PUSH_PRIVATE_KEY", "PRV_OBSIDIAN_VAULT", ...HASHES];
let leaked: string[] = [];
for (const url of scriptUrls) {
  const js = await (await fetch(`${BASE}${url}`)).text();
  for (const secret of SECRETS) if (js.includes(secret)) leaked.push(`<${secret.slice(0, 8)}…> in ${url}`);
}
ok(leaked.length === 0, "no secret, password or hash literal in any client bundle", leaked.join(", "));

// The login and unlock pages must not echo a credential, a hash or the pepper back into the HTML.
for (const [path, secrets] of [
  ["/prv/deverrouiller", [CODE, "scrypt.v1.", "Mimi", CRON, ...HASHES]],
  ["/connexion", [PASSWORD, CODE, "scrypt.v1.", ...HASHES]],
] as Array<[string, string[]]>) {
  const html = await (await fetch(`${BASE}${path}`, { redirect: "manual" })).text();
  for (const secret of secrets) {
    ok(!html.includes(secret), `${path} HTML free of "${secret.slice(0, 8)}…"`);
  }
  // The password input is controlled, so React server-renders a `value` attribute - but it must be
  // empty. A non-empty value here would mean the page was handed the secret to begin with.
  // Only /connexion has a password field; /prv/deverrouiller's recovery field appears on demand.
  if (path === "/connexion") {
    const passwordInput = html.match(/<input[^>]*type="password"[^>]*>/i)?.[0] ?? "";
    const renderedValue = passwordInput.match(/\svalue="([^"]*)"/i)?.[1];
    ok(passwordInput.length > 0, `${path} has a password input`);
    ok(
      renderedValue === undefined || renderedValue === "",
      `${path} never renders a password value`,
      renderedValue === undefined ? "(no value attribute)" : `${renderedValue.length} characters`
    );
  }
}

// Private data dir must not be web-served.
for (const p of ["/.prv-data/auth-state.json", "/.prv-data/reports.json", "/.prv-data/settings.json"]) {
  const r = await fetch(`${BASE}${p}`, { redirect: "manual" });
  ok(r.status >= 400, `${p} is not web-served`, `status ${r.status}`);
}

// The session endpoint reports stages and booleans only - never a credential or a hash.
const sessionBody = JSON.stringify((await json("/api/prv/session")).body);
for (const secret of [CODE, PASSWORD, CRON, ...HASHES]) {
  ok(!sessionBody.includes(secret), `session response free of "${secret.slice(0, 8)}…"`);
}
ok(!/hash|pepper|password/i.test(sessionBody), "session response names no credential internals", sessionBody);

// A successful login response must not echo the submitted credentials back.
const echoedLogin = JSON.stringify(good.body);
ok(!echoedLogin.includes(PASSWORD), "login response does not echo the password");
ok(!/password|username|email/i.test(echoedLogin), "login response names no submitted field", echoedLogin);

// API error bodies must not leak internals.
const errs = await Promise.all([
  json("/api/prv/reports/2026-13-99", { headers: auth }),
  json("/api/prv/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }),
  json("/api/prv/settings", { method: "POST", headers: { ...auth, origin: "https://evil.example" }, body: "{}" }),
]);
for (const e of errs) {
  const text = JSON.stringify(e.body);
  ok(!text.includes("/tmp/prv-data") && !text.includes("node_modules") && !text.includes("at Object."), "error body has no internals", text.slice(0, 80));
}

// ---------------------------------------------------------------- sign-out
console.log("== 14. signing out really ends the session ==");
const signedOut = await json("/api/prv/logout", { method: "POST", headers: { cookie: bothCookies } });
eq(signedOut.status, 200, "signing out succeeds");
const cleared = signedOut.response.headers.get("set-cookie") ?? "";
ok(/prv_owner=;/.test(cleared) && /prv_session=;/.test(cleared), "signing out clears both cookies", cleared);
// The browser is asked to drop the cookies *and* the tokens stop working, so a copy of either
// cookie that was captured before the sign-out cannot be replayed.
eq((await json("/api/prv/reports", { headers: { cookie: bothCookies } })).status, 401, "the old cookies no longer open the API");
const pageAfterSignOut = await fetch(`${BASE}/prv/rapports`, { redirect: "manual", headers: { cookie: bothCookies } });
ok(
  (pageAfterSignOut.status === 307 || pageAfterSignOut.status === 302) &&
    (pageAfterSignOut.headers.get("location") ?? "").includes("/connexion"),
  "the old cookies no longer open a page",
  `status ${pageAfterSignOut.status}`
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(` - ${f}`);
}
process.exit(fail === 0 ? 0 : 1);
