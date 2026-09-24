#!/usr/bin/env node
/**
 * Minimal ARIS verifier for Mythos security doc compliance.
 * Reads SECURITY.md and MYTHOS-SKILL-v2.md, checks for incomplete audits, gaps, and blocked findings.
 * Exports results as SARIF/JSON.
 *
 * USAGE:  node agents/verifier.js
 */

import fs from 'fs';
import path from 'path';

// Configurable file paths (relative to project root)
const PROJECT_ROOT = process.cwd();
const SEC_MD = path.join(PROJECT_ROOT, 'SECURITY.md');
const SKILL = path.join(PROJECT_ROOT, 'MYTHOS-SKILL-v2.md');
const SARIF_OUT = path.join(PROJECT_ROOT, 'output/security-findings.sarif.json');

const REQUIRED_DEFERRED_FIELDS = [
  { name: 'Status', aliases: ['status:'] },
  { name: 'Advisory status', aliases: ['advisory status:'] },
  { name: 'Advisory published', aliases: ['advisory published:'] },
  { name: 'Surface', aliases: ['surface:'] },
  { name: 'Severity', aliases: ['severity:', 'our severity:'] },
  { name: 'Mythos-class re-price', aliases: ['mythos-class re-price:'] },
  { name: 'Mitigation class', aliases: ['mitigation class:', 'mitigation:'] },
  { name: 'Why deferred', aliases: ['why deferred:'] },
  { name: 'Interim control', aliases: ['interim control:'] },
  { name: 'Revisit trigger', aliases: ['revisit trigger:'] },
  { name: 'Owner', aliases: ['owner:'] },
  { name: 'Fix', aliases: ['fix:', 'fix'] }
];

// Helper: Check version/attestation consistency in skill doc
function checkVersion(skillFile) {
  const txt = fs.readFileSync(skillFile, 'utf8');
  const version = (txt.match(/Version:.*?(\d+\.\d+)/i) || [])[1];
  if (!version) throw new Error('Skill doc missing version.');
  return version;
}

// Helper: Detect audit surfaces referenced in skill doc but not reviewed in SECURITY.md
function checkSurfaces(skillFile, secFile) {
  const surfaces = [];
  const txt = fs.readFileSync(skillFile, 'utf8');
  // Grep all Markdown table fields like | `surface` |
  const matches = txt.match(/\|\s*`([^`]+)`\s*\|/g) || [];
  for (const m of matches) {
    const f = m.split('`')[1];
    if (f) surfaces.push(f);
  }
  const sec = fs.readFileSync(secFile, 'utf8').toLowerCase();
  // Mark any surface not mentioned in entire security doc (case-insensitive)
  const holes = surfaces.filter(s => !sec.includes(s.toLowerCase()));
  return holes;
}

function hasAnyField(lines, aliases) {
  const normalized = lines.map(line => line.toLowerCase());
  return aliases.some(alias =>
    normalized.some(line => line.includes(alias.toLowerCase()))
  );
}

function extractDeferredFindingName(lines) {
  const heading = lines.find(line => /^###\s+/.test(line));
  return heading?.replace(/^###\s+/, '').trim() || 'Unknown deferred finding';
}

// Helper: Detect deferred findings (blocked) missing required fields
function checkBlockedFindings(secFile) {
  const txt = fs.readFileSync(secFile, 'utf8');
  const blocks = [];
  const lines = txt.split('\n');
  let current = [];
  let inFinding = false;

  for (const line of lines) {
    if (/^###\s+/.test(line)) {
      inFinding = true;
      current = [line];
      continue;
    }

    if (!inFinding) continue;

    current.push(line);

    if (line.trim() === '') {
      const sectionText = current.join('\n');
      if (/^Status:\s*Deferred\b/i.test(sectionText)) {
        const missing = REQUIRED_DEFERRED_FIELDS
          .filter(({ aliases }) => !hasAnyField(current, aliases))
          .map(({ name }) => name);

        if (missing.length > 0) {
          blocks.push({
            finding: extractDeferredFindingName(current),
            missing
          });
        }
      }

      inFinding = false;
      current = [];
    }
  }

  return blocks;
}

// Main function orchestrator
async function main() {
  try {
    // Explicit checks for file existence, for better error reporting
    if (!fs.existsSync(SKILL)) throw new Error('MYTHOS-SKILL-v2.md not found in project root.');
    if (!fs.existsSync(SEC_MD)) throw new Error('SECURITY.md not found in project root.');

    // 1. Version Consistency
    const version = checkVersion(SKILL);

    // 2. Audit surfaces cross-check
    const unreviewedSurfaces = checkSurfaces(SKILL, SEC_MD);

    // 3. Blocked findings
    const blockedFindings = checkBlockedFindings(SEC_MD);

    // 4. Build findings for SARIF
    const findings = [];

    if (unreviewedSurfaces.length > 0) {
      findings.push({
        level: 'error',
        message: `Audit surfaces present in policy but missing in reviewed findings: ${unreviewedSurfaces.join(', ')}`,
        ruleId: 'audit-gap'
      });
    }

    if (blockedFindings.length > 0) {
      blockedFindings.forEach(b => {
        findings.push({
          level: 'error',
          message: `Deferred finding missing required fields: ${b.finding} (missing: ${b.missing.join(', ')})`,
          ruleId: 'defer-incomplete'
        });
      });
    }

    // 5. SARIF-format output
    const sarif = {
      version: '2.1.0',
      runs: [{
        tool: { driver: { name: 'mythos-aris-verifier', version } },
        results: findings.map(f => ({
          level: f.level,
          ruleId: f.ruleId,
          message: { text: f.message }
        }))
      }]
    };

    // 6. Write results
    fs.mkdirSync(path.dirname(SARIF_OUT), { recursive: true });
    fs.writeFileSync(SARIF_OUT, JSON.stringify(sarif, null, 2));

    if (findings.length > 0) {
      findings.forEach(f => console.error(`ERROR: ${f.message}`));
      process.exit(1);
    }

    console.log('PASS: All audit gates closed.');
    process.exit(0);
  } catch (e) {
    console.error('Verifier error:', e?.message || e);
    process.exit(2);
  }
}

// Only execute when run directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file://${process.cwd()}/${process.argv[1]}`) {
  main();
}
