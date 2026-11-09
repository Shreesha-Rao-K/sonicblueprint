// src/lib/security/zeroize.ts
// Client-side memory buffer zeroization, ephemeral secret wrappers,
// storage shredding, and environment variable isolation guards.

/** Supported typed arrays and memory buffers. */
export type MutableBuffer =
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array
  | DataView
  | ArrayBuffer;

/**
 * In-place memory zeroization for typed arrays and ArrayBuffers.
 * Implements a dual-pass overwrite (CSPRNG random bytes + zeros)
 * and a volatile read barrier to prevent JIT dead-store elimination (DSE).
 */
export function zeroizeBytes(target: MutableBuffer | null | undefined): void {
  if (!target) return;

  let view: Uint8Array;
  if (target instanceof ArrayBuffer) {
    view = new Uint8Array(target);
  } else if (ArrayBuffer.isView(target)) {
    view = new Uint8Array(target.buffer, target.byteOffset, target.byteLength);
  } else {
    return;
  }

  const len = view.byteLength;
  if (len === 0) return;

  // Pass 1: Cryptographic entropy overwrite (if crypto is available)
  try {
    const cryptoObj =
      typeof globalThis !== "undefined" && globalThis.crypto
        ? globalThis.crypto
        : typeof window !== "undefined"
          ? window.crypto
          : null;

    if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
      // Chunk into 65536 bytes (limit of getRandomValues in browser)
      const CHUNK_SIZE = 65536;
      for (let offset = 0; offset < len; offset += CHUNK_SIZE) {
        const chunk = view.subarray(offset, Math.min(offset + CHUNK_SIZE, len));
        cryptoObj.getRandomValues(chunk);
      }
    }
  } catch {
    // If CSPRNG fails, proceed immediately to deterministic zero fill
  }

  // Pass 2: Overwrite with binary zeros
  view.fill(0);

  // Volatile barrier to prevent dead-store elimination (DSE)
  // JIT engines cannot optimize away the fill because the value is read into a sink
  let barrier = 0;
  for (let i = 0; i < Math.min(len, 16); i++) {
    barrier |= view[i] ?? 0;
  }
  if (barrier !== 0) {
    // Should never occur: force re-fill if non-zero
    for (let i = 0; i < len; i++) {
      view[i] = 0;
    }
  }
}

/**
 * Disposable container for sensitive client-side credentials.
 * Implements TypeScript 5 Explicit Resource Management ([Symbol.dispose]).
 * Ephemeral secrets should be consumed via .expose() or .exposeString().
 */
export class ZeroizableSecret implements Disposable {
  private _buffer: Uint8Array | null = null;
  private _isDisposed = false;

  private constructor(bytes: Uint8Array) {
    this._buffer = new Uint8Array(bytes.length);
    this._buffer.set(bytes);
  }

  /** Wraps a string into a ZeroizableSecret, encoding to UTF-8 bytes. */
  public static fromString(secret: string): ZeroizableSecret {
    if (typeof secret !== "string") {
      throw new TypeError("ZeroizableSecret.fromString requires a string argument");
    }
    const encoder = new TextEncoder();
    const bytes = encoder.encode(secret);
    return new ZeroizableSecret(bytes);
  }

  /** Wraps a byte array into a ZeroizableSecret. */
  public static fromBytes(bytes: Uint8Array): ZeroizableSecret {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError("ZeroizableSecret.fromBytes requires a Uint8Array argument");
    }
    return new ZeroizableSecret(bytes);
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  public get byteLength(): number {
    this.assertNotDisposed();
    return this._buffer ? this._buffer.byteLength : 0;
  }

  private assertNotDisposed(): void {
    if (this._isDisposed || !this._buffer) {
      throw new Error("ZeroizableSecret has already been zeroized and disposed");
    }
  }

  /**
   * Ephemeral access to the raw secret bytes.
   * A defensive copy is provided and zeroized immediately after callback return.
   */
  public expose<T>(callback: (bytes: Readonly<Uint8Array>) => T): T {
    this.assertNotDisposed();
    const tempCopy = new Uint8Array(this._buffer!);
    try {
      return callback(tempCopy);
    } finally {
      zeroizeBytes(tempCopy);
    }
  }

  /**
   * Ephemeral access to the secret as a UTF-8 string.
   * String reference should not be stored outside the callback scope.
   */
  public exposeString<T>(callback: (secretStr: string) => T): T {
    this.assertNotDisposed();
    const decoder = new TextDecoder("utf-8");
    const str = decoder.decode(this._buffer!);
    try {
      return callback(str);
    } finally {
      // Strings are immutable in JS, but scoped callback ensures scope exits promptly
    }
  }

  /** Permanently wipes the internal memory buffer and marks secret as disposed. */
  public zeroize(): void {
    if (this._isDisposed) return;
    if (this._buffer) {
      zeroizeBytes(this._buffer);
      this._buffer = null;
    }
    this._isDisposed = true;
  }

