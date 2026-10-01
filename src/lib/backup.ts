// Shared backup file logic: parsing, validation, and import planning.
// Single source of truth for every backup/restore UI (studio export panel,
// projects page, settings) so messages and rules never drift apart.
import {
  SCHEMA_VERSION,
  uid,
  validateProject,
  type SonicProject,
} from "./project-schema";

export type BackupStatus = "not-json" | "empty" | "ok";

export interface ParsedBackup {
  status: BackupStatus;
  /** Valid projects found in the file (never mutated). */
  projects: SonicProject[];
  /** Entries that failed validation (wrong shape or absurd values). */
  invalidCount: number;
  /** Entries made by a newer SonicBlueprint schema than this app reads. */
  newerCount: number;
}

function schemaOf(v: unknown): number | null {
  if (typeof v !== "object" || v === null) return null;
  const s = (v as Record<string, unknown>)["schemaVersion"];
  return typeof s === "number" ? s : null;
}

/** Parse backup file text without throwing. Accepts one project or an array
 * of projects (as produced by "Back up all songs"). Never mutates input. */
export function parseBackupFile(text: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: "not-json", projects: [], invalidCount: 0, newerCount: 0 };
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const projects: SonicProject[] = [];
  let invalidCount = 0;
  let newerCount = 0;
  for (const item of items) {
    const schema = schemaOf(item);
    if (schema !== null && schema > SCHEMA_VERSION) {
      newerCount++;
      continue;
    }
    if (validateProject(item)) {
      projects.push(item);
    } else {
      invalidCount++;
    }
  }
  if (projects.length === 0 && invalidCount === 0 && newerCount === 0) {
    return { status: "empty", projects: [], invalidCount: 0, newerCount: 0 };
  }
  return { status: "ok", projects, invalidCount, newerCount };
}

/** One-line human summary of a parsed backup, e.g. for confirm dialogs. */
export function describeBackup(parsed: ParsedBackup): string {
  if (parsed.status !== "ok" || parsed.projects.length === 0) return "No songs found in that file.";
  if (parsed.projects.length === 1) {
    const p = parsed.projects[0];
    return `1 song: “${p.meta.name}” (${p.config.keyTonic} ${p.config.scale}, ${p.config.bpm} BPM).`;
  }
  return `${parsed.projects.length} songs, including “${parsed.projects[0].meta.name}” and ${parsed.projects.length - 1} more.`;
}

export interface ImportPlan {
  /** Projects to save as-is (ids are free). */
  fresh: SonicProject[];
  /** Projects whose ids already exist locally — saved as copies instead. */
  copies: SonicProject[];
}

/** Never overwrite silently: colliding ids become "(restored)" copies. */
export function planImport(projects: SonicProject[], existingIds: Set<string>): ImportPlan {
  const fresh: SonicProject[] = [];
  const copies: SonicProject[] = [];
  const taken = new Set(existingIds);
  for (const p of projects) {
    if (!taken.has(p.meta.id)) {
      taken.add(p.meta.id);
      fresh.push(p);
    } else {
      const copy: SonicProject = {
        ...p,
        meta: {
          ...p.meta,
          id: uid("proj"),
          name: `${p.meta.name} (restored)`,
          updatedAt: new Date().toISOString(),
        },
      };
      taken.add(copy.meta.id);
      copies.push(copy);
    }
  }
  return { fresh, copies };
}

/** Message for a failed or partial restore. Returns null when all valid. */
export function backupProblem(parsed: ParsedBackup): string | null {
  if (parsed.status === "not-json") {
    return "That file isn't a readable backup — it doesn't contain valid song data. Nothing was changed.";
  }
  if (parsed.status === "empty") {
    return "That backup file is empty — there are no songs to restore. Nothing was changed.";
  }
  if (parsed.projects.length === 0 && parsed.newerCount > 0) {
    return `That backup was made by a newer SonicBlueprint (schema v${SCHEMA_VERSION} is the newest this app reads). Update the app, then try again. Nothing was changed.`;
  }
  if (parsed.projects.length === 0) {
    return "That file doesn't look like a SonicBlueprint backup. Nothing was changed.";
  }
  return null;
}
