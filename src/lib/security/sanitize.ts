// src/lib/security/sanitize.ts
// Client-side sanitization, credential scrubbing, XSS filtering,
// prototype pollution neutralization, and URL parameter cleansing.

import type { SonicProject } from "@/lib/project-schema";
import { validateProject, normalizeProject } from "@/lib/project-schema";

/** Regex pattern for sensitive property names that should never be persisted or shared. */
export const FORBIDDEN_SECRET_KEY_REGEX =
  /(api[_-]?key|access[_-]?token|auth(entication|orization)?|bearer|secret|password|private[_-]?key|credential|jwt|cookie|session[_-]?token|refresh[_-]?token|client[_-]?secret)/i;

/** Common patterns identifying credential strings in values. */
export const SENSITIVE_VALUE_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: "AWS Access Key", regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "Stripe Key", regex: /\bsk_(live|test)_[0-9a-zA-Z]{24,}\b/ },
  { name: "GitHub Token", regex: /\bgh[pousr]_[0-9a-zA-Z]{36}\b/ },
  { name: "Bearer Token", regex: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/i },
  { name: "JWT", regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: "PEM Private Key", regex: /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/ },
];

/** Options for input string sanitization. */
export interface SanitizeStringOptions {
  maxLength?: number | undefined;
  allowNewlines?: boolean | undefined;
  trim?: boolean | undefined;
}

/**
 * Sanitizes user-provided text strings:
 * - Strips non-printable ASCII control characters (\x00-\x1F, \x7F).
 * - Strips HTML/script injection vectors (<script>, javascript:, html tags).
 * - Enforces unicode NFC normalization and maximum length bounds.
 */
export function sanitizeInputString(
  input: unknown,
  options: SanitizeStringOptions = {}
): string {
  if (typeof input !== "string") return "";

  const maxLength = options.maxLength ?? 512;
  const allowNewlines = options.allowNewlines ?? false;
  const trim = options.trim ?? true;

  // 1. Unicode NFC normalization
  let result = input.normalize("NFC");

  // 2. Control characters removal
  // Keep \n, \r, \t if allowNewlines is true, otherwise strip all \x00-\x1F
  if (allowNewlines) {
    result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/g, "");
  } else {
    result = result.replace(/[\x00-\x1F\x7F]+/g, " ");
  }

  // 3. Strip script tags and HTML markup
  result = result
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript\s*:/gi, "");

  // 4. Whitespace trimming and bounds
  if (trim) {
    result = result.trim();
  }

  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }

  return result;
}

/**
 * Deeply sanitizes parsed JSON objects:
 * - Neutralizes prototype pollution (__proto__, constructor, prototype).
 * - Strips cyclic references.
 * - Caps nesting depth (default 32) to prevent DoS.
 */
export function deepSanitizeJson<T>(raw: unknown, maxDepth = 32): T {
  const seen = new WeakSet<object>();

  function clean(val: unknown, depth: number): unknown {
    if (depth > maxDepth) return null;
    if (val === null || typeof val !== "object") return val;

    if (seen.has(val)) return null; // Break circularity
    seen.add(val);

    if (Array.isArray(val)) {
      return val.map((item) => clean(item, depth + 1));
    }

    const safeObj: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(val as Record<string, unknown>)) {
      // Prototype pollution defense: drop dangerous proto keys
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }
      safeObj[key] = clean((val as Record<string, unknown>)[key], depth + 1);
    }
    return safeObj;
  }

  return clean(raw, 0) as T;
}

/**
 * Recursively inspects an object, removing any property whose key or string value
 * represents a sensitive secret (API key, token, private key, authorization).
 */
export function scrubSecretsFromObject<T>(input: T, maxDepth = 32): T {
  const seen = new WeakSet<object>();

  function scrubNode(node: unknown, depth: number): unknown {
    if (depth > maxDepth) return node;
    if (!node || typeof node !== "object") {
      if (typeof node === "string") {
        for (const pattern of SENSITIVE_VALUE_PATTERNS) {
          if (pattern.regex.test(node)) {
            return "[REDACTED_SECRET]";
          }
        }
      }
      return node;
    }

    if (seen.has(node)) return node;
    seen.add(node);

    if (Array.isArray(node)) {
      return node.map((item) => scrubNode(item, depth + 1));
    }

    const output: Record<string, unknown> = {};
    const record = node as Record<string, unknown>;

    for (const key of Object.keys(record)) {
      // 1. Check if key name is forbidden
      if (FORBIDDEN_SECRET_KEY_REGEX.test(key)) {
        continue; // Drop secret property entirely
      }

      // 2. Check prototype pollution keys
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }

      const val = record[key];

      // 3. Check if value contains secret patterns
      if (typeof val === "string") {
        let isSecret = false;
        for (const pattern of SENSITIVE_VALUE_PATTERNS) {
          if (pattern.regex.test(val)) {
            isSecret = true;
            break;
          }
        }
        if (isSecret) {
          continue; // Drop property with sensitive string value
        }
      }

      output[key] = scrubNode(val, depth + 1);
    }

    return output;
  }

  return scrubNode(input, 0) as T;
}

