---
name: discover-skills
description: Audit R3 v4's current work state and recommend Claude Skills to build. Use when the user asks what skills to create, wants to automate recurring workflows, or says "what skills should I build."
disable-model-invocation: true
---

# Discover Skills for R3 v4

Look at the active feature queue, recent session patterns, and recurring manual
steps in this project. Then recommend which Claude Skills to build next.

For each recommendation, provide:

1. **Skill name** — the `/slash-command` it would create
2. **Trigger description** — when Claude should auto-load it (≤250 chars)
3. **What it automates** — the specific manual steps it replaces
4. **Frequency** — estimated sessions per week where it saves time
5. **Starter SKILL.md** — a complete, ready-to-paste file

Derive candidates fresh from the current project state. Starting points to
consider (not a fixed menu — discard any that aren't relevant right now):

- `llpte-node-scaffold` — generate a new pipeline node with boilerplate +
  layer-by-layer Vitest stubs
- `patch-gen` — produce a dry-run Python patch script from a file path +
  anchor description
- `vitest-scaffold` — generate the full `__tests__/` file for a given source
  file across all required LLPTE layers
- `auth-audit` — verify store imports, middleware mounts, and redirect targets
  across the auth surface
- `prd-decompose` — break a PRD section into a sequenced implementation task
  list with file targets and test requirements
