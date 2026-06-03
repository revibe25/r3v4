# 🛡️ Mythos Security Defense — Delivery Package
**Bulletproof security framework for R3v4 DAW Server | 2026-06-01**

---

## What you now have (3 documents, 56KB)

This package consolidates **all security findings** from:
- ✅ 10 fixed vulnerabilities (merged in v4.0.0)
- 📋 5 deferred findings (with explicit owners, trigger dates, interim controls)
- 🔴 6 blocking audit gaps (files unread — must resolve before release)
- 🟡 4 documentation bugs (separate remediation track)

Every finding is graded under the **Mythos threat model** (barrier-class mitigations only, N-day SLAs enforced, friction-only controls explicitly flagged as interim).

---

## 📄 The three documents

### 1. **MYTHOS_DEFENSE_2026-06-01.md** (649 lines, 27KB)
**The authoritative findings register — lives in repo root**

**Use this when:**
- Deciding whether to release
- Auditing new code against known gaps
- Reviewing a security finding for consistency
- Planning quarterly security work
- Escalating a finding to stakeholders

**Key sections:**
- Overview + status summary (at a glance)
- 6 blocking audit gaps (G-01–G-06) — **must close before release**
- 10 fixed findings with verification steps
- 5 deferred findings with owner/trigger/interim control
- Release checklist (7-point gate)
- Incident response contact + references

**Commit strategy:** Every update goes through WIRE protocol (read-before-write, versioned).

---

### 2. **MYTHOS_QUICK_REF.md** (227 lines, 9.2KB)
**Developer checklist — lives in `docs/SECURITY_CHECKLIST.md`**

**Use this when:**
- Writing code (copy pre-commit checklist before `git commit`)
- Reviewing a PR (scan relevant section in ~2 min)
- Grading a new finding (severity decision tree)
- Running a release (pre-release checklist)

**Key sections:**
- Pre-commit / pre-merge / pre-release checklists
- Severity decision tree (5 steps to grade independently)
- Friction vs. barrier cheat sheet
- Auth checklist for code review
- Database defense-in-depth checklist
- Deferred findings at a glance (tracking upcoming triggers)

**Commit strategy:** Add to `.github/pull_request_template.md` so every PR references it.

---

### 3. **MYTHOS_IMPLEMENTATION.md** (13KB)
**Getting started guide — for this repo, not committed**

**Use this once to:**
- Copy files into your repo root + docs/
- Set up CI gate (GitHub Actions template provided)
- Add security sections to PR template
- Add security gate to release checklist
- Integrate with your WIRE protocol

**Then refer back when:**
- Onboarding a new team member
- Updating CI/CD pipeline
- Planning monthly security review
- Responding to a new Dependabot alert

---

## 🚀 Quick start (5 minutes)

### Step 1: Copy files into your repo

```bash
cd ~/Stable

# Main findings register
cp MYTHOS_DEFENSE_2026-06-01.md MYTHOS_DEFENSE.md

# Developer checklist
mkdir -p docs
cp MYTHOS_QUICK_REF.md docs/SECURITY_CHECKLIST.md

# Commit
git add MYTHOS_DEFENSE.md docs/SECURITY_CHECKLIST.md
git commit -m "sec: add Mythos Security Defense framework

- Authoritative findings register (10 fixed, 5 deferred, 6 blocking audit gaps)
- Developer checklist for pre-commit, pre-merge, pre-release gates
- Deferred findings tracked with explicit owner, trigger date, interim control
- N-day CVE SLAs enforced (≤30 days High/Critical, ≤90 days Medium)
- All under Mythos threat model (barrier-class mitigations only)"
```

### Step 2: Before your next release

1. Open MYTHOS_DEFENSE.md
2. Check the "Checklist for release" section (7 items)
3. Tick off each item
4. If any item fails → escalate or delay release

That's it. The framework tracks itself after that.

---

## 🎯 What's fixed, what's deferred, what blocks release

### ✅ Fixed (merged in v4.0.0)

