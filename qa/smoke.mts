// Production smoke QA — zero-dependency HTTP regression coverage.
// Usage: npm run build && npm start -- --port 3100 & npx tsx qa/smoke.mts
// Optional: SMOKE_URL=http://localhost:3100 npx tsx qa/smoke.mts
// Excluded from Next build typecheck via tsconfig.
// Covers: public pages load, SEO files serve, static sample assets serve,
// and security headers are present. Browser-driven playback flows remain
// manual (see docs/user-guide.md); automation cannot hear audio.

const BASE = process.env["SMOKE_URL"] ?? "http://localhost:3100";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(`${name} :: ${detail}`);
    console.log(`FAIL ${name} :: ${detail}`);
  }
}

async function get(path: string): Promise<{ status: number; text: string; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`);
  const buf = await res.arrayBuffer();
  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 20000));
  } catch {
    text = "";
  }
  return { status: res.status, text, headers: res.headers };
}

async function page(path: string, marker: string) {
  let r: { status: number; text: string; headers: Headers };
  try {
    r = await get(path);
  } catch (e) {
    check(`GET ${path}`, false, `fetch failed: ${e instanceof Error ? e.message : e}`);
    return;
  }
  check(`GET ${path} → 200`, r.status === 200, `status ${r.status}`);
  check(`${path} contains marker`, r.text.includes(marker), `missing ${marker}`);
}

async function main(): Promise<void> {
  await page("/", "SONICBLUEPRINT");
  await page("/dashboard", "Dashboard");
  await page("/presets", "Preset");
  await page("/projects", "Project");
  await page("/settings", "Setting");
  await page("/sample-qa", "Sample QA");
  await page("/sitemap.xml", "<url>");
  await page("/robots.txt", "sitemap");

  // Static sample assets must serve (else playback falls back silently).
  let sample: { status: number; text: string; headers: Headers } | null = null;
  try {
    sample = await get("/samples/drums/kick_soft.mp3");
  } catch (e) {
    check("sample asset serves", false, `fetch failed: ${e instanceof Error ? e.message : e}`);
  }
  if (sample) check("sample asset serves", sample.status === 200, `status ${sample.status}`);

  // Security headers (see next.config.ts — must not regress silently).
  let home: { status: number; text: string; headers: Headers } | null = null;
  try {
    home = await get("/");
  } catch (e) {
    check("headers readable", false, `fetch failed: ${e instanceof Error ? e.message : e}`);
  }
  if (home) {
    const h = home.headers;
    check("nosniff header", h.get("x-content-type-options") === "nosniff", String(h.get("x-content-type-options")));
    check("frame-deny header", h.get("x-frame-options") === "DENY", String(h.get("x-frame-options")));
    check(
      "referrer-policy header",
      (h.get("referrer-policy") ?? "").includes("strict-origin"),
      String(h.get("referrer-policy"))
    );
    check("permissions-policy header", h.get("permissions-policy") !== null, "absent");
  }

  console.log(`\nSMOKE: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

void main();
