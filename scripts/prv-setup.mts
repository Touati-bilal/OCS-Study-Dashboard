/**
 * PRV setup: writes the owner account and the 4-digit code to `.env.local` as hashes.
 *
 * Run with `npm run prv:setup`. It prompts for everything, hides the secret inputs, and writes only:
 *
 *   PRV_OWNER_USERNAME         the display name, not a secret
 *   PRV_OWNER_EMAIL            an identifier, not a secret
 *   PRV_OWNER_PASSWORD_HASH    scrypt$v1$ hash, peppered
 *   PRV_ACCESS_CODE_HASH       scrypt$v1$ hash, peppered
 *   PRV_RECOVERY_HASH          scrypt$v1$ hash, peppered, only if you set a private phrase
 *   PRV_SECRET_PEPPER          random, generated here, never shown in full
 *   PRV_SESSION_SECRET         random, generated here
 *
 * The plaintext password and code exist only inside this process, in the terminal you type them
 * into. They are never written to disk, never printed, never sent anywhere, and never end up in Git:
 * `.env.local` is already git-ignored. The pepper is what makes the hashes uncrackable offline,
 * which matters most for the 4-digit code - there are only 10 000 of them, so an unpeppered hash
 * would fall in seconds.
 *
 * Re-running it overwrites the previous values, so this is also how you change the password or the
 * code. Remember to restart the server afterwards: environment variables are read at boot.
 *
 * `npm run prv:setup -- --auto` is the unattended variant used to initialise a machine: it generates
 * a strong random password, a random 4-digit code and a private recovery phrase, writes the same
 * hashes, and prints the plaintext exactly once so it can be saved. It is *idempotent*: if the
 * account is already configured it changes nothing and creates no duplicate, so running it twice is
 * safe. `--force` regenerates instead, which rotates the password and the code.
 */
import { randomInt, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/** Mirrors the scrypt parameters and the hash format in lib/prv/config.server.ts. */
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LEN = 32;

async function scrypt(input: string, salt: Buffer): Promise<Buffer> {
  const { scryptSync } = await import("node:crypto");
  return scryptSync(input.normalize("NFKC"), salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: 64 * 1024 * 1024,
  });
}

/**
 * Mirrors `hashPepperedSecret` in lib/prv/config.server.ts - including the dot separator.
 *
 * Dots, not dollars: the environment-file loader expands `$VAR` in values (even inside quotes), so a
 * `scrypt$v1$...` value is truncated to `scrypt` before the server reads it. `verifyWrittenFile`
 * below proves the file we just wrote still verifies, so this can never regress silently.
 */
async function hashPeppered(secret: string, pepper: string): Promise<string> {
  const { createHmac, randomBytes: rb } = await import("node:crypto");
  const salt = rb(16);
  const input = createHmac("sha256", pepper).update(secret.normalize("NFKC")).digest("hex");
  const hash = await scrypt(input, salt);
  return `scrypt.v1.${salt.toString("hex")}.${hash.toString("hex")}`;
}

/** Refuses to write a value the environment loader would rewrite. */
function assertEnvSafe(key: string, value: string) {
  if (value.includes("$") || value.includes("\n")) {
    throw new Error(`${key} contains a character the .env loader would expand or split. Refusing to write it.`);
  }
}

/**
 * Loads the file exactly the way the app does and re-verifies every credential against it.
 *
 * This is the check that would have caught the `\$` separator bug: the file is parsed by the real
 * loader, not by this script's own parser, so a mismatch between the two cannot pass unnoticed.
 */
