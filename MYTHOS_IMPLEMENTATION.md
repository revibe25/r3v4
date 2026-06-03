# Mythos Defense Implementation Guide
**How to use MYTHOS_DEFENSE_2026-06-01.md and MYTHOS_QUICK_REF.md in your Agi-Suite workflow**

---

## 📋 What you now have

| Document | Purpose | Audience |
|----------|---------|----------|
| **MYTHOS_DEFENSE_2026-06-01.md** | Authoritative security findings register (649 lines) | Architects, auditors, release leads |
| **MYTHOS_QUICK_REF.md** | Developer checklist during code review (227 lines) | Developers, PR reviewers |

Both live in your repo root (committed, versioned, reviewed via WIRE protocol).

---

## 🚀 Getting started (15 min setup)

### Step 1: Copy into your repo

```bash
cd ~/Stable  # or your monorepo root

# Copy the main defense document
curl https://[your-storage]/MYTHOS_DEFENSE_2026-06-01.md > MYTHOS_DEFENSE.md

# Copy the quick reference
curl https://[your-storage]/MYTHOS_QUICK_REF.md > docs/SECURITY_CHECKLIST.md

# Commit with proper attribution
git add MYTHOS_DEFENSE.md docs/SECURITY_CHECKLIST.md
git commit -m "feat: add Mythos Security Defense and developer checklist

- Consolidates 10 fixed findings, 5 deferred findings with owners/triggers, 6 blocking audit gaps
- Follows Mythos threat model (barrier vs friction, N-day SLA, Mythos-class re-pricing)
- Quick reference for pre-commit, pre-merge, pre-release checks
- Deferred findings tracked with explicit owners and ISO date triggers"
```

### Step 2: Set up CI gate (GitHub Actions example)

Create `.github/workflows/security-check.yml`:

```yaml
name: Security Findings Gate

on: [pull_request]

jobs:
  security-checklist:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Block if MYTHOS_DEFENSE.md references blocking findings without resolution
      - name: Check for unresolved blockers
        run: |
          set -e
          
          # Exit 1 if any line contains "🔴 BLOCKING" without a corresponding ✅
          if grep -q "🔴 BLOCKING" MYTHOS_DEFENSE.md && \
             ! grep -q "Status.*BLOCKED.*resolved" MYTHOS_DEFENSE.md; then
            echo "❌ Audit gaps still open (🔴 BLOCKING). Cannot merge."
            exit 1
          fi
          
          echo "✅ Security findings tracked and accounted for"
```

### Step 3: Add to PR template

In `.github/pull_request_template.md`, add:

```markdown
## Security & Integrity

- [ ] **No auth removed or weakened** (verify with `git diff` for `requireUser`, `ctx.user.id`)
- [ ] **All DB queries have userId filter** (check `where(eq(table.userId, ctx.user.id))`)
- [ ] **No new secrets in code** (grep for `SECRET`, `PASSWORD`, `API_KEY`)
- [ ] **No user input unescaped into LLM prompts**
- [ ] **Reviewed:** [MYTHOS_QUICK_REF.md](../docs/SECURITY_CHECKLIST.md) pre-commit checklist

**If security-related:**
- [ ] New finding? → Add to MYTHOS_DEFENSE.md with owner/trigger
- [ ] Fixing a finding? → Mark as ✅ in MYTHOS_DEFENSE.md with commit hash
- [ ] Deferred something? → Ensure owner + trigger + interim control in MYTHOS_DEFENSE.md
```

### Step 4: Add to release checklist

In your release notes template:

```markdown
# Release Checklist v4.0.0

## Security Gate (MANDATORY)

Before tagging and pushing:

- [ ] All 6 audit gaps (G-01–G-06 in MYTHOS_DEFENSE.md) resolved
- [ ] No blocking findings remain
- [ ] All deferred findings have owner + trigger date + interim control
- [ ] N-day findings past deadline? Escalate or delay release
- [ ] MYTHOS_DEFENSE.md has been updated and committed
- [ ] If F-10 (prompt injection) unresolved and real API wired → 🔴 BLOCK

Then proceed to testing, staging, production deployment.
```

---

## 📖 How to use during development

### During code review (5 min per PR)

1. **Before reading code:** Open MYTHOS_QUICK_REF.md and scan the relevant checklist:
   - If it's auth-related → use "Auth checklist for code review"
   - If it touches the database → use "Database defense-in-depth checklist"
   - If it touches LLM → use "LLM input checklist"

2. **While reviewing:** Ask the questions in "Questions to ask in PR review"

3. **Finding an issue?** Check MYTHOS_DEFENSE.md:
   - Is it already listed? Add comment linking to the entry.
   - Is it new? Grade it using "Severity decision tree" and either fix in this PR or add to MYTHOS_DEFENSE.md as a finding.

