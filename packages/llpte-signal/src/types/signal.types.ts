// packages/llpte-signal/src/types/signal.types.ts
//
// Local re-export shim for shared monorepo types.
//
// WHY A SHIM AND NOT A DIRECT IMPORT:
//   llpte-signal tsconfig has rootDir="./src". Adding shared/auto-level.types.ts
//   to files[] or include[] makes it a compiled input file, which violates
//   rootDir and raises TS6059. A module import (this file's import below) is
//   resolved by the TypeScript compiler but is NOT treated as a project input
//   file — it is exempt from rootDir enforcement.
//
// WHAT IS RE-EXPORTED:
//   Only the three types TrackAnalyzer.ts consumes. Nothing else from shared
//   is exposed into this package's public surface.

export type {
  TrackId,
  TrackSignalSnapshot,
  MixSnapshot,
} from '@r3vibe/shared/auto-level.types';
