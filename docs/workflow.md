# Workflow Rules
# No `paths` frontmatter — loads unconditionally at every session launch.

## 1 · Interview Before Building

For any new feature or non-trivial change, ask these four questions first.
Wait for my answers. Summarize understanding. Get confirmation. Then code.

- What is the core problem this solves?
- Who is this for — DJ, creator, or both?
- What does success look like (metric / SLA / behavior)?
- What should this NOT do?

Skip only for single-file bug fixes with no API surface changes.

## 2 · Verification Plan First

Before doing any work, state:
- Which files will change and why
- How correctness will be confirmed (tsc, Vitest, manual flow)
- What regression risk exists and how it will be mitigated

## 3 · Self-Review After Every Task

Go back and verify completed work:
- All Hard Guards from root CLAUDE.md respected
- No redundant imports or dead code introduced
- No type errors, auth regressions, or store conflicts
- `pnpm tsc --noEmit` passes clean

## 4 · Read-Before-Write (Wire.txt)

Read every file in the full import graph before any destructive action.
Confirm file contents, occurrence counts, and anchor text first.
Never assume — read, then act.