### When a Dependabot alert fires

1. Open MYTHOS_QUICK_REF.md → "N-day finding rules" table
2. Check: is the advisory public? Is there a patch?
3. Use "Severity decision tree" to grade (independently, before reading Dependabot's grade)
4. Decide: fix now, defer with owner/trigger, or escalate
5. Update MYTHOS_DEFENSE.md with the finding

### Before committing any change

Use the pre-commit checklist from MYTHOS_QUICK_REF.md (copy-paste):

```bash
# Before git commit, run:
cat docs/SECURITY_CHECKLIST.md | grep -A 20 "Pre-commit checklist"

# Check each box mentally:
# ☐ No authentication checks removed or weakened
# ☐ Every DB query filtering by userId...
# ... etc

# If you checked all, proceed. If not, fix first.
```

### Before merging a PR

Check the "Pre-merge checklist" in MYTHOS_QUICK_REF.md:
- Is this fixing a runtime Medium/High finding? → Must be in this PR
- Is this touching N-day CVE code? → Escalate if not ready

---

## 🔄 Maintenance workflow (weekly/monthly)

### Weekly (every Monday)

Review deferred findings approaching their trigger date:

```bash
cd ~/Stable
grep "Revisit trigger:" MYTHOS_DEFENSE.md | grep -E "2026-06-0[0-7]|2026-06-1[0-4]"
```

If any trigger is within 7 days:
- Add to sprint / to-do list
- Assign work to the owner
- Move from "deferred" to "in progress"

### Monthly (first day of month)

1. **Update the document timestamp** at the bottom of MYTHOS_DEFENSE.md
2. **Review resolved findings:** Any deferred finding that's now fixed? Move to "Fixed this cycle" section and add the commit hash.
3. **Audit gap status:** Any gaps closed? Remove from "MUST RESOLVE" section and move to findings.
4. **Dependency bump:** If `pnpm update` was run, check for new CVEs (see "When a Dependabot alert fires" above).
5. **Commit the update:**
   ```bash
   git add MYTHOS_DEFENSE.md
   git commit -m "chore: monthly security findings review (2026-06-01)
   
   - Reviewed deferred findings, none yet approaching trigger dates
   - Audit gaps G-01–G-06 remain blocking
   - No new findings since last month"
   ```

### Before every release

**Run the release checklist:**

```bash
# 1. Check audit gaps resolved
grep "### 🔴 G-" MYTHOS_DEFENSE.md
# → If any remain, block release with: "Cannot ship until audit gaps G-01 through G-XX are closed"

# 2. Check blocking findings
grep "Status.*Blocked" MYTHOS_DEFENSE.md
# → If any exist, block release

# 3. Check N-day triggers
TODAY=$(date +%Y-%m-%d)
grep "Revisit trigger.*202[0-9]-" MYTHOS_DEFENSE.md | \
  while read line; do
    if [[ $line < "2026-$TODAY" ]]; then
      echo "❌ N-day finding past trigger date: $line"
    fi
  done

# 4. Update MYTHOS_DEFENSE.md with release notes
# (See "Release documentation" below)

# 5. Tag and merge
git tag -a v4.0.1 -m "$(cat MYTHOS_DEFENSE.md | head -50)"
```

---

## 📝 Adding new findings

When you discover a security issue (code review, audit, Dependabot, bug report):

### If it's a quick fix (Low severity, clear path)

1. **Fix in the PR immediately** (don't defer)
2. **Add to MYTHOS_DEFENSE.md** under "Fixed this cycle":
   ```markdown
   ### ✅ NEW-ID | Brief title — **FIXED**
   
   **File:** `path/to/file.ts`  
   **Status:** Fixed and merged  
   **Severity (ours):** Low  
   **Surface:** Runtime  
   
   **Issue:** One-line description
   
   **Mitigation applied:** How you fixed it
   
   **Verification:** How to test it
   ```

### If it requires design work (Medium/High, non-trivial)

1. **Don't merge until fixed** (unless it's blocked by architecture decision)
2. **Add to MYTHOS_DEFENSE.md** under "Deferred findings":
   ```markdown
   ## FINDING-ID | Brief title
   
   **Status:** 📋 Deferred  
   **Advisory status:** <internal finding | public | under embargo>  
   **Advisory published:** <date or N/A>  
   **Surface:** <runtime | dev-build-isolated | ...>  
   **Severity (ours):** <High | Medium | Low>  
   
   **Issue:**
   
   [1-2 paragraphs: what's wrong, why it matters]
   
   **Mythos-class re-price:** [What "attacker would need to..." claims no longer hold]
   
   **Interim control:** [Barrier-class named, or friction-only with risk acceptance]
   
   **Why deferred:** [Concrete reason, not "post-MVP"]
   
   **Revisit trigger:** <ISO date YYYY-MM-DD or event with calendar date>  
   **Owner:** @handle  
   
   **Fix path:**
   
   [Code snippet or step-by-step]
   ```

3. **Commit and review via WIRE protocol** (not direct merge)

### If it's a Dependabot alert

1. **Use "When a Dependabot alert fires" workflow above**
2. **Grade independently** using "Severity decision tree"
3. **Check N-day rules:**
   - If public + patch exists + High/Critical → fix ≤30 days
   - If public + patch exists + Medium → fix ≤90 days (unless friction-only interim exists)
   - If not public → normal triage
4. **Update MYTHOS_DEFENSE.md** with the finding (either fixed, deferred, or blocked)

---

## 🎯 Release documentation example

When you release v4.1.0, update MYTHOS_DEFENSE.md header:

```markdown
# Mythos Security Defense — R3v4 DAW Server
**Live threat model defense document | Updated 2026-07-15**

---

## Status Summary (as of 2026-07-15)

| Category | Count | Status |
|----------|-------|--------|
| **Fixed in v4.1.0** | 3 | ✅ Merged (C-01, C-02, F-10) |
| **Fixed earlier** | 10 | ✅ v4.0.0 |
| **Deferred (with owner/trigger)** | 3 | 📋 Active tracking (C-03, F-09, C-05) |
| **Audit gaps (resolved in v4.1.0)** | 6 | ✅ G-01 through G-06 closed |
| **Open deferred checks** | 2 | ⏰ Revisit pending |

[rest of document with updated sections]
```

---

## 🔐 Integration with WIRE protocol

If you use a WIRE-style engineering protocol (read-before-write, versioned edits, reversible changes):

1. **Before editing MYTHOS_DEFENSE.md:**
   ```bash
   # 1. Create a backup
   cp MYTHOS_DEFENSE.md MYTHOS_DEFENSE.md.2026-07-15.bak
   
   # 2. Make changes in Python/editor with line-by-line edits
   # (Follow WIRE: assert count == 1 per change, timestamp backups)
   
   # 3. After changes, verify no findings are "unmanaged"
   grep -E "Status.*TODO|Revisit trigger.*TBD" MYTHOS_DEFENSE.md && \
     echo "❌ Unmanaged findings detected" || \
     echo "✅ All findings have owner/trigger/interim"
   ```

2. **Commit atomically:**
   ```bash
   git add MYTHOS_DEFENSE.md
   git commit -m "sec: resolve findings C-01, C-02, audit gaps G-01–G-06
   
   [detailed commit message with what was resolved and verification steps]"
   ```

---

## 📞 Escalation & on-call

If you discover a finding you can't classify:

1. **Escalate to:** @3R (listed as on-call security owner in MYTHOS_DEFENSE.md)
2. **Include:**
   - File path + line number
   - Why you think it's a security issue
   - Mythos threat model question (barrier vs friction? Attacker-controlled?)
3. **Owner will:**
   - Grade it using Mythos criteria
   - Decide: fix now / defer / block
   - Add to MYTHOS_DEFENSE.md with reasoning

---

## ✅ Validation checklist (for release lead)

Before tagging a release:

- [ ] MYTHOS_DEFENSE.md has been reviewed and committed
- [ ] All blocking findings (🔴) are either fixed or have an explicit plan
- [ ] All deferred findings have: owner name (not team), trigger date (ISO, not event), interim control (barrier-class or risk-accepted friction)
- [ ] No finding is missing owner/trigger/interim (unmanaged)
- [ ] N-day findings are either fixed or have barrier-class interim + date ≤90 days (Medium) or ≤30 days (High/Critical)
- [ ] Audit gaps (G-01–G-06) are either closed or explicitly tracked with closure plan
- [ ] Release notes mention security improvements in this release
- [ ] CI passed (including security gate check)

If all ✅, proceed to merge/tag. If any ❌, escalate to architecture/security owner.

---

## 📚 Quick links

| Document | Location | Update freq. |
|----------|----------|------------|
| **MYTHOS_DEFENSE.md** | `~/Stable/MYTHOS_DEFENSE.md` | Weekly (findings added), monthly (review), before release |
| **MYTHOS_QUICK_REF.md** | `~/Stable/docs/SECURITY_CHECKLIST.md` | Quarterly (or when Mythos threat model updates) |
| **Deferred findings table** | MYTHOS_DEFENSE.md, "Deferred findings currently live" | Weekly |
| **Release gate** | MYTHOS_DEFENSE.md, "Checklist for release" | Every release |

---

**Document version:** 1.0 (2026-06-01)  
**Effective for:** R3v4 DAW Server and all future versions  
**Maintained by:** @3R  
**Last reviewed:** 2026-06-01