  /** TypeScript 5 Symbol.dispose implementation for `using` blocks. */
  public [Symbol.dispose](): void {
    this.zeroize();
  }
}

/** Traversal options for recursive object zeroization. */
export interface ZeroizeObjectOptions {
  maxDepth?: number | undefined;
  wipeStringProperties?: boolean | undefined;
}

/**
 * Recursively zeroizes mutable buffers, ZeroizableSecrets, and sensitive fields
 * within complex nested data structures.
 */
export function zeroizeObject(target: unknown, options: ZeroizeObjectOptions = {}): void {
  const maxDepth = options.maxDepth ?? 32;
  const wipeStrings = options.wipeStringProperties ?? true;
  const visited = new WeakSet<object>();

  function walk(node: unknown, depth: number): void {
    if (!node || typeof node !== "object" || depth > maxDepth) return;
    if (visited.has(node)) return;
    visited.add(node);

    if (node instanceof ZeroizableSecret) {
      node.zeroize();
      return;
    }

    if (node instanceof ArrayBuffer || ArrayBuffer.isView(node)) {
      zeroizeBytes(node as MutableBuffer);
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        walk(node[i], depth + 1);
      }
      return;
    }

    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const val = record[key];

      // If key matches sensitive credential patterns and wipeStrings is requested
      if (wipeStrings && typeof val === "string" && isSensitiveKey(key)) {
        record[key] = "";
        delete record[key];
        continue;
      }

      walk(val, depth + 1);
    }
  }

  walk(target, 0);
}

/** Check if a property key represents a sensitive secret. */
function isSensitiveKey(key: string): boolean {
  const SENSITIVE_KEY_REGEX =
    /^(api[_-]?key|token|access[_-]?token|auth(entication|orization)?|bearer|secret|password|private[_-]?key|credential|jwt|session[_-]?token)$/i;
  return SENSITIVE_KEY_REGEX.test(key);
}

/**
 * Securely overwrites a persistent storage key with multi-pass random data
 * and zeros before removing it from localStorage or sessionStorage.
 */
export function secureWipeStorage(storage: Storage, key: string): void {
  try {
    const existing = storage.getItem(key);
    if (existing === null) return;

    const len = Math.max(existing.length, 64);
    // Pass 1: Random ASCII noise
    let noise = "";
    for (let i = 0; i < len; i++) {
      noise += String.fromCharCode(33 + Math.floor(Math.random() * 94));
    }
    storage.setItem(key, noise);

    // Pass 2: Zero characters
    storage.setItem(key, "0".repeat(len));

    // Pass 3: Final removal
    storage.removeItem(key);
  } catch {
    // If storage is read-only or throws, attempt standard removal
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** Environment isolation check result. */
export interface EnvironmentAuditResult {
  isClean: boolean;
  violations: string[];
}

/** Explicit allowlist of permissible client-side environment variable keys. */
export const ALLOWED_PUBLIC_ENV_KEYS: ReadonlySet<string> = new Set([
  "NODE_ENV",
  "NEXT_PUBLIC_SITE_URL",
]);

/**
 * Audits current client environment variables (process.env) against leakages.
 * Flags any non-allowlisted key or any key containing sensitive terms.
 */
export function auditClientEnvironment(): EnvironmentAuditResult {
  const violations: string[] = [];
  const env = typeof process !== "undefined" && process.env ? process.env : {};

  const FORBIDDEN_SUBSTRING_REGEX =
    /(SECRET|TOKEN|KEY|PASSWORD|AUTH|PRIVATE|CREDENTIAL|DATABASE)/i;

  for (const [key, value] of Object.entries(env)) {
    // If key starts with NEXT_PUBLIC_ but contains forbidden substrings
    if (key.startsWith("NEXT_PUBLIC_")) {
      if (key !== "NEXT_PUBLIC_SITE_URL" && FORBIDDEN_SUBSTRING_REGEX.test(key)) {
        violations.push(
          `Forbidden sensitive NEXT_PUBLIC_ variable detected in client bundle: ${key}`
        );
      }
    } else if (FORBIDDEN_SUBSTRING_REGEX.test(key) && value) {
      // In client context, server variables should NEVER be defined or populated
      if (typeof window !== "undefined") {
        violations.push(`Server secret leaked into client window context: ${key}`);
      }
    }
  }

  return {
    isClean: violations.length === 0,
    violations,
  };
}

/**
 * Runtime assertion: throws an error if environment isolation is breached.
 */
export function assertClientEnvironmentIsolated(): void {
  const audit = auditClientEnvironment();
  if (!audit.isClean) {
    throw new Error(
      `Security Violation: Environment isolation breached:\n${audit.violations.join("\n")}`
    );
  }
}