async function verifyWrittenFile(target: string, expect: { password: string; code: string; recovery: string }) {
  const { createHmac, scryptSync, timingSafeEqual } = await import("node:crypto");
  // `@next/env` is a CommonJS module, so the loader is a named export rather than a default.
  const { loadEnvConfig } = (await import("@next/env")) as unknown as {
    loadEnvConfig: (dir: string, dev?: boolean) => void;
  };
  const previous = { ...process.env };
  try {
    loadEnvConfig(path.dirname(target), true);
    const pepper = process.env.PRV_SECRET_PEPPER ?? "";
    const passwordHash = process.env.PRV_OWNER_PASSWORD_HASH ?? "";
    const codeHash = process.env.PRV_ACCESS_CODE_HASH ?? "";
    const recoveryHash = process.env.PRV_RECOVERY_HASH ?? "";

    const verify = (candidate: string, stored: string): boolean => {
      const parts = stored.split(/[.$]/);
      if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
      const salt = Buffer.from(parts[2], "hex");
      const expected = Buffer.from(parts[3], "hex");
      if (salt.length === 0 || expected.length === 0) return false;
      const input = createHmac("sha256", pepper).update(candidate.normalize("NFKC")).digest("hex");
      const actual = scryptSync(input, salt, expected.length, {
        N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p, maxmem: 64 * 1024 * 1024,
      });
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    };

    const checks: Array<[string, boolean]> = [
      ["mot de passe", verify(expect.password, passwordHash)],
      ["code PRV", verify(expect.code, codeHash)],
      ["phrase de récupération", verify(expect.recovery, recoveryHash)],
    ];
    const failed = checks.filter(([, ok]) => !ok).map(([label]) => label);
    if (failed.length > 0) {
      throw new Error(`le fichier écrit ne se relit pas correctement pour : ${failed.join(", ")}`);
    }
    console.log("Vérification après écriture : les trois secrets se relisent et se vérifient depuis .env.local.");
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }
}

/** Reads a line without echoing it, so the password and the code never appear on screen. */
async function askHidden(question: string): Promise<string> {
  const wasRaw = stdin.isRaw;
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  stdout.write(question);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise<string>((resolve) => {
    let value = "";
    const onData = (char: string) => {
      if (char === "\r" || char === "\n" || char === "\u0004") {
        process.stdin.off("data", onData);
        if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw ?? false);
        process.stdin.pause();
        stdout.write("\n");
        resolve(value);
        return;
      }
      // Handle the three-byte backspace sequence.
      if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
        return;
      }
      // Ctrl-C aborts without writing anything.
      if (char === "\u0003") {
        process.stdin.off("data", onData);
        stdout.write("\n");
        process.exit(130);
      }
      if (char >= " ") value += char;
    };
    process.stdin.on("data", onData);
  });
}

async function ask(rl: Interface, question: string, fallback?: string): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback || "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Replaces our own keys, keeps anything else already in the file, and never duplicates a key. */
function mergeEnv(existing: string, values: Record<string, string>): string {
  const keys = Object.keys(values);
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];
  const out: string[] = [];
  const written = new Set<string>();

  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    const key = match?.[1];
    if (key && keys.includes(key)) {
      if (written.has(key)) continue; // drop an accidental duplicate
      out.push(`${key}=${values[key]}`);
      written.add(key);
      continue;
    }
    out.push(line);
  }

  const missing = keys.filter((key) => !written.has(key));
  if (missing.length > 0) {
    // Keep the appended block readable: trim trailing blanks, then add a header.
    while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
    out.push("", "# PRV — hashes only, never a plaintext secret. Written by `npm run prv:setup`.");
    for (const key of missing) out.push(`${key}=${values[key]}`);
  }
  return `${out.join("\n").replace(/\n+$/, "")}\n`;
}

/**
 * A strong random password: 24 characters over an alphabet with no quotes, backslash or shell
 * metacharacters, so it can be typed and pasted anywhere without escaping. `randomInt` is used
 * rather than a modulo so every character is equally likely.
 */
function generatePassword(length = 24): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^*-_=+";
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}

