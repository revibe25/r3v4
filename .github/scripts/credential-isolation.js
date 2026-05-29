#!/usr/bin/env node
/**
 * Mythos credentialVaultIsolation check
 * Verifies no credential material is committed or accessible from build environment.
 */
import { execSync } from "child_process";

const FORBIDDEN_PATTERNS = [
  /DATABASE_URL\s*=\s*postgres/i,
  /STRIPE_SECRET_KEY\s*=\s*sk_/i,
  /JWT_SECRET\s*=\s*\S{8,}/i,
  /RAILWAY_TOKEN\s*=\s*\S{8,}/i,
  /-----BEGIN.*PRIVATE KEY-----/,
];

const trackedFiles = execSync("git ls-files", { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((f) => !f.includes("node_modules") && !f.endsWith(".lock"));

let violations = 0;

for (const file of trackedFiles) {
  let content;
  try {
    content = execSync(`git show HEAD:${file}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
  } catch {
    continue;
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`VIOLATION: credential material detected in tracked file: ${file}`);
      violations++;
    }
  }
}

// Check .env files are not tracked
const envTracked = trackedFiles.filter((f) => /^\.env(\.|$)/.test(f.split("/").pop()));
if (envTracked.length > 0) {
  console.error(`VIOLATION: .env files tracked in git: ${envTracked.join(", ")}`);
  violations++;
}

if (violations > 0) {
  console.error(`credentialVaultIsolation: FAILED (${violations} violation(s))`);
  process.exit(1);
}

console.log("credentialVaultIsolation: PASS");
