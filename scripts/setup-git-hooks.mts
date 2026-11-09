#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const GIT_DIR = path.join(ROOT, ".git");

if (!fs.existsSync(GIT_DIR)) {
  console.log("Not a git repository root. Skipping git hook installation.");
  process.exit(0);
}

try {
  // Configure git to use .githooks folder
  execSync("git config core.hooksPath .githooks", { stdio: "inherit" });
  console.log("✅ Git hooks configured to '.githooks'.");
} catch (e) {
  console.error("Failed to set git core.hooksPath:", e);
}