/** A cryptographically uniform 4-digit code. `randomInt(0, 10000)` has no modulo bias. */
function generateCode(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

function generateRecoveryPhrase(): string {
  const words = [
    "atelier", "boussole", "cerisier", "dunes", "escalier", "falaise", "girouette", "horizon",
    "iris", "jardin", "lueur", "marmotte", "nuage", "ocelle", "panache", "quai",
    "ruche", "sillon", "tuile", "verveine",
  ];
  const pick = () => words[randomInt(0, words.length)];
  return `${pick()}-${pick()}-${pick()}-${pick()}`;
}

/** Reads a KEY=value out of an env file, ignoring comments and surrounding quotes. */
export function readEnvValue(source: string, key: string): string {
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`));
    if (!match) continue;
    return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const DEFAULT_USERNAME = "Bilal";
const DEFAULT_EMAIL = "bilal.touati.it@gmail.com";

/**
 * Unattended initialisation. Idempotent: an already-configured account is left untouched, so this
 * can run on every machine setup without ever creating a second account or rotating live secrets.
 */
async function runAuto(argv: string[]) {
  const force = argv.includes("--force");
  const argOf = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const username = argOf("--username") || DEFAULT_USERNAME;
  const email = (argOf("--email") || DEFAULT_EMAIL).toLowerCase();

  const target = path.join(process.cwd(), ".env.local");
  const existing = existsSync(target) ? await readFile(target, "utf8") : "";
  const current = (key: string) => readEnvValue(existing, key);

  const configured =
    current("PRV_SECRET_PEPPER").length >= 32 &&
    current("PRV_OWNER_USERNAME") !== "" &&
    current("PRV_OWNER_EMAIL") !== "" &&
    /^scrypt[.$]v1[.$][0-9a-f]{32}[.$]/.test(current("PRV_OWNER_PASSWORD_HASH")) &&
    /^scrypt[.$]v1[.$][0-9a-f]{32}[.$]/.test(current("PRV_ACCESS_CODE_HASH"));

  if (configured && !force) {
    // Idempotent: nothing is written, so the live credentials keep working.
    console.log("PRV est déjà configuré dans .env.local : compte existant conservé, aucune duplication.");
    console.log(`  propriétaire : ${current("PRV_OWNER_USERNAME")} <${current("PRV_OWNER_EMAIL")}>`);
    console.log("  aucun nouveau mot de passe ni code n'a été généré.");
    console.log("  (utilisez --force pour les régénérer)");
    return;
  }

  const password = generatePassword();
  const code = generateCode();
  const recovery = generateRecoveryPhrase();
  const pepper = randomBytes(32).toString("base64url");
  const sessionSecret = randomBytes(32).toString("base64url");

  const values: Record<string, string> = {
    PRV_SECRET_PEPPER: pepper,
    PRV_SESSION_SECRET: sessionSecret,
    PRV_OWNER_USERNAME: username,
    PRV_OWNER_EMAIL: email,
    PRV_OWNER_PASSWORD_HASH: await hashPeppered(password, pepper),
    PRV_ACCESS_CODE_HASH: await hashPeppered(code, pepper),
    PRV_RECOVERY_HASH: await hashPeppered(recovery, pepper),
  };

  for (const [key, value] of Object.entries(values)) assertEnvSafe(key, value);
  await writeFile(target, mergeEnv(existing, values), { mode: 0o600 });
  await chmod(target, 0o600).catch(() => undefined);
  await verifyWrittenFile(target, { password, code, recovery });

  console.log(`Compte PRV ${force ? "régénéré" : "créé"} dans .env.local (permissions 600, ignoré par Git).`);
  console.log("Identifiants stockés sous forme de hashes scrypt pepperés uniquement.\n");
  console.log("=== IDENTIFIANTS PRV — affichés une seule fois ===");
  console.log(`PRV Username: ${username}`);
  console.log(`PRV Email: ${email}`);
  console.log(`PRV Password: ${password}`);
  console.log(`PRV Code: ${code}`);
  console.log(`PRV Recovery: ${recovery}`);
  console.log("=== fin ===");
  console.log("\nRelancez le serveur pour que les variables soient lues : npm run dev");
  console.log("Puis ouvrez http://localhost:3000/prv/connexion");
}

async function main() {
  console.log("Le mot de passe et le code ne sont jamais écrits en clair : seuls des hashes scrypt le sont.\n");

  // Unattended: no terminal to prompt on (CI, `npm run prv:setup -- --auto`, first machine setup).
  if (!process.stdin.isTTY || process.argv.includes("--auto")) {
    await runAuto(process.argv.slice(2));
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });

  const username = await ask(rl, "Identifiant du propriétaire", DEFAULT_USERNAME);
  if (!username) {
    console.error("Identifiant obligatoire.");
    rl.close();
    process.exit(1);
  }

  let email = await ask(rl, "Adresse e-mail du propriétaire", DEFAULT_EMAIL);
  while (email && !isValidEmail(email)) {
    console.log("Cette adresse ne semble pas valide.");
    email = await ask(rl, "Adresse e-mail du propriétaire");
  }
  if (!email) {
    console.error("Adresse e-mail obligatoire.");
    rl.close();
    process.exit(1);
  }

  const password = await askHidden("Mot de passe                 ");
  if (password.length < 8) {
    console.error("Mot de passe trop court : 8 caractères minimum.");
    rl.close();
    process.exit(1);
  }
  const passwordAgain = await askHidden("Confirmer le mot de passe     ");
  if (password !== passwordAgain) {
    console.error("Les deux mots de passe ne correspondent pas.");
    rl.close();
    process.exit(1);
  }

  let code = await askHidden("Code PRV à 4 chiffres         ");
  while (!/^\d{4}$/.test(code)) {
    console.log("Le code doit contenir exactement 4 chiffres.");
    code = await askHidden("Code PRV à 4 chiffres         ");
  }

  // The recovery phrase is your own secret, and it is optional only in the sense that you may skip
  // it: there is no built-in one any more. It used to fall back to a phrase written in the source,
  // which made recovery a public shortcut past the code lockout. Skipping it now means recovery is
  // simply unavailable, and the password remains the way back in.
  console.log("\nPhrase de récupération (facultative, 8 caractères minimum) :");
  console.log("C'est le seul moyen de lever un blocage du code. Elle est hachée comme les deux autres");
  console.log("secrets. Entrée vide = pas de phrase, donc pas de récupération.");
  let recovery = await askHidden("Phrase de récupération ");
  let recoveryAgain = recovery ? await askHidden("Confirmer la phrase      ") : "";
  while (recovery && recovery !== recoveryAgain) {
    console.log("Les deux phrases ne correspondent pas.");
    recovery = await askHidden("Phrase de récupération ");
    recoveryAgain = recovery ? await askHidden("Confirmer la phrase      ") : "";
  }
  if (recovery.length > 0 && recovery.length < 8) {
    console.log("Phrase trop courte : 8 caractères minimum. Aucune phrase ne sera définie.");
    recovery = "";
  }

  rl.close();

  // The pepper is generated here and never displayed: it is the value that makes both hashes
  // uncrackable offline, so showing it would defeat the point.
  const pepper = randomBytes(32).toString("base64url");
  const sessionSecret = randomBytes(32).toString("base64url");

  const values: Record<string, string> = {
    PRV_SECRET_PEPPER: pepper,
    PRV_SESSION_SECRET: sessionSecret,
    PRV_OWNER_USERNAME: username,
    PRV_OWNER_EMAIL: email.toLowerCase(),
    PRV_OWNER_PASSWORD_HASH: await hashPeppered(password, pepper),
    PRV_ACCESS_CODE_HASH: await hashPeppered(code, pepper),
    ...(recovery ? { PRV_RECOVERY_HASH: await hashPeppered(recovery, pepper) } : {}),
  };

  const target = path.join(process.cwd(), ".env.local");
  const existing = existsSync(target) ? await readFile(target, "utf8") : "";
  await writeFile(target, mergeEnv(existing, values), { mode: 0o600 });
  await chmod(target, 0o600).catch(() => undefined);

  console.log("\nÉcrit dans .env.local (permissions 600, déjà ignoré par Git) :");
  for (const key of Object.keys(values)) {
    const shown = key.includes("HASH") || key.includes("SECRET") || key.includes("PEPPER")
      ? `${values[key].slice(0, 14)}… (${values[key].length} caractères)`
      : values[key];
    console.log(`  ${key.padEnd(24)} ${shown}`);
  }
  if (recovery) {
    console.log("\nPhrase de récupération : hachée, elle n'est écrite nulle part en clair.");
  } else {
    console.log("\nAucune phrase de récupération : la récupération sera refusée.");
    console.log("Si le code vous bloque, votre mot de passe reste le moyen de revenir.");
    console.log("Relancez `npm run prv:setup` pour définir une phrase privée.");
  }
  console.log("\nRelancez le serveur pour que les variables soient lues :");
  console.log("  npm run dev");
  console.log("\nEnsuite : http://localhost:3000/prv/connexion");
}

main().catch((error) => {
  console.error("Échec de la configuration :", error instanceof Error ? error.message : error);
  process.exit(1);
});
