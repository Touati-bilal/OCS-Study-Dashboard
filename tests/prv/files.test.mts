/**
 * Black-box tests for the study-file APIs, against a running production server.
 *
 * These four routes (`/api/uploads`, `/api/uploads/file/...`, `/api/module-files`,
 * `/api/module-files/file/...`) were the critical findings of the audit: no authentication at all, a
 * client-supplied `moduleId` joined into a filesystem path, and a download route that used a
 * prefix-only containment test and served whatever it found as `text/html`. So the tests here cover
 * three things: an anonymous caller can do *nothing*; the signed-in owner can do everything; and
 * neither can reach outside the storage root, plant active content, or make the app serve an upload
 * as anything executable.
 *
 * Two prefix-sibling directories are created on purpose. The old containment test was
 * `resolvedTarget.startsWith(resolvedRoot)`, and "uploads-file-probe" really does start with
 * "uploads" - as does "module-files-backup" for the module-files root. Real files in real
 * directories, so a regression that brought the prefix check back would serve them.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3199";
const USERNAME = process.env.PRV_TEST_USERNAME ?? "";
const EMAIL = process.env.PRV_TEST_EMAIL ?? "";
const PASSWORD = process.env.PRV_TEST_PASSWORD ?? "";
if (!USERNAME || !EMAIL || !PASSWORD) {
  console.error("fixtures missing: run the suite through `npm run test:prv`.");
  process.exit(1);
}

const PROJECT = process.cwd();
const MODULE = "M201";
const SENTINEL = "sibling-secret-must-never-be-served";
/** A prefix-sibling of the `uploads/` root, and one of the `uploads/module-files` root. */
const UPLOADS_SIBLING = path.join(PROJECT, "uploads-file-probe");
const FILES_SIBLING = path.join(PROJECT, "uploads", "module-files-backup");
/** Where a traversal would land if containment ever broke. Unmistakable, and easy to check. */
const OUTSIDE = path.join(PROJECT, "..", "tp-file-probe.txt");
const PUBLIC_PROBE = path.join(PROJECT, "public", "tp-file-probe.txt");
/** A directory that is a *valid* module id, so the upload is allowed - but must stay inside the root. */
const CONTAINED_DIR = path.join(PROJECT, "uploads", "uploads-file-probe", "tp");

for (const dir of [UPLOADS_SIBLING, FILES_SIBLING]) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "sib.txt"), SENTINEL, { mode: 0o600 });
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

