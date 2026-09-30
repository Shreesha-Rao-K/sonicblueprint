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

const lsGet = (id: string): SonicProject | null => {
  try {
    const raw = localStorage.getItem(`sb:project:${id}`);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return validateProject(p) ? p : null;
  } catch {
    return null;
  }
};

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
  try {
    const all = await tx<SonicProject[]>((s) => s.getAll() as unknown as IDBRequest<SonicProject[]>);
    if (Array.isArray(all) && all.length > 0)
      return all.filter(validateProject).sort((a, b) => (a.meta.updatedAt < b.meta.updatedAt ? 1 : -1));
  } catch {
    /* fall through */
  }
  // localStorage fallback scan
  const out: SonicProject[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("sb:project:")) {
        const p = lsGet(k.replace("sb:project:", ""));
        if (p) out.push(p);
      }
    }
  } catch {
    /* ignore */
  }
  return out.sort((a, b) => (a.meta.updatedAt < b.meta.updatedAt ? 1 : -1));
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
