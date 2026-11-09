// Unit, boundary, and integration tests for memory zeroization and environment isolation.
import { suite, test, ok, eq, throws } from "./helpers.js";
import {
  zeroizeBytes,
  ZeroizableSecret,
  zeroizeObject,
  secureWipeStorage,
  auditClientEnvironment,
  assertClientEnvironmentIsolated,
} from "@/lib/security/zeroize";

suite("zeroize: memory buffer zeroization");

test("test_zeroize_memory_buffer zeroes all bytes in Uint8Array", () => {
  const buf = new Uint8Array([1, 2, 3, 4, 5, 42, 255]);
  zeroizeBytes(buf);
  for (let i = 0; i < buf.length; i++) {
    eq(buf[i], 0, `byte at index ${i} should be 0`);
  }
});

test("test_zeroize_boundary_buffers handles zero-length and single-byte buffers", () => {
  const empty = new Uint8Array(0);
  zeroizeBytes(empty);
  eq(empty.length, 0);

  const single = new Uint8Array([254]);
  zeroizeBytes(single);
  eq(single[0], 0);

  // Null and undefined safety
  zeroizeBytes(null);
  zeroizeBytes(undefined);
});

test("test_zeroize_various_typed_arrays zeroes Float32Array and DataView", () => {
  const floats = new Float32Array([1.23, 4.56, 7.89]);
  zeroizeBytes(floats);
  eq(floats[0], 0);
  eq(floats[1], 0);
  eq(floats[2], 0);

  const ab = new ArrayBuffer(8);
  const dv = new DataView(ab);
  dv.setUint32(0, 0x12345678);
  zeroizeBytes(dv);
  eq(dv.getUint32(0), 0);
});

suite("zeroize: ZeroizableSecret container");

test("test_zeroizable_secret_lifecycle fromString, expose, exposeString, and zeroize", () => {
  const secret = ZeroizableSecret.fromString("super-secret-password-123");
  eq(secret.isDisposed, false);
  ok(secret.byteLength > 0);

  // Expose string
  secret.exposeString((s) => {
    eq(s, "super-secret-password-123");
  });

  // Expose bytes
  secret.expose((bytes) => {
    ok(bytes.length > 0);
  });

  // Zeroize
  secret.zeroize();
  eq(secret.isDisposed, true);

  // Access after disposal must throw
  throws(() => {
    secret.exposeString(() => {});
  }, "should throw when accessing disposed secret");

  throws(() => {
    secret.expose(() => {});
  }, "should throw when accessing disposed secret");
});

test("test_zeroizable_secret_double_dispose is safe and idempotent", () => {
  const secret = ZeroizableSecret.fromString("token_xyz");
  secret.zeroize();
  secret.zeroize(); // Should not throw
  eq(secret.isDisposed, true);
});

test("test_zeroizable_secret_from_bytes", () => {
  const rawBytes = new Uint8Array([10, 20, 30, 40]);
  const secret = ZeroizableSecret.fromBytes(rawBytes);
  secret.expose((b) => {
    eq(b[0], 10);
    eq(b[3], 40);
  });
  secret.zeroize();
  eq(secret.isDisposed, true);
});

suite("zeroize: recursive object zeroization");

test("test_zeroize_object recursively zeroes buffers and secrets", () => {
  const secret = ZeroizableSecret.fromString("api_key_hidden");
  const buffer = new Uint8Array([99, 100, 101]);
  const nested = {
    auth: {
      secret,
      token: "secret-token-string",
      apiKey: "sk_test_12345",
      rawKey: buffer,
    },
    normal: "not_a_secret",
  };

  zeroizeObject(nested);

  eq(secret.isDisposed, true);
  eq(buffer[0], 0);
  eq(buffer[1], 0);
  eq(buffer[2], 0);
  eq((nested.auth as Record<string, unknown>)["apiKey"], undefined);
  eq((nested.auth as Record<string, unknown>)["token"], undefined);
  eq(nested.normal, "not_a_secret");
});

suite("zeroize: secure storage wiping");

test("test_secure_wipe_storage performs multi-pass wipe and removal", () => {
  const operations: { op: string; key: string; value?: string }[] = [];
  const mockStorage: Storage = {
    length: 1,
    clear: () => {},
    getItem: (k: string) => (k === "target_key" ? "sensitive_project_data" : null),
    key: () => null,
    removeItem: (k: string) => {
      operations.push({ op: "remove", key: k });
    },
    setItem: (k: string, v: string) => {
      operations.push({ op: "set", key: k, value: v });
    },
  };

  secureWipeStorage(mockStorage, "target_key");

  // Should have pass 1 (noise set), pass 2 (zero set), pass 3 (remove)
  ok(operations.length >= 3, "expected at least 3 storage operations");
  eq(operations[0]?.op, "set");
  eq(operations[1]?.op, "set");
  ok(operations[1]?.value?.startsWith("0000"), "pass 2 should be zeros");
  eq(operations[2]?.op, "remove");
});

suite("zeroize: environment isolation");

test("test_environment_audit_clean verifies clean environment", () => {
  const result = auditClientEnvironment();
  ok(result.isClean, "auditClientEnvironment should report clean");
  eq(result.violations.length, 0);
  assertClientEnvironmentIsolated(); // should not throw
});
