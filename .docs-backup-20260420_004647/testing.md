---
paths:
  - "packages/**/*.ts"
  - "packages/**/*.tsx"
  - "**/__tests__/**"
  - "**/*.test.ts"
  - "**/*.spec.ts"
---

# Testing Standards

## Framework: Vitest

## File Location
Tests live in `__tests__/` adjacent to the source file they test.
Never place tests in a root-level test folder.

## Coverage Requirements for LLPTE Features
New pipeline nodes require tests across all architectural layers:
shared types · signal analysis · AI inference · Web Audio execution ·
pipeline orchestration · React hook · UI component

## Definition of Done
A feature is complete only when:
- Tests are green
- `pnpm tsc --noEmit` is clean
- Manual flow is confirmed end-to-end

"Code written" is not done.

## Style
- Test behavior, not implementation details
- One assertion concept per test
- No test should depend on another test's side effects
