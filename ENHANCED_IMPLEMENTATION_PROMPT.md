# R3 v4 - Priority #1-4 Implementation Master Prompt
## Senior-level Architecture & Implementation Directive

### CONTEXT
Project: R3 v4 - AI-Native Browser DAW
Stack: React/Vite Frontend | Express/tRPC Backend | PostgreSQL | pnpm monorepo
Objective: Implement 4 production priorities with zero tolerance for guessing

### YOUR ROLE
You are acting as:
  • Senior Systems Architect
  • Principal Software Engineer
  • DevOps & Infrastructure Engineer
  • QA & Test Automation Engineer
  • Code Reviewer & Security Auditor

### MANDATORY WORKFLOW (NON-NEGOTIABLE)

#### PHASE 1: COMPREHENSIVE ANALYSIS (Before any changes)
  □ Inventory all project files
  □ Identify all direct dependencies between files
  □ Map indirect dependencies (3-level deep)
  □ Catalog all configuration files (.env, tsconfig.json, drizzle.config.ts, etc.)
  □ Document all external integrations (PostgreSQL, bcrypt, tRPC, Stripe)
  □ Identify all build/deployment systems
  □ List all existing tests
  □ Document current state of each priority

#### PHASE 2: DETAILED REVIEW (For each target file)
  1. Read the target file completely
  2. Read all directly related files
  3. Read all indirectly dependent files
  4. Identify all imports/exports
  5. Trace all function calls to/from target
  6. Identify potential side effects
  7. Document current behavior
  8. Create change-impact analysis

#### PHASE 3: CHANGE PLANNING (Detailed design)
  1. For each priority, create:
     - Exact file modifications (line-by-line)
     - Exact code changes (copy-paste ready)
     - Database schema changes (if any)
     - Configuration changes
     - Breaking changes or compatibility issues
     - Rollback procedure for each change
  2. Validate no conflicts between priorities
  3. Identify implementation order (dependencies)
  4. Create detailed error scenarios and handling

#### PHASE 4: IMPLEMENTATION SCRIPT (Production-grade Bash)
```bash
  #!/bin/bash
  set -Eeuo pipefail
  
  # Requirements:
  • Error handling (trap, set -E)
  • Backup creation (timestamped)
  • Dry-run mode (--dry-run flag)
  • Validation mode (--validate flag)
  • Detailed logging (to file + console)
  • Permission checks
  • Prerequisite validation
  • Idempotent operations
  • Post-change verification
  • Rollback on failure
  • Summary report
```

#### PHASE 5: VALIDATION (Comprehensive testing)
  ☐ Syntax validation (TypeScript, JSON, YAML)
  ☐ Dependency resolution (no conflicts)
  ☐ Import/export validation (no broken references)
  ☐ Configuration validation (env vars, secrets)
  ☐ Database connectivity (read/write tests)
  ☐ API endpoint testing (manual curl tests)
  ☐ Security regression testing
  ☐ Performance baseline (latency measurements)
  ☐ Build system validation
  ☐ Test suite execution
  ☐ Integration testing (end-to-end)

#### PHASE 6: ROLLBACK PROCEDURE
  □ Document exact revert steps for each change
  □ Create rollback script
  □ Test rollback on staging
  □ Verify no data loss
  □ Confirm system returns to previous state

#### PHASE 7: DOCUMENTATION
  □ Detailed implementation report
  □ File-by-file change log
  □ Configuration changes documentation
  □ Testing results
  □ Known issues and workarounds
  □ Future improvements identified

### QUALITY GATES (BEFORE EXECUTION)
  ☐ All analysis complete and documented
  ☐ No ambiguities or unknowns
  ☐ All dependencies identified
  ☐ All side effects documented
  ☐ Implementation order confirmed safe
  ☐ Rollback strategy validated
  ☐ Emergency contacts identified

### MUST-VALIDATE DURING IMPLEMENTATION
  • Syntax errors in all modified files
  • Dependency conflicts in package management
  • Database migrations run successfully
  • API endpoints respond correctly
  • Authentication/authorization works
  • No broken imports or circular dependencies
  • Environment variable requirements met
  • Permission levels correct
  • No performance regressions
  • No security vulnerabilities introduced
  • All tests pass
  • No data loss

### STOP CONDITIONS (Pause and report)
  STOP if:
    • Any requirement is ambiguous
    • Any dependency is unclear
    • Any file modification is questionable
    • Any potential breaking change exists
    • Any rollback scenario fails
    • Any validation fails
    • Any test fails
    • Any security concern arises

Report STOP with:
    • Exact issue description
    • Required information to proceed
    • Risk assessment
    • Recommendation

### DELIVERABLES
  1. Architecture Analysis Document
  2. Dependency Map (visual or text)
  3. Change Impact Report
  4. Implementation Bash Script
  5. Validation Procedures
  6. Rollback Procedures
  7. Final Verification Checklist
  8. Implementation Report (after execution)
  9. Test Results
 10. Known Issues & Workarounds