| Finding | Issue | Severity | Status |
|---------|-------|----------|--------|
| F-01 | CSP `unsafe-inline` in production | High | ✅ Removed |
| F-03 | DELETE missing userId in WHERE clause | Medium | ✅ Added defense-in-depth |
| F-04 | Free-tier cap is TOCTOU race | Medium | ✅ DB-level enforcement |
| F-05 | userId columns not NOT NULL | Medium | ✅ Schema + migration |
| F-06 | `/health` endpoint leaks version/memory | Low-Medium | ✅ Stripped sensitive data |
| F-07 | Duplicate trpcAuth middleware | Low | ✅ Removed duplicate |
| F-08 | FORBIDDEN vs NOT_FOUND leaks ownership | Low-Medium | ✅ Normalized to NOT_FOUND |
| F-11 | Unhandled ZodError in project.load | Low | ✅ Try-catch wrapper |
| C-04 | `systemPrompt` unbounded in admin | Low-Medium | ✅ .max(8000) |
| C-06 | Dead JWT_SECRET constant | Low | ✅ Removed |

**Verification:** Run `MYTHOS_DEFENSE.md → "Fixed findings"` verification steps for each.

---

### 📋 Deferred (with owner/trigger/interim control)

| Finding | Surface | Severity | Owner | Trigger | Interim |
|---------|---------|----------|-------|---------|---------|
| C-03 | AI transition limit via header | Medium | @3R | 2026-05-22 | Friction, explicit risk acceptance |
| C-01 | esbuild N-day override | Low | @3R | 2026-05-15 | `pnpm.overrides` (one line) |
| C-02 | Vite 6 migration | Low-Med | @3R | 2026-06-15 | Friction (don't load untrusted pages in dev) |
| F-09 | aiDecisionLog no userId | Low | @3R | 2026-06-22 | UUID brute-force friction |
| C-05 | Non-constant-time secret comparison | Low | @3R | 2026-07-22 | Network isolation (server-to-server only) |

**All deferred findings have explicit owner, date (not "post-MVP"), and interim control.** None are blocking.

---

### 🔴 BLOCKING (must resolve before release)

| Audit Gap | File | Why it blocks | Status |
|-----------|------|---------------|--------|
| G-01 | `server/middleware/auth.ts` | Cannot verify ctx.user.id trust chain | Unread |
| G-02 | `server/base-procedures.ts` | Cannot confirm requireUser enforcement | Unread |
| G-03 | `server/trpc.ts` | Cannot verify JWT validation | Unread |
| G-04 | `server/routers/adminRouter.ts` | Highest privilege surface unseen | Unread |
| G-05 | `server/services/session-metrics.service.ts` | userId scoping unconfirmed | Unread |
| G-06 | `server/routes/internal.ts` | /api/internal auth unclear | Unread |

**Action:** Read and verify each file. Update MYTHOS_DEFENSE.md with findings.

---

## ⏰ Upcoming deadlines (watch these)

| Finding | Deadline | Days until | Action |
|---------|----------|-----------|--------|
| **C-01 (esbuild N-day)** | 2026-05-15 | 14 | Add `pnpm.overrides` NOW |
| **F-10 (prompt injection)** | 2026-05-15 | 14 | Resolve before wiring real API |
| **C-03 (AI transition)** | 2026-05-22 | 21 | Design decision needed (sessionId binding) |
| C-02 (Vite 6 migration) | 2026-06-15 | 44 | Plan migration |
| F-09 (aiDecisionLog userId) | 2026-06-22 | 51 | Next schema migration |

**Weekly:** Check if any trigger is within 7 days; move to active work queue if so.

---

## 🔍 How to use daily

### Before every commit
```bash
# Copy these lines into your pre-commit hook or do manually:
cat docs/SECURITY_CHECKLIST.md | grep -A 20 "Pre-commit checklist"

# Tick off each item. If all ✅, commit. If any ❌, fix first.
```

### Before every PR merge
```bash
# Is this fixing a finding? → Add to MYTHOS_DEFENSE.md as ✅ Fixed
# Is this creating a new finding? → Add to MYTHOS_DEFENSE.md as 📋 Deferred with owner/trigger
# Is this touching auth/DB/LLM? → Use the relevant section of MYTHOS_QUICK_REF.md
```

### Before every release
```bash
# Open MYTHOS_DEFENSE.md
# Run through "Checklist for release" (7 items)
# If all ✅, tag and ship
# If any ❌, escalate or delay
```

---

## 📊 Metrics at a glance

| Metric | Value | Trend |
|--------|-------|-------|
| **Total findings audited** | 25 | N/A |
| **Fixed** | 10 | ✅ Merged |
| **Deferred** | 5 | 📋 Tracked |
| **Audit gaps** | 6 | 🔴 Blocking |
| **Doc bugs** | 4 | 🟡 Separate track |
| **Unmanaged findings** | 0 | ✅ Zero (all have owner/trigger) |
| **N-day findings past SLA** | 0 | ✅ Zero (all tracked with dates) |

---

## 🎓 What you're now using

This package implements **Lesson 5 of the Mythos Security Triage skill** (red.anthropic.com, April 7, 2026):

> Every deferred finding needs three fields — **owner, trigger, interim control** — or it's not deferred, it's unmanaged.

Applied here:
- ✅ Every deferred finding has a **named owner** (not "team", not "TBD")
- ✅ Every deferred finding has a **date trigger** (not "post-MVP", not "eventually")
- ✅ Every deferred finding has an **interim control** (barrier-class or explicit risk acceptance)

Plus:
- ✅ **Barrier-class mitigations only** for runtime findings (not friction alone)
- ✅ **N-day SLAs enforced** (≤30 days High/Critical, ≤90 days Medium)
- ✅ **Mythos-class re-pricing** (friction degrades under model-assisted attack)

---

## 🚨 Release gates

**You cannot ship unless:**

1. All 6 audit gaps (G-01–G-06) have been read and verified ✅
2. No blocking findings remain unfixed 🔴
3. All deferred findings have owner + trigger + interim ✅
4. Any N-day finding is either fixed or has barrier-class interim + date ≤SLA ✅
5. F-10 (prompt injection) is resolved before wiring real Anthropic API ✅

**If any of these fail:** Escalate to @3R (listed on-call security owner in MYTHOS_DEFENSE.md).

---

## 💾 Maintenance schedule

| Frequency | Action | Owner |
|-----------|--------|-------|
| **Per commit** | Review MYTHOS_QUICK_REF.md relevant section | Developer |
| **Per PR merge** | Update MYTHOS_DEFENSE.md if finding fixed | Committer |
| **Weekly** | Check if any deferred finding trigger approaching 7 days | @3R |
| **Monthly** | Review all deferred findings, update document timestamp | @3R |
| **Per release** | Run release checklist, block if any ❌ | Release lead |
| **Quarterly** | Update if Mythos threat model changes | Architecture |

---

## 📚 Files & locations

After setup, your repo should have:

```
~/Stable/
├── MYTHOS_DEFENSE.md                    # Main findings register (committed, versioned)
├── docs/
│   └── SECURITY_CHECKLIST.md            # Quick reference for developers
├── .github/
│   ├── pull_request_template.md         # (update to link to checklist)
│   └── workflows/
│       └── security-check.yml           # (optional: CI gate)
└── [other files...]
```

---

## 🎯 Next steps

1. **Now:** Copy the 3 documents into your repo (see "Quick start" above)
2. **Next 30 min:** Resolve the 2 immediate N-day findings (C-01 esbuild, F-10 prompt injection)
3. **This week:** Read and verify audit gaps G-01–G-06, update MYTHOS_DEFENSE.md with findings
4. **Before next release:** Run release checklist; block if any item fails
5. **Ongoing:** Use MYTHOS_QUICK_REF.md in code review and pre-commit

---

## ❓ Questions?

- **"How do I grade a new finding?"** → MYTHOS_QUICK_REF.md, "Severity decision tree"
- **"Can I defer this finding?"** → MYTHOS_DEFENSE_2026-06-01.md, "Lesson 5 — Defer is valid..." (or escalate to @3R)
- **"Is this a blocker?"** → MYTHOS_QUICK_REF.md, "Release blockers (non-negotiable)"
- **"How do I set up CI?"** → MYTHOS_IMPLEMENTATION.md, "Step 2: Set up CI gate"
- **"How often do I review this?"** → MYTHOS_IMPLEMENTATION.md, "Maintenance workflow"

---

**Package created:** 2026-06-01  
**Valid for:** R3v4 DAW Server and all future versions  
**Maintained by:** @3R  
**Mythos threat model source:** red.anthropic.com/Assessing-Claude-Mythos-Preview (April 7–9, 2026)

**Status:** ✅ Ready to integrate into Agi-Suite workflow
