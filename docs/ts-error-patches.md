"""
patches/ts-error-patches.md

Manual / automated patch targets for §SES.17 TypeScript compile errors
that exist in files the installer cannot fully rewrite (originals unknown).

Run this file via:  python3 r3-fix-ses.py --patch-ts

Errors addressed:
  [A] server/middleware/feature-gate.ts(198,65)  TS2345 — unknown → Meta
  [B] server/services/arrangement.service.ts     TS7016 — missing @types/pg
  [C] server/services/arrangement.service.ts     TS2345 — Drizzle table type mismatch
"""

"""
──────────────────────────────────────────────────────────────────────────────
[A] server/middleware/feature-gate.ts  line 198
──────────────────────────────────────────────────────────────────────────────

ERROR:
  error TS2345: Argument of type 'unknown' is not assignable to parameter
  of type 'Meta | undefined'.

FIX — cast the unknown value before passing it:

  FIND (approximately line 198):
    someFunction(unknownValue)
    -- or whatever form is on line 198 that passes an `unknown` as Meta --

  Determine the exact expression at (198,65) with:
    sed -n '195,202p' server/middleware/feature-gate.ts

  Then apply one of these casts:
    a) (value as Meta | undefined)
    b) (value satisfies Record<string, unknown> ? value as Meta : undefined)

  Example if the call looks like:
    logger.info(ctx.meta, "gate check");
  Fix:
    logger.info(ctx.meta as Meta | undefined, "gate check");

  If you import Meta from the logger/trpc package, ensure it is imported:
    import type { Meta } from '../trpc';   // adjust path as needed

──────────────────────────────────────────────────────────────────────────────
[B] server/services/arrangement.service.ts  TS7016 — @types/pg missing
──────────────────────────────────────────────────────────────────────────────

ERROR:
  error TS7016: Could not find a declaration file for module 'pg'.

FIX — install the type package:
  pnpm add -D @types/pg

  Verify: pnpm exec tsc --noEmit --project server/tsconfig.json 2>&1 | grep pg
  Should show 0 matches after install.

  If pg is imported as an ESM default in the service:
    import pg from 'pg';
  And tsc still warns, add a triple-slash reference at the top of the file:
    /// <reference types="pg" />
  Or use the named import style:
    import { Pool, Client } from 'pg';

──────────────────────────────────────────────────────────────────────────────
[C] server/services/arrangement.service.ts  TS2345 — Drizzle table type mismatch
──────────────────────────────────────────────────────────────────────────────

ERROR (repeated across lines 70, 97, 98, 112, 113, 133, 145, 157):
  error TS2345: Argument of type
    'PgTableWithColumns<{ name: "arrangements"; ... }>'
  is not assignable to parameter of type
    'PgTable<TableConfig>' or 'SQL<unknown> | PgTable<TableConfig> | ...'

ROOT CAUSE:
  Drizzle ORM ≥ 0.39 tightened the `PgTable` generic. Code that previously
  passed a Drizzle table directly to .select()/.from()/.update()/.delete()
  now requires the table to come from the same drizzle-orm version that the
  db client was instantiated with.

FIX — use the table reference exactly as exported from the schema:

  1. Ensure arrangement.service.ts imports from the correct schema path:
       import { arrangements } from '../db/schema';
     NOT from a re-export that adds extra wrapping.

  2. For each failing call, replace any re-assigned or cast table variable
     with the direct schema import:
       // BAD
       const tbl = getArrangementsTable() as PgTable<TableConfig>;
       db.select().from(tbl)
       // GOOD
       db.select().from(arrangements)

  3. If the service uses a helper that accepts PgTable<TableConfig>, update
     the helper's parameter type to the inferred type of the table:
       import type { arrangements } from '../db/schema';
       type ArrangementsTable = typeof arrangements;

       function helper(table: ArrangementsTable) { ... }

  4. For the TS2769 "no overload" errors on .update() / .delete():
     Drizzle's update/delete require the table literal, not a variable typed
     as the abstract PgTable.  Pass the import directly:
       db.update(arrangements).set(data).where(eq(arrangements.id, id))

  Run tsc after each change to confirm the error count drops.
"""
