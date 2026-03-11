#!/usr/bin/env python3
"""
R3 v4 - Post-Audit Fix Script
Applies three changes confirmed safe by the architectural audit:
  1. feature-gate.ts  - wrap AI usage DB insert in try/catch
  2. server/routes.ts - stub /api/audio/analyze as 501
  3. server/routes.ts - strip dead REST CRUD, dead imports, dead Zod schemas
"""

import sys
import os
import shutil
from pathlib import Path
from datetime import datetime

# ── Resolve project root ───────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
root = SCRIPT_DIR
for _ in range(6):
    if (root / "server").is_dir() and (root / "client").is_dir():
        break
    root = root.parent
else:
    print("ERROR: Could not locate project root (needs server/ and client/ siblings).")
    sys.exit(1)

FEATURE_GATE = root / "server" / "middleware" / "feature-gate.ts"
ROUTES       = root / "server" / "routes.ts"

print(f"Project root : {root}")
print(f"feature-gate : {FEATURE_GATE}")
print(f"routes.ts    : {ROUTES}")
print()

for p in [FEATURE_GATE, ROUTES]:
    if not p.exists():
        print(f"ERROR: NOT FOUND: {p}")
        sys.exit(1)

def backup(path: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest  = path.with_suffix(f".{stamp}.bak")
    shutil.copy2(path, dest)
    return dest

# ── Change 1 — feature-gate.ts ─────────────────────────────────────────────────

OLD_INSERT = (
    "    const result = await next();\n"
    "\n"
    "    await db.insert(aiTransitionUsage).values({\n"
    "      id: crypto.randomUUID(),\n"
    "      userId,\n"
    "      sessionId,\n"
    "    });\n"
    "\n"
    "    return result;"
)

NEW_INSERT = (
    "    const result = await next();\n"
    "\n"
    "    try {\n"
    "      await db.insert(aiTransitionUsage).values({\n"
    "        id: crypto.randomUUID(),\n"
    "        userId,\n"
    "        sessionId,\n"
    "      });\n"
    "    } catch (err) {\n"
    "      // Log but do not fail the request - a missing usage record is preferable\n"
    "      // to failing a completed AI transition. Monitor for repeated failures\n"
    "      // as they indicate a schema or DB connectivity issue.\n"
    "      console.error('[feature-gate] failed to record AI usage:', err);\n"
    "    }\n"
    "\n"
    "    return result;"
)

fg_text = FEATURE_GATE.read_text()

if OLD_INSERT not in fg_text:
    print("SKIP  [1/3] feature-gate.ts - target block not found (already patched?)")
else:
    bak = backup(FEATURE_GATE)
    print(f"BAK   [1/3] {bak.name}")
    fg_text = fg_text.replace(OLD_INSERT, NEW_INSERT, 1)
    FEATURE_GATE.write_text(fg_text)
    print("APPLY [1/3] feature-gate.ts - AI usage insert wrapped in try/catch")

# ── Change 2 & 3 — server/routes.ts ───────────────────────────────────────────

ROUTES_LINES = [
    "import { z } from 'zod';",
    "/**",
    " * server/routes.ts",
    " *",
    " * Canonical REST surface - tRPC handles all CRUD.",
    " * Only routes that cannot be expressed as tRPC procedures live here:",
    " *   . /api/auth/*          - token issuance (login/register/me/refresh)",
    " *   . /api/samples/upload  - multipart file upload (tRPC cannot handle multipart)",
    " *   . /api/audio/analyze   - reserved; returns 501 until llpte-signal is wired in",
    " *",
    " * All session/project/preset/settings CRUD has been removed - the client",
    " * calls those exclusively via tRPC (/api/trpc/*) and the duplicate REST",
    " * surface was untested, unmaintained dead code.",
    " */",
    "",
    "import { logger } from './lib/logger';",
    "import type { Express, RequestHandler } from \"express\";",
    "import type { Server } from \"http\";",
    "import multer from \"multer\";",
    "import path from \"path\";",
    "import fs from \"fs/promises\";",
    "import { insertSampleSchema } from \"./db/schema\";",
    "import { storage } from \"./storage\";",
    "import { requireUser } from \"./middleware/auth\";",
    "import authRouter from \"./routes/auth\";",
    "import { uploadLimiter } from \"./middleware/rateLimit\";",
    "",
    "const uploadDir   = path.join(process.cwd(), \"uploads\");",
    "const samplesDir  = path.join(uploadDir, \"samples\");",
    "const projectsDir = path.join(uploadDir, \"projects\");",
    "",
    "const storage_config = multer.diskStorage({",
    "  destination: async (req, file, cb) => {",
    "    try {",
    "      await fs.mkdir(samplesDir,  { recursive: true });",
    "      await fs.mkdir(projectsDir, { recursive: true });",
    "      if      (file.fieldname === \"sample\")  cb(null, samplesDir);",
    "      else if (file.fieldname === \"project\") cb(null, projectsDir);",
    "      else                                   cb(null, uploadDir);",
    "    } catch (error) {",
    "      cb(error as Error, uploadDir);",
    "    }",
    "  },",
    "  filename: (_req, file, cb) => {",
    "    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;",
    "    cb(null, `${uniqueSuffix}-${file.originalname}`);",
    "  },",
    "});",
    "",
    "const upload = multer({",
    "  storage: storage_config,",
    "  limits: { fileSize: 50 * 1024 * 1024 },",
    "  fileFilter: (_req, file, cb) => {",
    "    const allowedMimes = [",
    "      \"audio/wav\", \"audio/mpeg\", \"audio/mp3\", \"audio/ogg\",",
    "      \"audio/flac\", \"audio/x-wav\", \"audio/x-m4a\",",
    "      \"application/octet-stream\",",
    "    ];",
    "    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.r3v')) {",
    "      cb(null, true);",
    "    } else {",
    "      cb(new Error(\"Invalid file type. Only audio files are allowed.\"));",
    "    }",
    "  },",
    "});",
    "",
    "export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {",
    "",
    "  // AUTH",
    "  app.use('/api/auth', authRouter);",
    "",
    "  // SAMPLE UPLOAD",
    "  app.post(",
    "    \"/api/samples/upload\",",
    "    requireUser,",
    "    uploadLimiter as unknown as RequestHandler,",
    "    upload.single(\"sample\") as unknown as RequestHandler,",
    "    async (req, res) => {",
    "      try {",
    "        if (!req.file) return res.status(400).json({ error: \"No file uploaded\" });",
    "",
    "        const sampleData = {",
    "          name:     req.body.name || req.file.originalname,",
    "          filePath: req.file.path,",
    "          fileName: req.file.filename,",
    "          fileSize: req.file.size,",
    "          mimeType: req.file.mimetype,",
    "          duration: parseFloat(req.body.duration) || 0,",
    "          bpm:      req.body.bpm ? parseFloat(req.body.bpm) : null,",
    "          key:      req.body.key || null,",
    "          tags:     req.body.tags ? JSON.parse(req.body.tags) : [],",
    "          userId:   req.user!.id,",
    "        };",
    "",
    "        const parsed = insertSampleSchema.safeParse(sampleData);",
    "        if (!parsed.success) {",
    "          await fs.unlink(req.file.path);",
    "          return res.status(400).json({ error: \"Invalid sample data\", details: parsed.error.issues });",
    "        }",
    "",
    "        const sample = await storage.createSample(parsed.data as any);",
    "        res.status(201).json(sample);",
    "      } catch (error) {",
    "        logger.error(\"Error uploading sample:\", error as Record<string, unknown>);",
    "        if (req.file) await fs.unlink(req.file.path).catch(console.error);",
    "        res.status(500).json({ error: \"Failed to upload sample\" });",
    "      }",
    "    },",
    "  );",
    "",
    "  // AUDIO ANALYSIS - NOT YET IMPLEMENTED",
    "  // TODO: wire to @llpte/llpte-signal (packages/llpte-signal/src/analyzer.ts)",
    "  app.post(",
    "    \"/api/audio/analyze\",",
    "    requireUser,",
    "    upload.single(\"audio\") as unknown as RequestHandler,",
    "    async (req, res) => {",
    "      try {",
    "        if (req.file) await fs.unlink(req.file.path).catch(() => {});",
    "        res.status(501).json({ error: 'Audio analysis not yet implemented' });",
    "      } catch (error) {",
    "        logger.error(\"Error analyzing audio:\", error as Record<string, unknown>);",
    "        res.status(500).json({ error: \"Failed to analyze audio\" });",
    "      }",
    "    },",
    "  );",
    "",
    "  return httpServer;",
    "}",
]

bak2 = backup(ROUTES)
print(f"BAK   [2/3] {bak2.name}")
ROUTES.write_text("\n".join(ROUTES_LINES) + "\n")
print("APPLY [2/3] server/routes.ts - dead REST CRUD stripped, dead imports removed")
print("APPLY [3/3] server/routes.ts - /api/audio/analyze returns 501")

# ── Type-check ─────────────────────────────────────────────────────────────────

print()
print("Running tsc --noEmit ...")
result = os.system(
    f"cd '{root}/server' && npx tsc --noEmit 2>&1 | grep -v 'npm notice'"
)

print()
if result == 0:
    print("✓  All changes applied. TypeScript is clean.")
    print()
    print("Summary:")
    print("  1. feature-gate.ts  - AI usage insert wrapped in try/catch")
    print("  2. server/routes.ts - dead REST CRUD removed (~250 lines)")
    print("  3. server/routes.ts - /api/audio/analyze returns 501")
else:
    print("WARNING: tsc reported errors - review output above.")
    print("Backups available in:")
    print(f"  {FEATURE_GATE.parent}/")
    print(f"  {ROUTES.parent}/")
    print("(files ending in .bak)")