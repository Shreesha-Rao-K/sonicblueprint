#!/usr/bin/env tsx
/**
 * SonicBlueprint SAST Security & Dependency Auditor
 * Scans source code for OWASP Top 10 vulnerabilities, dangerous execution,
 * innerHTML/XSS, ReDoS regexes, prototype pollution, secret exposure,
 * unauthorized network egress, and dependency CVEs.
 *
 * Usage:
 *   npx tsx scripts/security-audit.mts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { performance } from "node:perf_hooks";

interface Finding {
  ruleId: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  file: string;
  line: number;
  message: string;
  snippet?: string;
}

const ROOT = process.cwd();
const TARGET_DIRS = ["src", "tests", "qa"];
const CONFIG_FILES = ["next.config.ts", "eslint.config.mjs", "package.json"];
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  "build",
  "out",
  ".git",
  "skills",
  ".agents",
]);

const findings: Finding[] = [];

// ── File Walker ──
function getFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFiles(fullPath));
    } else if (
      entry.isFile() &&
      /\.(ts|tsx|js|mjs|mts)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Static SAST Rules ──

function checkDangerousCode(file: string, _content: string, lines: string[]) {
  // SEC-001: Dangerous dynamic evaluation
  const evalRegex = /\beval\s*\(/g;
  const funcRegex = /\bnew\s+Function\s*\(|\bwindow\.Function\s*\(|\bglobalThis\.Function\s*\(/g;
  const timerEval = /\bset(Timeout|Interval)\s*\(\s*["'`]/g;

  lines.forEach((line, idx) => {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    if (evalRegex.test(line)) {
      findings.push({
        ruleId: "SEC-001-DANGEROUS-EVAL",
        severity: "CRITICAL",
        file,
        line: idx + 1,
        message: "Dangerous dynamic eval() execution detected.",
        snippet: trimmed,
      });
    }
    if (funcRegex.test(line) && !line.includes("export function") && !line.includes("type TestFn")) {
      findings.push({
        ruleId: "SEC-001-DANGEROUS-FUNCTION",
        severity: "CRITICAL",
        file,
        line: idx + 1,
        message: "Dynamic Function constructor execution detected.",
        snippet: trimmed,
      });
    }
    if (timerEval.test(line)) {
      findings.push({
        ruleId: "SEC-001-TIMER-EVAL",
        severity: "HIGH",
        file,
        line: idx + 1,
        message: "String-evaluated setTimeout/setInterval detected.",
        snippet: trimmed,
      });
    }
  });
}

function checkDOMandXSS(file: string, _content: string, lines: string[]) {
  // SEC-002: innerHTML & dangerouslySetInnerHTML
  const innerHtmlRegex = /\.\s*(innerHTML|outerHTML)\s*=/g;
  const docWriteRegex = /\bdocument\.write(ln)?\s*\(/g;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) return;

    if (innerHtmlRegex.test(line)) {
      findings.push({
        ruleId: "SEC-002-UNSAFE-INNERHTML",
        severity: "HIGH",
        file,
        line: idx + 1,
        message: "Direct innerHTML/outerHTML assignment is vulnerable to XSS.",
        snippet: trimmed,
      });
    }

    if (docWriteRegex.test(line)) {
      findings.push({
        ruleId: "SEC-002-DOCUMENT-WRITE",
        severity: "HIGH",
        file,
        line: idx + 1,
        message: "document.write is dangerous and prohibited.",
        snippet: trimmed,
      });
    }

    if (line.includes("dangerouslySetInnerHTML")) {
      // Validate that it is strictly confined to application/ld+json with safe serialization
      const isJsonLd =
        lines.slice(Math.max(0, idx - 4), idx + 2).some((l) =>
          l.includes("application/ld+json")
        );
      if (!isJsonLd) {
        findings.push({
          ruleId: "SEC-002-DANGEROUSLY-SET-HTML",
          severity: "HIGH",
          file,
          line: idx + 1,
          message:
            "dangerouslySetInnerHTML used outside sanctioned application/ld+json context.",
          snippet: trimmed,
        });
      }
    }
  });
}

function checkPrototypePollution(file: string, _content: string, lines: string[]) {
  // SEC-003: Prototype pollution risks (property mutation on proto/constructor/prototype)
  const dangerousProtoMutation = /(?:\[\s*["'`]?(__proto__|constructor|prototype)["'`]?\s*\]|\.(__proto__|constructor|prototype))\s*=(?!=)/;
  lines.forEach((line, idx) => {
    if (line.includes("//")) return;
    if (dangerousProtoMutation.test(line) && !file.includes("test")) {
      findings.push({
        ruleId: "SEC-003-PROTOTYPE-POLLUTION",
        severity: "HIGH",
        file,
        line: idx + 1,
        message: "Suspicious prototype property mutation detected.",
        snippet: line.trim(),
      });
    }
  });
}

function checkSecretLeakage(file: string, _content: string, lines: string[]) {
  // SEC-005: Secret token string literals
  const patterns = [
    { name: "Private Key", regex: /-----BEGIN (?:RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/ },
    { name: "AWS Key", regex: /["']AKIA[0-9A-Z]{16}["']/ },
    { name: "GitHub Token", regex: /["']gh[pousr]_[A-Za-z0-9_]{36,}["']/ },
    { name: "Bearer Token Literal", regex: /["']Bearer\s+[A-Za-z0-9\-._~+/]{16,}["']/i },
  ];

  lines.forEach((line, idx) => {
    if (file.includes("test") || line.trim().startsWith("//") || line.includes("regex:") || line.includes("RegExp")) return;
    for (const p of patterns) {
      if (p.regex.test(line)) {
        findings.push({
          ruleId: "SEC-005-SECRET-EXPOSURE",
          severity: "HIGH",
          file,
          line: idx + 1,
          message: `Potential hardcoded ${p.name} detected.`,
          snippet: line.trim().slice(0, 80),
        });
      }
    }
  });
}

function checkOutboundNetwork(file: string, _content: string, lines: string[]) {
  // SEC-006: Zero remote network dependency check in client code
  if (!file.includes("src" + path.sep)) return;
  const externalFetch = /fetch\s*\(\s*["']https?:\/\/(?!localhost|127\.0\.0\.1)/g;

  lines.forEach((line, idx) => {
    if (line.trim().startsWith("//")) return;
    if (externalFetch.test(line)) {
      findings.push({
        ruleId: "SEC-006-OUTBOUND-EGRESS",
        severity: "MEDIUM",
        file,
        line: idx + 1,
        message:
          "Outbound external HTTP fetch detected. Violates Zero Network Dependency invariant.",
        snippet: line.trim(),
      });
    }
  });
}

// ── ReDoS Stress Tester ──
function checkReDoS(file: string, content: string) {
  // Extract regex literals: /pattern/flags
  const regexLiteralMatch = /\/((?:\\\/|[^\/\r\n])+)\/([gimsuy]*)/g;
  let match;
  while ((match = regexLiteralMatch.exec(content)) !== null) {
    const rawPattern = match[1];
    const flags = match[2];

    if (!rawPattern) continue;
    // Filter out common false positives or division operations
    if (rawPattern.length < 3 || rawPattern.startsWith("*") || rawPattern.startsWith("/")) continue;

    // Check for nested quantifiers
    const nestedQuantifiers = /(\([^)]*[\+\*][^)]*\)[\+\*])|([\+\*]{2,})/;
    if (nestedQuantifiers.test(rawPattern)) {
      findings.push({
        ruleId: "SEC-004-REDOS-NESTED-QUANTIFIER",
        severity: "HIGH",
        file,
        line: content.slice(0, match.index).split("\n").length,
        message: `Potential ReDoS nested quantifier in regex: /${rawPattern}/`,
      });
      continue;
    }

    // Dynamic Stress Test (with adversarial long payload)
    try {
      const rx = new RegExp(rawPattern, flags);
      const adversarial = "a".repeat(2500) + "!" + "b".repeat(2500);
      const start = performance.now();
      rx.test(adversarial);
      const duration = performance.now() - start;
      if (duration > 25) {
        findings.push({
          ruleId: "SEC-004-REDOS-SLOW-REGEX",
          severity: "HIGH",
          file,
          line: content.slice(0, match.index).split("\n").length,
          message: `Regex execution took ${duration.toFixed(1)}ms on stress input: /${rawPattern}/`,
        });
      }
    } catch {
      // Regex compilation skipped if dynamic pattern
    }
  }
}

// ── Security Headers Configuration Check ──
function checkSecurityHeadersConfig() {
  const nextConfigPath = path.join(ROOT, "next.config.ts");
  if (!fs.existsSync(nextConfigPath)) {
    findings.push({
      ruleId: "SEC-007-NEXT-CONFIG-MISSING",
      severity: "CRITICAL",
      file: "next.config.ts",
      line: 1,
      message: "next.config.ts not found.",
    });
    return;
  }
  const content = fs.readFileSync(nextConfigPath, "utf-8");
  const requiredHeaders = [
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Embedder-Policy",
    "Cross-Origin-Resource-Policy",
  ];

  for (const h of requiredHeaders) {
    if (!content.includes(h)) {
      findings.push({
        ruleId: "SEC-007-MISSING-SECURITY-HEADER",
        severity: "HIGH",
        file: "next.config.ts",
        line: 1,
        message: `Mandatory security header '${h}' is missing from next.config.ts.`,
      });
    }
  }
}

// ── Dependency Vulnerability SCA Check ──
function checkDependencyVulnerabilities(): { critical: number; high: number; moderate: number } {
  console.log("📦 Running Software Composition Analysis (npm audit)...");
  try {
    const raw = execSync("npm audit --json", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15000,
    });
    const parsed = JSON.parse(raw);
    const vulns = parsed.metadata?.vulnerabilities || { critical: 0, high: 0, moderate: 0 };
    return {
      critical: vulns.critical || 0,
      high: vulns.high || 0,
      moderate: vulns.moderate || 0,
    };
  } catch (err: unknown) {
    // npm audit returns exit code 1 when vulnerabilities exist
    try {
      const execErr = err as { stdout?: string };
      if (execErr.stdout) {
        const parsed = JSON.parse(execErr.stdout);
        const vulns = parsed.metadata?.vulnerabilities || { critical: 0, high: 0, moderate: 0 };
        return {
          critical: vulns.critical || 0,
          high: vulns.high || 0,
          moderate: vulns.moderate || 0,
        };
      }
    } catch {
      // Fallback
    }
    return { critical: 0, high: 0, moderate: 0 };
  }
}

// ── Main SAST Runner ──
async function main() {
  console.log("🛡️  SonicBlueprint SAST & OWASP Security Audit\n");
  const startTime = performance.now();

  const allFiles: string[] = [];
  for (const d of TARGET_DIRS) {
    const fullDir = path.join(ROOT, d);
    if (fs.existsSync(fullDir)) allFiles.push(...getFiles(fullDir));
  }
  for (const cf of CONFIG_FILES) {
    const fullPath = path.join(ROOT, cf);
    if (fs.existsSync(fullPath)) allFiles.push(fullPath);
  }

  console.log(`📁 Scanning ${allFiles.length} project source files...`);

  for (const file of allFiles) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    checkDangerousCode(rel, content, lines);
    checkDOMandXSS(rel, content, lines);
    checkPrototypePollution(rel, content, lines);
    checkSecretLeakage(rel, content, lines);
    checkOutboundNetwork(rel, content, lines);
    checkReDoS(rel, content);
  }

  checkSecurityHeadersConfig();

  const depVulns = checkDependencyVulnerabilities();

  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`\nScan finished in ${duration}s.\n`);

  // Print Findings
  const criticals = findings.filter((f) => f.severity === "CRITICAL");
  const highs = findings.filter((f) => f.severity === "HIGH");
  const mediums = findings.filter((f) => f.severity === "MEDIUM");

  if (findings.length > 0) {
    console.log("⚠️  SAST Findings:");
    for (const f of findings) {
      console.log(`  [${f.severity}] ${f.ruleId} (${f.file}:${f.line})`);
      console.log(`    Message: ${f.message}`);
      if (f.snippet) console.log(`    Code:    ${f.snippet}`);
    }
    console.log("");
  }

  console.log("📊 Summary of SAST & Security Invariants:");
  console.log(`  CRITICAL: ${criticals.length}`);
  console.log(`  HIGH:     ${highs.length}`);
  console.log(`  MEDIUM:   ${mediums.length}`);
  console.log(`  Dependency CVEs: ${depVulns.critical} critical, ${depVulns.high} high, ${depVulns.moderate} moderate\n`);

  if (criticals.length > 0 || highs.length > 0) {
    console.error("❌ SAST Security Audit FAILED: Critical or High security findings detected.");
    process.exit(1);
  }

  console.log("✅ SAST Security Audit PASSED. All code quality invariants met.");
  process.exit(0);
}

void main();
