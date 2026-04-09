---
paths:
  - "scripts/**"
  - "**/*.py"
---

# Patch Script Standards

Every patch delivered as a Python script. No exceptions.

## Required Behavior
- `--dry-run` is the DEFAULT — `--apply` required to write anything
- Per-file `.bak` backup written before any write
- Anchor-text replacement with occurrence count validation
  → abort with non-zero exit if count ≠ exactly 1
- `pnpm tsc --noEmit` runs as the final step
- Non-zero exit on any failure — never silently continue

## Required Output
Dry-run prints: file path · anchor found · replacement preview · occurrence count
Apply prints: backup path · bytes written · tsc result

## Forbidden
- Silent failures or partial writes
- Replacing without first confirming occurrence count
- Skipping the tsc verification step
- Any write without a corresponding .bak