/** Allowed top-level fields on SonicProject schema. */
const ALLOWED_PROJECT_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "meta",
  "config",
  "chords",
  "drums",
  "bass",
  "melodyStyle",
  "instruments",
  "arrangement",
  "originality",
  "layers",
  "versions",
  "effects",
]);

/**
 * Prepares and sanitizes a SonicProject for persistent storage (IndexedDB / localStorage).
 * Strips all non-schema fields, scrubs embedded secrets, sanitizes user strings,
 * and verifies schema integrity.
 */
export function sanitizeProjectForStorage(project: SonicProject): SonicProject {
  // 1. Scrub secrets and prototype pollution
  const scrubbed: Record<string, unknown> = { ...scrubSecretsFromObject(project) };

  // 2. Strip any extraneous top-level keys not in SonicProject
  for (const key of Object.keys(scrubbed)) {
    if (!ALLOWED_PROJECT_KEYS.has(key)) {
      delete scrubbed[key];
    }
  }

  // 3. Sanitize user-facing text strings
  if (scrubbed["meta"] && typeof scrubbed["meta"] === "object") {
    const meta = scrubbed["meta"] as Record<string, unknown>;
    const ALLOWED_META_KEYS = new Set(["id", "name", "createdAt", "updatedAt", "version"]);
    for (const mk of Object.keys(meta)) {
      if (!ALLOWED_META_KEYS.has(mk) || FORBIDDEN_SECRET_KEY_REGEX.test(mk)) {
        delete meta[mk];
      }
    }
    meta["name"] = sanitizeInputString(meta["name"], { maxLength: 512 });
  }

  if (Array.isArray(scrubbed["arrangement"])) {
    for (const sec of scrubbed["arrangement"]) {
      if (sec && typeof sec === "object") {
        sec.name = sanitizeInputString(sec.name, { maxLength: 64 });
      }
    }
  }

  if (scrubbed["originality"] && typeof scrubbed["originality"] === "object") {
    const orig = scrubbed["originality"] as Record<string, unknown>;
    if (orig["notes"] !== undefined) {
      orig["notes"] = sanitizeInputString(orig["notes"], { maxLength: 2000, allowNewlines: true });
    }
    if (orig["melodySeed"] !== undefined) {
      orig["melodySeed"] = sanitizeInputString(orig["melodySeed"], { maxLength: 512 });
    }
  }

  // 4. Normalize and validate
  const normalized = normalizeProject(scrubbed as unknown as SonicProject);
  if (!validateProject(normalized)) {
    throw new Error("Sanitized project failed schema validation");
  }

  return normalized;
}

/**
 * Prepares and sanitizes a SonicProject for URL sharing:
 * - Strips versions (history snapshots).
 * - Scrubs any secret keys or secret tokens.
 * - Strips extraneous non-schema properties.
 */
export function sanitizeProjectForShare(project: SonicProject): Omit<SonicProject, "versions"> {
  const sanitized = sanitizeProjectForStorage(project);
  const copy: Partial<SonicProject> = { ...sanitized };
  delete copy.versions;
  return copy as Omit<SonicProject, "versions">;
}

/**
 * Cleans a URL string by stripping hostile or sensitive parameters (token, auth, apiKey)
 * from both query string and hash fragment. Only preserves authorized parameters (data, share).
 */
export function sanitizeShareUrl(urlStr: string): string {
  if (!urlStr || typeof urlStr !== "string") return "";

  try {
    const parsed = new URL(urlStr, "https://sonicblueprint.local");

    // Clean query parameters: drop any sensitive keys
    const safeSearchParams = new URLSearchParams();
    parsed.searchParams.forEach((val, key) => {
      if (
        (key === "data" || key === "share") &&
        !FORBIDDEN_SECRET_KEY_REGEX.test(key)
      ) {
        safeSearchParams.set(key, val);
      }
    });
    parsed.search = safeSearchParams.toString() ? `?${safeSearchParams.toString()}` : "";

    // Clean hash parameters: drop sensitive keys
    if (parsed.hash) {
      const hashContent = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
      const hashParams = new URLSearchParams(hashContent);
      const safeHashParams = new URLSearchParams();

      hashParams.forEach((val, key) => {
        if (
          (key === "data" || key === "share") &&
          !FORBIDDEN_SECRET_KEY_REGEX.test(key)
        ) {
          safeHashParams.set(key, val);
        }
      });
      parsed.hash = safeHashParams.toString() ? `#${safeHashParams.toString()}` : "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}
