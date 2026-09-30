/**
 * Obsidian integration for the "Préparation" area.
 *
 * The preparation notes live in an Obsidian vault, created *before* they are shown here:
 *
 *   1. create the structure in Obsidian
 *      OCS / <module> / Préparation / <summary>
 *   2. fill `OBSIDIAN` below with the real vault name and folder root
 *
 * Nothing is faked: while `OBSIDIAN.vaultName` is null the app renders a "not configured yet"
 * state instead of an invented link, and `buildObsidianNoteHref` returns `null` so no component
 * can render a dead or misleading URL.
 */
export interface ObsidianConfig {
  /** Exact name of the Obsidian vault. `null` until the real vault is connected. */
  vaultName: string | null;
  /** Folder inside the vault that holds the preparation notes, e.g. "OCS". */
  rootFolder: string;
}

export const OBSIDIAN: ObsidianConfig = {
  vaultName: null,
  rootFolder: "OCS",
};

export function isObsidianConfigured(): boolean {
  return typeof OBSIDIAN.vaultName === "string" && OBSIDIAN.vaultName.trim().length > 0;
}

/** Vault-relative path of the preparation note of a module, e.g. `OCS/M201/Préparation`. */
export function buildObsidianNotePath(moduleCode: string): string {
  return [OBSIDIAN.rootFolder, moduleCode, "Préparation"].join("/");
}

/**
 * `obsidian://open?vault=...&file=...` link for a note, or `null` when Obsidian is not
 * configured yet (the UI must then show the setup state, never a made-up URL).
 */
export function buildObsidianNoteHref(moduleCode: string): string | null {
  if (!isObsidianConfigured()) return null;
  const vault = encodeURIComponent(OBSIDIAN.vaultName!.trim());
  const file = encodeURIComponent(buildObsidianNotePath(moduleCode));
  return `obsidian://open?vault=${vault}&file=${file}`;
}

export function buildObsidianVaultHref(): string | null {
  if (!isObsidianConfigured()) return null;
  return `obsidian://open?vault=${encodeURIComponent(OBSIDIAN.vaultName!.trim())}`;
}