async function json(path_: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path_}`, { redirect: "manual", ...init });
  const text = await response.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body, response };
}

async function login() {
  const res = await json("/api/prv/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, email: EMAIL, password: PASSWORD }),
  });
  const setCookie = res.response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/prv_owner=([^;]*)/);
  return match ? `prv_owner=${match[1]}` : "";
}

function multipart(fields: Record<string, string>, file: { name: string; type: string; body: string | Buffer }) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append("file", new Blob([file.body], { type: file.type }), file.name);
  return form;
}

const created: Array<() => Promise<unknown>> = [];

// ---------------------------------------------------------------- 1. anonymous callers
console.log("\n== 1. no session, no access: every file API refuses an anonymous caller ==");

const ANON_CASES: Array<[string, string, RequestInit]> = [
  ["GET", `/api/uploads?moduleId=${MODULE}`, {}],
  ["GET", `/api/module-files?moduleId=${MODULE}`, {}],
  [
    "POST",
    "/api/uploads",
    { method: "POST", body: multipart({ moduleId: MODULE, category: "tp" }, { name: "a.pdf", type: "application/pdf", body: "x" }) },
  ],
  ["POST", "/api/module-files", { method: "POST", body: multipart({ moduleId: MODULE }, { name: "a.pdf", type: "application/pdf", body: "x" }) }],
  ["DELETE", "/api/uploads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moduleId: MODULE, category: "tp", id: "x" }) }],
  ["DELETE", "/api/module-files", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moduleId: MODULE, id: "x" }) }],
  ["GET", `/api/uploads/file/${MODULE}/tp/none.pdf`, {}],
  ["GET", `/api/module-files/file/${MODULE}/none.pdf`, {}],
];
for (const [method, path_, init] of ANON_CASES) {
  const { status } = await json(path_, init);
  ok(status === 401, `${method} ${path_} without a session => 401`, `got ${status}`);
}
ok(!existsSync(OUTSIDE), "an anonymous upload wrote nothing outside the project");
ok(!existsSync(PUBLIC_PROBE), "an anonymous upload wrote nothing into public/");
ok(
  readdirSync(UPLOADS_SIBLING).length === 1 && readdirSync(FILES_SIBLING).length === 1,
  "an anonymous upload added nothing to either prefix-sibling directory"
);

// ---------------------------------------------------------------- 2. the owner works
console.log("\n== 2. the signed-in owner keeps the full feature ==");

const owner = await login();
ok(owner !== "", "the owner signs in");
const AUTH = { cookie: owner };
const AUTH_JSON = { "Content-Type": "application/json", cookie: owner };

const uploaded = await json("/api/uploads", {
  method: "POST",
  headers: AUTH,
  body: multipart({ moduleId: MODULE, category: "tp" }, { name: "notes de cours.pdf", type: "application/pdf", body: "contenu du tp" }),
});
eq(uploaded.status, 200, "the owner uploads a TP file");
const storedId: string = uploaded.body?.id ?? "";
ok(typeof storedId === "string" && storedId.length > 0, "the upload is identified by a server-generated id", JSON.stringify(uploaded.body));
ok(!/notes/.test(storedId), "the stored id is not derived from the client's file name", storedId);
created.push(async () => json("/api/uploads", { method: "DELETE", headers: AUTH_JSON, body: JSON.stringify({ moduleId: MODULE, category: "tp", id: storedId }) }));

const listed = await json(`/api/uploads?moduleId=${MODULE}`, { headers: AUTH });
eq(listed.status, 200, "the owner lists TP files");
ok((listed.body?.tp ?? []).some((f: any) => f.id === storedId), "the uploaded file is listed under its id");
eq((listed.body?.tp ?? []).find((f: any) => f.id === storedId)?.name, "notes de cours.pdf", "the original name is preserved for display");

const moduleUploaded = await json("/api/module-files", {
  method: "POST",
  headers: AUTH,
  body: multipart({ moduleId: MODULE, title: "Fichiers / Updates" }, { name: "sujet.pdf", type: "application/pdf", body: "sujet de l'examen" }),
});
eq(moduleUploaded.status, 200, "the owner uploads a document");
const moduleFileId: string = moduleUploaded.body?.file?.id ?? "";
ok(typeof moduleFileId === "string" && moduleFileId.length > 0, "the document has a server id");
created.push(async () => json("/api/module-files", { method: "DELETE", headers: AUTH_JSON, body: JSON.stringify({ moduleId: MODULE, id: moduleFileId }) }));
const moduleListed = await json(`/api/module-files?moduleId=${MODULE}`, { headers: AUTH });
ok((moduleListed.body?.files ?? []).some((f: any) => f.id === moduleFileId), "the document is listed");

// ---------------------------------------------------------------- 3. downloads are inert
console.log("\n== 3. a download is an attachment, never active content on our origin ==");

const download = await fetch(`${BASE}/api/uploads/file/${MODULE}/tp/${encodeURIComponent(storedId)}.pdf`, { headers: AUTH });
eq(download.status, 200, "the owner downloads the file");
eq(download.headers.get("content-type"), "application/octet-stream", "served as an opaque download");
eq(download.headers.get("x-content-type-options"), "nosniff", "nosniff is set");
const disposition = download.headers.get("content-disposition") ?? "";
ok(disposition.startsWith("attachment;"), "served as an attachment", disposition);
ok(/filename\*=UTF-8''notes%20de%20cours\.pdf/.test(disposition), "the download keeps the original name", disposition);
eq(await download.text(), "contenu du tp", "the right bytes come back");

// An HTML, SVG or JS file must never reach disk, so it can never be served as active content.
for (const [route, name, type, body] of [
  ["/api/uploads", "poc.html", "text/html", "<script>alert(1)</script>"],
  ["/api/uploads", "poc.js", "text/javascript", "alert(1)"],
  ["/api/uploads", "poc.htm", "text/html", "<script>alert(1)</script>"],
  ["/api/module-files", "poc.svg", "image/svg+xml", "<svg onload=alert(1)>"],
  ["/api/module-files", "poc.xhtml", "application/xhtml+xml", "<html/>"],
  ["/api/module-files", "poc.php", "application/x-httpd-php", "<?php ?>"],
] as Array<[string, string, string, string]>) {
  const fields = route === "/api/uploads" ? { moduleId: MODULE, category: "tp" } : { moduleId: MODULE, title: "x" };
  const res = await json(route, { method: "POST", headers: AUTH, body: multipart(fields, { name, type, body }) });
  ok(res.status >= 400, `${name} is refused on ${route}`, `got ${res.status}`);
}

// ---------------------------------------------------------------- 4. nothing escapes the root
console.log("\n== 4. no path escapes the storage root, in any of its forms ==");

// Refused outright: the identifier itself is not an identifier.
const BAD_IDS = ["../../..", "..", ".", "", "M201/../../..", "M201 ", "/etc", "M201\u0000", "a".repeat(64), "M-201!", "uploads"];
for (const moduleId of BAD_IDS) {
  const res = await json("/api/uploads", {
    method: "POST",
    headers: AUTH,
    body: multipart({ moduleId, category: "tp" }, { name: "tp-file-probe.txt", type: "text/plain", body: "owned" }),
  });
  ok(res.status >= 400, `moduleId ${JSON.stringify(moduleId)} is refused`, `got ${res.status}`);
  const res2 = await json("/api/module-files", {
    method: "POST",
    headers: AUTH,
    body: multipart({ moduleId, title: "x" }, { name: "tp-file-probe.txt", type: "text/plain", body: "owned" }),
  });
  ok(res2.status >= 400, `moduleId ${JSON.stringify(moduleId)} is refused on module-files`, `got ${res2.status}`);
}
for (const category of ["../../..", "tp/../..", "tp/x/../../..", "public", "TPs", "", "tp/"]) {
  const res = await json("/api/uploads", {
    method: "POST",
    headers: AUTH,
    body: multipart({ moduleId: MODULE, category }, { name: "tp-file-probe.txt", type: "text/plain", body: "owned" }),
  });
  ok(res.status >= 400, `category ${JSON.stringify(category)} is refused`, `got ${res.status}`);
}

// A *valid* identifier that happens to look like the prefix-sibling's name is allowed to be stored -
// that is a directory inside the root, not an escape - and the file must land there, under a generated
// name, with no traversal in it.
const contained = await json("/api/uploads", {
  method: "POST",
  headers: AUTH,
  body: multipart({ moduleId: "uploads-file-probe", category: "tp" }, { name: "sib.txt", type: "text/plain", body: "contained" }),
});
eq(contained.status, 200, "a valid module id shaped like the sibling is accepted");
const containedId: string = contained.body?.id ?? "";
ok(/^[0-9a-f-]{36}\.txt$/.test(containedId), "and the stored name is generated, not the client's", containedId);
ok(existsSync(path.join(CONTAINED_DIR, containedId)), "the file is written inside the storage root");
ok(!existsSync(path.join(UPLOADS_SIBLING, containedId)), "and not into the prefix-sibling directory");
created.push(async () => json("/api/uploads", { method: "DELETE", headers: AUTH_JSON, body: JSON.stringify({ moduleId: "uploads-file-probe", category: "tp", id: containedId }) }));

// A traversal in the *file name* is display text, never a path.
const named = await json("/api/module-files", {
  method: "POST",
  headers: AUTH,
  body: multipart({ moduleId: MODULE, title: "x" }, { name: "../../../../tp-file-probe.txt", type: "text/plain", body: "owned" }),
});
eq(named.status, 200, "a traversal in the file name is sanitised rather than followed");
const namedId: string = named.body?.file?.id ?? "";
ok(/^[0-9a-f-]{36}\.txt$/.test(namedId), "and stored under a generated name", namedId);
ok(!existsSync(OUTSIDE), "the traversal name never reached the parent directory");
ok(!existsSync(PUBLIC_PROBE), "the traversal name never reached public/");
created.push(async () => json("/api/module-files", { method: "DELETE", headers: AUTH_JSON, body: JSON.stringify({ moduleId: MODULE, id: namedId }) }));

ok(!existsSync(OUTSIDE), "no write escaped to the parent directory");
ok(!existsSync(PUBLIC_PROBE), "no write escaped into public/");
ok(
  readdirSync(UPLOADS_SIBLING).length === 1 && readdirSync(FILES_SIBLING).length === 1,
  "nothing was added to either prefix-sibling directory"
);

// Reads: the prefix bug and the traversal reads, over every encoding that matters.
const READS = [
  `/api/uploads/file/${MODULE}/tp/${encodeURIComponent("../../../../etc/passwd")}`,
  `/api/uploads/file/${encodeURIComponent("../uploads-file-probe")}/tp/${encodeURIComponent("../../../../etc/passwd")}`,
  `/api/uploads/file/${encodeURIComponent("..%2f..%2fuploads-file-probe")}/tp/sib.txt`,
  `/api/uploads/file/${MODULE}/tp/${encodeURIComponent("..%2f..%2f..%2fuploads-file-probe%2fsib.txt")}`,
  `/api/uploads/file/${MODULE}/tp/${encodeURIComponent("....//....//etc//passwd")}`,
  `/api/uploads/file/uploads-file-probe/tp/sib.txt`,
  `/api/uploads/file/${encodeURIComponent("../uploads-file-probe")}/tp/sib.txt`,
  `/api/uploads/file/${MODULE}/tp/${encodeURIComponent("../../uploads-file-probe/sib.txt")}`,
  `/api/module-files/file/${MODULE}/../../uploads-file-probe/sib.txt`,
  `/api/module-files/file/${MODULE}/${encodeURIComponent("../../../../etc/passwd")}`,
  `/api/module-files/file/${MODULE}/${encodeURIComponent("..%2f..%2f..%2fetc%2fpasswd")}`,
  `/api/module-files/file/module-files-backup/sib.txt`,
  `/api/module-files/file/${MODULE}/${encodeURIComponent("..%2fmodule-files-backup%2fsib.txt")}`,
  "/api/module-files/file/../../../etc/passwd",
];
for (const path_ of READS) {
  const response = await fetch(`${BASE}${path_}`, { headers: AUTH, redirect: "manual" });
  const text = await response.text();
  ok(response.status >= 400, `GET ${path_} => 4xx`, `got ${response.status}`);
  ok(!text.includes(SENTINEL), `GET ${path_} does not serve the sibling file`);
  ok(!text.includes("root:"), `GET ${path_} leaks no /etc/passwd`, text.slice(0, 60));
}

// ---------------------------------------------------------------- 5. size
console.log("\n== 5. the size cap is enforced before anything is written ==");
const big = await json("/api/uploads", {
  method: "POST",
  headers: AUTH,
  body: multipart({ moduleId: MODULE, category: "tp" }, { name: "big.pdf", type: "application/pdf", body: Buffer.alloc(26 * 1024 * 1024, 0x41) }),
});
ok(big.status >= 400, "a 26 MB upload is refused", `got ${big.status}`);

// ---------------------------------------------------------------- 6. the owner's own delete
console.log("\n== 6. deleting works by id, and only for an id that exists ==");

eq((await json("/api/uploads", { method: "DELETE", headers: AUTH_JSON, body: JSON.stringify({ moduleId: MODULE, category: "tp", id: storedId }) })).body?.ok, true, "the owner deletes the TP file");
eq((await json("/api/uploads", { method: "DELETE", headers: AUTH_JSON, body: JSON.stringify({ moduleId: MODULE, category: "tp", id: storedId }) })).body?.ok, false, "deleting it twice reports nothing left to delete");
eq((await json("/api/module-files", { method: "DELETE", headers: AUTH_JSON, body: JSON.stringify({ moduleId: MODULE, id: moduleFileId }) })).body?.ok, true, "the owner deletes the document");

for (const [route, body] of [
  ["/api/uploads", { moduleId: MODULE, category: "tp", id: "../../../etc/passwd" }],
  ["/api/uploads", { moduleId: MODULE, category: "../../..", id: storedId }],
  ["/api/module-files", { moduleId: MODULE, id: "../../../etc/passwd" }],
  ["/api/module-files", { moduleId: "../..", id: moduleFileId }],
] as Array<[string, Record<string, string>]>) {
  const res = await json(route, { method: "DELETE", headers: AUTH_JSON, body: JSON.stringify(body) });
  ok(res.status >= 400 || res.body?.ok === false, `DELETE ${route} with ${JSON.stringify(body)} is refused`, JSON.stringify(res.body));
}

ok(!(await json(`/api/uploads?moduleId=${MODULE}`, { headers: AUTH })).body?.tp?.some((f: any) => f.id === storedId), "the deleted file is gone from the list");
ok(!existsSync(path.join(PROJECT, "uploads", MODULE, "tp", `${storedId}.pdf`)), "and gone from disk");

// ---------------------------------------------------------------- 7. cleanup
console.log("\n== 7. the suite leaves the storage exactly as it found it ==");
for (const done of created) await done();
rmSync(UPLOADS_SIBLING, { recursive: true, force: true });
rmSync(FILES_SIBLING, { recursive: true, force: true });
rmSync(path.join(PROJECT, "uploads", "uploads-file-probe"), { recursive: true, force: true });

ok(!existsSync(UPLOADS_SIBLING) && !existsSync(FILES_SIBLING), "the prefix-sibling fixtures are removed");
ok(!existsSync(path.join(PROJECT, "uploads", "uploads-file-probe")), "the contained module directory is removed");

// meta.json files that already existed keep their content; new ones would be empty, which is fine.
for (const dir of [path.join(PROJECT, "uploads", MODULE, "tp"), path.join(PROJECT, "uploads", "module-files", MODULE)]) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (name === "meta.json") continue;
    ok(false, `leftover file in ${dir}: ${name}`);
  }
  if (existsSync(dir)) {
    const meta = JSON.parse(readFileSync(path.join(dir, "meta.json"), "utf-8")) as unknown[];
    eq(meta.length, 0, `${path.relative(PROJECT, dir)} is empty again`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(` - ${f}`);
}
process.exit(fail === 0 ? 0 : 1);
