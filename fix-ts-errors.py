#!/usr/bin/env python3
"""
R3 v4 - TS Error Fix Script
Fixes all 5 TypeScript errors introduced by launch-prep.py:
  1. multer-s3 missing types -> adds local declaration file
  2. multer-s3 key() params implicitly any -> adds explicit types
  3. analyzeBuffer -> analyzeAudio (correct export name)
  4. RawAudioBuffer.duration was not passed -> now passed
"""

import sys
import os
import subprocess
from pathlib import Path
from datetime import datetime
import shutil

# ── Locate project root ────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
root = SCRIPT_DIR
for _ in range(8):
    if (root / "server").is_dir() and (root / "client").is_dir():
        break
    root = root.parent
else:
    print("ERROR: Cannot locate project root.")
    sys.exit(1)

print("=" * 60)
print("R3 v4 - TS Error Fix")
print("=" * 60)
print(f"Root: {root}")
print()

def backup(path: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest  = path.with_suffix(f".{stamp}.bak")
    shutil.copy2(path, dest)
    return dest

def apply(label: str, path: Path, old: str, new: str) -> bool:
    text = path.read_text()
    if old not in text:
        print(f"  SKIP  {label} (already applied or not found)")
        return False
    bak = backup(path)
    path.write_text(text.replace(old, new, 1))
    print(f"  APPLY {label}")
    print(f"        bak: {bak.name}")
    return True

# ══════════════════════════════════════════════════════════════════════════════
# FIX 1 — multer-s3 type declaration
# Errors: TS7016 (no declaration file), TS7006 (implicit any on key() params)
# Fix: create server/types/multer-s3.d.ts with enough types to satisfy strict
# ══════════════════════════════════════════════════════════════════════════════

print("[1/3] multer-s3 type declarations")

TYPES_DIR = root / "server" / "types"
TYPES_DIR.mkdir(exist_ok=True)

MULTER_S3_DECL = TYPES_DIR / "multer-s3.d.ts"

DECL_LINES = [
    "/**",
    " * server/types/multer-s3.d.ts",
    " *",
    " * Local type declaration for multer-s3 v3.",
    " * multer-s3 v3 ships no bundled types and @types/multer-s3 targets v2.",
    " * These declarations cover exactly what storage-s3.ts uses.",
    " */",
    "",
    "import type { S3Client } from '@aws-sdk/client-s3';",
    "import type { Request } from 'express';",
    "import type { StorageEngine } from 'multer';",
    "",
    "declare namespace multerS3 {",
    "  interface Options {",
    "    s3: S3Client;",
    "    bucket: string | ((req: Request, file: Express.Multer.File, cb: (err: Error | null, bucket: string) => void) => void);",
    "    key: (req: Request, file: Express.Multer.File, cb: (err: Error | null, key: string) => void) => void;",
    "    contentType?: (req: Request, file: Express.Multer.File, cb: (err: Error | null, mime: string, stream: NodeJS.ReadableStream) => void) => void;",
    "    metadata?: (req: Request, file: Express.Multer.File, cb: (err: Error | null, metadata: Record<string, string>) => void) => void;",
    "    acl?: string;",
    "  }",
    "",
    "  function AUTO_CONTENT_TYPE(",
    "    req: Request,",
    "    file: Express.Multer.File,",
    "    cb: (err: Error | null, mime: string, stream: NodeJS.ReadableStream) => void",
    "  ): void;",
    "}",
    "",
    "declare function multerS3(options: multerS3.Options): StorageEngine;",
    "",
    "export = multerS3;",
]

if MULTER_S3_DECL.exists():
    print(f"  SKIP  {MULTER_S3_DECL.name} (already exists)")
else:
    MULTER_S3_DECL.write_text("\n".join(DECL_LINES) + "\n")
    print(f"  CREATE server/types/multer-s3.d.ts")

# Ensure server tsconfig includes the types dir
TSCONFIG = root / "server" / "tsconfig.json"
if TSCONFIG.exists():
    import json
    ts = json.loads(TSCONFIG.read_text())
    paths = ts.get("compilerOptions", {}).get("paths", {})
    include = ts.get("include", [])
    changed = False

    # Add typeRoots to pick up local declarations
    if "typeRoots" not in ts.get("compilerOptions", {}):
        ts.setdefault("compilerOptions", {})["typeRoots"] = [
            "./types",
            "../node_modules/@types",
            "./node_modules/@types"
        ]
        changed = True

    if changed:
        bak = backup(TSCONFIG)
        TSCONFIG.write_text(json.dumps(ts, indent=2) + "\n")
        print(f"  APPLY server/tsconfig.json - added typeRoots")
        print(f"        bak: {bak.name}")
    else:
        print(f"  SKIP  server/tsconfig.json (typeRoots already set)")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 2 — storage-s3.ts: fix implicit any on key() callback params
# Error: TS7006 _req, file, cb implicitly any
# Fix: add explicit Express.Request / Express.Multer.File / callback types
# ══════════════════════════════════════════════════════════════════════════════

print()
print("[2/3] storage-s3.ts — explicit types on key() callback")

STORAGE_S3 = root / "server" / "lib" / "storage-s3.ts"

if not STORAGE_S3.exists():
    print("  ERROR: storage-s3.ts not found — skipping")
else:
    OLD_KEY = (
        "    key: (_req, file, cb) => {\n"
        "      const ext    = path.extname(file.originalname);\n"
        "      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;\n"
        "      const folder = file.fieldname === 'sample' ? 'samples' : 'projects';\n"
        "      cb(null, `${folder}/${unique}${ext}`);\n"
        "    },"
    )

    NEW_KEY = (
        "    key: (_req: Express.Request, file: Express.Multer.File, cb: (err: Error | null, key: string) => void) => {\n"
        "      const ext    = path.extname(file.originalname);\n"
        "      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;\n"
        "      const folder = file.fieldname === 'sample' ? 'samples' : 'projects';\n"
        "      cb(null, `${folder}/${unique}${ext}`);\n"
        "    },"
    )

    apply("storage-s3.ts key() params", STORAGE_S3, OLD_KEY, NEW_KEY)

# ══════════════════════════════════════════════════════════════════════════════
# FIX 3 — audio-analysis.ts: analyzeBuffer -> analyzeAudio, add duration
# Error: TS2305 Module has no exported member 'analyzeBuffer'
# Fix: use correct export name analyzeAudio, pass duration from audioBuffer
# ══════════════════════════════════════════════════════════════════════════════

print()
print("[3/3] audio-analysis.ts — correct export name and RawAudioBuffer shape")

ANALYSIS = root / "server" / "services" / "audio-analysis.ts"

if not ANALYSIS.exists():
    print("  ERROR: audio-analysis.ts not found — skipping")
else:
    # Fix import name
    apply(
        "audio-analysis.ts import analyzeBuffer -> analyzeAudio",
        ANALYSIS,
        "import { analyzeBuffer } from '@llpte/llpte-signal';",
        "import { analyzeAudio } from '@llpte/llpte-signal';",
    )

    # Fix call site — analyzeBuffer({ ... }) -> analyzeAudio({ ..., duration })
    apply(
        "audio-analysis.ts call site analyzeBuffer -> analyzeAudio + duration",
        ANALYSIS,
        (
            "  const result = await analyzeBuffer({\n"
            "    channelData,\n"
            "    sampleRate: audioBuffer.sampleRate,\n"
            "  });\n"
            "\n"
            "  await ctx.close();\n"
            "\n"
            "  return {\n"
            "    ...result,\n"
            "    duration: audioBuffer.duration,\n"
            "  };"
        ),
        (
            "  const result = await analyzeAudio({\n"
            "    channelData,\n"
            "    sampleRate: audioBuffer.sampleRate,\n"
            "    duration:   audioBuffer.duration,\n"
            "  });\n"
            "\n"
            "  await ctx.close();\n"
            "\n"
            "  // duration is already in result from analyzeAudio\n"
            "  return result as AnalysisResult & { duration: number };"
        ),
    )

    # Fix return type — AnalysisResult does not include duration; extend it
    apply(
        "audio-analysis.ts AnalysisResult interface — add duration field",
        ANALYSIS,
        (
            "export interface AnalysisResult {\n"
            "  bpm:              number;\n"
            "  bpmConfidence:    number;\n"
            "  key:              string;\n"
            "  keyConfidence:    number;\n"
            "  energy:           number;\n"
            "  spectralCentroid: number;\n"
            "  rmsLoudness:      number;\n"
            "  dynamicRange:     number;\n"
            "  analysisTimeMs:   number;\n"
            "  duration:         number;\n"
            "}"
        ),
        (
            "import type { AnalysisResult as LlpteResult } from '@llpte/llpte-signal';\n"
            "\n"
            "export interface AnalysisResult extends LlpteResult {\n"
            "  duration: number;\n"
            "}"
        ),
    )

# ── TypeScript verification ────────────────────────────────────────────────────

print()
print("Running tsc --noEmit ...")
result = subprocess.run(
    "npx tsc --noEmit 2>&1 | grep -v 'npm notice'",
    shell=True,
    cwd=root / "server",
    capture_output=True,
    text=True,
)
ts_out = (result.stdout + result.stderr).strip()

print()
if ts_out:
    print("ERRORS:")
    for line in ts_out.splitlines():
        print(f"  {line}")
    print()
    print("Some errors remain — paste the output above and they will be fixed.")
else:
    print("=" * 60)
    print("DONE - Zero TypeScript errors. Codebase is clean.")
    print("=" * 60)
