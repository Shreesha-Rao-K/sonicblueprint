// Unit, boundary, and integration tests for data sanitization and secret scrubbing.
import { suite, test, ok, eq } from "./helpers.js";
import {
  sanitizeInputString,
  deepSanitizeJson,
  scrubSecretsFromObject,
  sanitizeProjectForStorage,
  sanitizeProjectForShare,
  sanitizeShareUrl,
} from "@/lib/security/sanitize";
import { createProject, validateProject } from "@/lib/project-schema";
import { compressProject, decompressProject } from "@/lib/share-url";

suite("sanitize: input string sanitization");

test("test_sanitize_input_string strips control characters and script injection", () => {
  const dirty = "Hello\x00\x08World<script>alert('xss')</script>!";
  const clean = sanitizeInputString(dirty);
  eq(clean, "Hello World!");

  const xssTag = "<b onclick='steal()'>Test</b>";
  eq(sanitizeInputString(xssTag), "Test");

  const javascriptUri = "javascript:alert(1)";
  eq(sanitizeInputString(javascriptUri), "alert(1)");
});

test("test_sanitize_input_string length truncation and bounds", () => {
  const longStr = "A".repeat(1000);
  const truncated = sanitizeInputString(longStr, { maxLength: 20 });
  eq(truncated.length, 20);

  // Non-string inputs
  eq(sanitizeInputString(null), "");
  eq(sanitizeInputString(undefined), "");
  eq(sanitizeInputString(12345), "");
});

suite("sanitize: deep JSON sanitization & prototype pollution");

test("test_deep_sanitize_json removes prototype pollution keys", () => {
  const hostile = {
    normal: "value",
    __proto__: { polluted: true },
    nested: {
      constructor: "evil",
      prototype: "evil",
      safe: 42,
    },
  };

  const safe = deepSanitizeJson<Record<string, unknown>>(hostile);
  eq(safe.normal, "value");
  eq((safe.nested as Record<string, unknown>).safe, 42);
  eq(Object.prototype.hasOwnProperty.call(safe, "__proto__"), false);
  eq(Object.prototype.hasOwnProperty.call(safe.nested as object, "constructor"), false);
  eq(Object.prototype.hasOwnProperty.call(safe.nested as object, "prototype"), false);
});

test("test_deep_sanitize_json handles circular references without hanging", () => {
  const circular: Record<string, unknown> = { a: 1 };
  circular["self"] = circular;

  const result = deepSanitizeJson<Record<string, unknown>>(circular);
  eq(result.a, 1);
  eq(result.self, null);
});

suite("sanitize: secret scrubbing from objects");

test("test_scrub_sensitive_keys strips forbidden keys", () => {
  const data = {
    projectName: "My Song",
    apiKey: "sk_live_1234567890abcdef",
    accessToken: "token_xyz",
    password: "secret_password",
    nested: {
      bearerToken: "Bearer test",
      private_key: "-----BEGIN PRIVATE KEY-----",
      notes: "Clean note",
    },
  };

  const scrubbed = scrubSecretsFromObject(data);
  eq(scrubbed.projectName, "My Song");
  eq((scrubbed as Record<string, unknown>)["apiKey"], undefined);
  eq((scrubbed as Record<string, unknown>)["accessToken"], undefined);
  eq((scrubbed as Record<string, unknown>)["password"], undefined);
  eq((scrubbed.nested as Record<string, unknown>)["bearerToken"], undefined);
  eq((scrubbed.nested as Record<string, unknown>)["private_key"], undefined);
  eq((scrubbed.nested as Record<string, unknown>)["notes"], "Clean note");
});

test("test_scrub_sensitive_values detects known token patterns in string values", () => {
  const data = {
    normalNote: "Guitar chord progression in D minor",
    secretNote1: ["sk", "test", "dummytestingtokenpattern123456"].join("_"),
    secretNote2: ["ghp", "dummytestinggithubpersonaltoken12345"].join("_"),
  };

  const scrubbed = scrubSecretsFromObject(data);
  eq(scrubbed.normalNote, "Guitar chord progression in D minor");
  eq((scrubbed as Record<string, unknown>)["secretNote1"], undefined);
  eq((scrubbed as Record<string, unknown>)["secretNote2"], undefined);
});

suite("sanitize: project preparation for storage and sharing");

test("test_sanitize_project_for_storage scrubs injected secrets and returns valid project", () => {
  const p = createProject("Test Storage Project");
  const hostile = {
    ...p,
    apiKey: "secret_leak",
    meta: {
      ...p.meta,
      name: "Clean Name <script>alert(1)</script>",
      secretToken: "xyz123",
    },
  };

  const clean = sanitizeProjectForStorage(hostile as unknown as typeof p);
  ok(validateProject(clean));
  eq(clean.meta.name, "Clean Name");
  eq((clean as Record<string, unknown>)["apiKey"], undefined);
  eq((clean.meta as Record<string, unknown>)["secretToken"], undefined);
});

test("test_sanitize_project_for_share strips versions and sensitive keys", () => {
  const p = createProject("Share Project");
  const withVersion = {
    ...p,
    versions: [{ id: "v1", label: "V1", createdAt: new Date().toISOString(), versionNumber: 1, snapshot: p }],
    privateKey: "do_not_share",
  };

  const shareable = sanitizeProjectForShare(withVersion as unknown as typeof p);
  eq((shareable as Record<string, unknown>)["versions"], undefined);
  eq((shareable as Record<string, unknown>)["privateKey"], undefined);
});

suite("sanitize: share URL sanitization");

test("test_sanitize_share_url strips sensitive query and hash parameters", () => {
  const hostileUrl =
    "https://sonicblueprint.app/studio/share?token=secret123&apiKey=xyz#data=validPayload123&auth=bearer456";
  const cleanUrl = sanitizeShareUrl(hostileUrl);

  ok(!cleanUrl.includes("token="), "token query parameter should be stripped");
  ok(!cleanUrl.includes("apiKey="), "apiKey query parameter should be stripped");
  ok(!cleanUrl.includes("auth="), "auth hash parameter should be stripped");
  ok(cleanUrl.includes("data=validPayload123"), "valid data parameter should be preserved");
});

test("test_sanitize_share_url handles empty and malformed URLs", () => {
  eq(sanitizeShareUrl(""), "");
  eq(sanitizeShareUrl(null as unknown as string), "");
  ok(sanitizeShareUrl("not-a-valid-url").length > 0);
});

suite("sanitize: end-to-end compression roundtrip secret isolation");

test("test_share_compression_roundtrip_secret_isolation", async () => {
  const original = createProject("Secret Test Song");
  const hostile = {
    ...original,
    token: "leaked_token_should_be_scrubbed",
    meta: {
      ...original.meta,
      name: "Secret Song <script>evil()</script>",
      api_key: "leaked_api_key",
    },
  };

  const payload = await compressProject(hostile as unknown as typeof original);
  ok(typeof payload === "string" && payload.length > 0);

  const restored = await decompressProject(payload);
  ok(validateProject(restored));
  eq(restored.meta.name, "Secret Song");
  eq((restored as Record<string, unknown>)["token"], undefined);
  eq((restored.meta as Record<string, unknown>)["api_key"], undefined);
});
