// Client-side URL-based portable project sharing.
// Compresses project state using gzip + base64url encoding.
// Decodes and validates with strict size bounds and schema validation.

import {
  type SonicProject,
  normalizeProject,
  validateProject,
  uid,
} from "./project-schema";
import {
  sanitizeProjectForShare,
  sanitizeShareUrl,
  deepSanitizeJson,
} from "./security/sanitize";

const MAX_PAYLOAD_CHARS = 32768; // Max 32KB URL payload
const MAX_DECOMPRESSED_CHARS = 250000; // Max 250KB JSON text

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToUint8Array(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Prepares a project for URL sharing: strips heavy historical snapshot stacks and scrubs credentials. */
export function sanitizeProjectForSharing(project: SonicProject): Omit<SonicProject, "versions"> {
  return sanitizeProjectForShare(project);
}

/** Compresses a project into a URL-safe base64url string. */
export async function compressProject(project: SonicProject): Promise<string> {
  const clean = sanitizeProjectForShare(project);
  const jsonStr = JSON.stringify(clean);
  const stream = new Blob([jsonStr]).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
  const response = new Response(compressedStream);
  const buffer = await response.arrayBuffer();
  return uint8ArrayToBase64Url(new Uint8Array(buffer));
}

/** Decompresses a base64url string and validates project data safely. */
export async function decompressProject(payload: string): Promise<SonicProject> {
  if (!payload || typeof payload !== "string") {
    throw new Error("Missing share payload");
  }
  if (payload.length > MAX_PAYLOAD_CHARS) {
    throw new Error(`Share payload exceeds maximum safe length (${payload.length} > ${MAX_PAYLOAD_CHARS})`);
  }

  let bytes: Uint8Array;
  try {
    bytes = base64UrlToUint8Array(payload);
  } catch {
    throw new Error("Invalid base64url encoding in share payload");
  }

  let text: string;
  try {
    const stream = new Blob([bytes as BlobPart]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
    const response = new Response(decompressedStream);
    text = await response.text();
  } catch {
    throw new Error("Failed to decompress project payload (corrupted gzip data)");
  }

  if (text.length > MAX_DECOMPRESSED_CHARS) {
    throw new Error("Decompressed project exceeds maximum safe size");
  }

  let raw: unknown;
  try {
    raw = deepSanitizeJson(JSON.parse(text));
  } catch {
    throw new Error("Corrupted JSON data inside share payload");
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid payload: root must be an object");
  }

  // Normalize project to ensure all current schema fields (v5) are present with safe defaults
  const normalized = normalizeProject(raw as SonicProject);
  if (!validateProject(normalized)) {
    throw new Error("Shared project failed schema integrity validation");
  }

  // Assign a fresh ID so it never overwrites an existing local project by ID
  return {
    ...normalized,
    meta: {
      ...normalized.meta,
      id: uid("proj"),
      updatedAt: new Date().toISOString(),
    },
  };
}

/** Extracts the encoded payload from a full URL, search query, or hash string. */
export function extractPayloadFromUrl(locationStr: string): string | null {
  if (!locationStr) return null;
  const cleanUrl = sanitizeShareUrl(locationStr);
  if (!cleanUrl) return null;

  // Look for #data=... or #share=...
  const hashIdx = cleanUrl.indexOf("#");
  if (hashIdx !== -1) {
    const hash = cleanUrl.slice(hashIdx + 1);
    const params = new URLSearchParams(hash);
    const data = params.get("data") || params.get("share");
    if (data) return data;
  }
  // Also check query param ?data=... or ?share=...
  const queryIdx = cleanUrl.indexOf("?");
  if (queryIdx !== -1) {
    const query = cleanUrl.slice(queryIdx + 1).split("#")[0];
    const params = new URLSearchParams(query);
    const data = params.get("data") || params.get("share");
    if (data) return data;
  }
  return null;
}

/** Generates a complete shareable URL for the given project. */
export async function createShareUrl(project: SonicProject, origin?: string): Promise<string> {
  const payload = await compressProject(project);
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/studio/share#data=${payload}`;
}
