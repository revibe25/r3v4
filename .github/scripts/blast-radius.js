#!/usr/bin/env node
/**
 * Mythos blast-radius evaluator
 * Surface: runtime | Action: derived from changed file paths
 * Matrix: runtime × schema_change = high, auth_change = critical, payment_change = critical
 */
import { execSync } from "child_process";
import { writeFileSync } from "fs";

const diff = execSync("git diff --name-only HEAD~1 HEAD", { encoding: "utf8" });
const files = diff.trim().split("\n").filter(Boolean);

const rules = [
  {
    label: "auth_change",
    level: "critical",
    match: (f) =>
      /middleware\/auth|jwt|session.*token|auth\.ts|passport/i.test(f),
  },
  {
    label: "payment_change",
    level: "critical",
    match: (f) => /stripe|billing|subscription|payment/i.test(f),
  },
  {
    label: "schema_change",
    level: "high",
    match: (f) =>
      /drizzle\/migrations|schema\.ts|schema-.*\.ts|\.sql$/i.test(f),
  },
  {
    label: "dependency_update",
    level: "high",
    match: (f) => /pnpm-lock\.yaml|package\.json/i.test(f),
  },
  {
    label: "config_change",
    level: "medium",
    match: (f) => /\.env|railway\.toml|vite\.config|tsconfig/i.test(f),
  },
  {
    label: "code_change",
    level: "low",
    match: () => true, // fallback
  },
];

const order = ["critical", "high", "medium", "low"];
let topLevel = "low";
const triggered = [];

for (const file of files) {
  for (const rule of rules) {
    if (rule.match(file)) {
      triggered.push(`${rule.label}:${file}`);
      if (order.indexOf(rule.level) < order.indexOf(topLevel)) {
        topLevel = rule.level;
      }
      break;
    }
  }
}

console.log(`blast_radius=${topLevel}`);
console.log(`actions=${triggered.join(", ")}`);

// GitHub Actions output
const output = process.env.GITHUB_OUTPUT;
if (output) {
  writeFileSync(output, `level=${topLevel}\nactions=${triggered.join(" | ")}\n`, { flag: "a" });
}

if (["critical", "high"].includes(topLevel)) process.exit(0); // gate workflow handles exit
