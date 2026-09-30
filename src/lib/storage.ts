// IndexedDB storage for projects (robust for large project data).
// Falls back to localStorage when IndexedDB is unavailable.

import type { SonicProject } from "./project-schema";
import { validateProject } from "./project-schema";

const DB_NAME = "sonicblueprint";
const STORE = "projects";
const META_KEY = "sb:recent-index";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "meta.id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb-open"));
  });
}

function tx<T>(fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, "readwrite");
        const store = t.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("idb-tx"));
        t.oncomplete = () => db.close();
        t.onerror = () => {
          db.close();
          reject(t.error ?? new Error("idb-tx"));
        };
      })
  );
}

const lsRaw = (id: string): unknown => {
  try {
    const raw = localStorage.getItem(`sb:project:${id}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const lsGet = (id: string): SonicProject | null => {
  const p = lsRaw(id);
  return validateProject(p) ? p : null;
};

/** Merge IndexedDB + localStorage reads into one consistent project list.
 * Pure function so the merge rules are unit-testable:
 * - malformed entries are dropped (never crash, never surface junk)
 * - duplicate IDs resolve to the IndexedDB copy (first list wins)
 * - localStorage-only projects are always preserved
 * - result is sorted newest-first by updatedAt
 */
export function mergeProjectLists(idbItems: unknown[], lsItems: unknown[]): SonicProject[] {
  const byId = new Map<string, SonicProject>();
  for (const item of [...idbItems, ...lsItems]) {
    if (!validateProject(item)) continue;
    if (item.meta.id.length === 0 || byId.has(item.meta.id)) continue;
    byId.set(item.meta.id, item);
  }
  return [...byId.values()].sort((a, b) => (a.meta.updatedAt < b.meta.updatedAt ? 1 : -1));
}

export async function saveProject(p: SonicProject): Promise<void> {
  try {
    await tx((s) => s.put(p as unknown as Record<string, unknown>));
  } catch {
    try {
      localStorage.setItem(`sb:project:${p.meta.id}`, JSON.stringify(p));
    } catch {
      /* storage full — ignore, export still works */
    }
  }
  try {
    const idx = JSON.parse(localStorage.getItem(META_KEY) ?? "[]") as string[];
    const next = [p.meta.id, ...idx.filter((x) => x !== p.meta.id)].slice(0, 60);
    localStorage.setItem(META_KEY, JSON.stringify(next));
    localStorage.setItem("sb:last-edited", p.meta.id);
  } catch {
    /* ignore */
  }
}

export async function loadProject(id: string): Promise<SonicProject | null> {
  try {
    const r = await tx<SonicProject | undefined>((s) => s.get(id));
    if (r && validateProject(r)) return r;
  } catch {
    /* fall through to LS */
  }
  return lsGet(id);
}

export async function listProjects(): Promise<SonicProject[]> {
  // IndexedDB first (preferred on duplicates); a failure simply yields an
  // empty IDB list so localStorage-only projects stay visible regardless.
  let idbItems: unknown[] = [];
  try {
    const all = await tx<unknown[]>((s) => s.getAll() as unknown as IDBRequest<unknown[]>);
    if (Array.isArray(all)) idbItems = all;
  } catch {
    /* fall through with an empty IDB list */
  }
  // localStorage fallback scan (fills gaps, never overwrites IDB copies).
  const lsItems: unknown[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("sb:project:")) {
        lsItems.push(lsRaw(k.slice("sb:project:".length)));
      }
    }
  } catch {
    /* ignore */
  }
  return mergeProjectLists(idbItems, lsItems);
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await tx((s) => s.delete(id));
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(`sb:project:${id}`);
    const idx = JSON.parse(localStorage.getItem(META_KEY) ?? "[]") as string[];
    localStorage.setItem(META_KEY, JSON.stringify(idx.filter((x) => x !== id)));
  } catch {
    /* ignore */
  }
}

export function getLastEditedId(): string | null {
  try {
    return localStorage.getItem("sb:last-edited");
  } catch {
    return null;
  }
}
