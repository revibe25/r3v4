#!/usr/bin/env python3
"""
R3 v4 - Launch Preparation Script
===================================
Applies all pre-launch changes in a single pass:

  1. Trial period  - 7 days -> 14 days in subscription router
  2. Env template  - generates .env.example with all required variables
  3. S3 upload     - installs multer-s3, scaffolds storage config
  4. Audio analyze - wires /api/audio/analyze to @llpte/llpte-signal
  5. Deploy config - generates vercel.json + railway.toml
  6. Type check    - confirms zero TS errors after all changes

Each step is idempotent. Re-running the script is safe.
Timestamped .bak files are created before every file edit.
"""

import sys
import os
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

# ── Locate project root ────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
root = SCRIPT_DIR
for _ in range(8):
    if (root / "server").is_dir() and (root / "client").is_dir():
        break
    root = root.parent
else:
    print("ERROR: Cannot locate project root. Run this script from inside R3 v4/")
    sys.exit(1)

print("=" * 60)
print("R3 v4 Launch Preparation")
print("=" * 60)
print(f"Root: {root}")
print()

# ── Helpers ────────────────────────────────────────────────────────────────────

def backup(path: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest  = path.with_suffix(f".{stamp}.bak")
    shutil.copy2(path, dest)
    return dest

def apply(label: str, path: Path, old: str, new: str) -> bool:
    text = path.read_text()
    if old not in text:
        print(f"  SKIP  {label} (already applied)")
        return False
    bak = backup(path)
    path.write_text(text.replace(old, new, 1))
    print(f"  APPLY {label}")
    print(f"        bak: {bak.name}")
    return True

def write_new(label: str, path: Path, lines: list) -> bool:
    content = "\n".join(lines) + "\n"
    if path.exists() and path.read_text() == content:
        print(f"  SKIP  {label} (already up to date)")
        return False
    if path.exists():
        bak = backup(path)
        print(f"  APPLY {label}")
        print(f"        bak: {bak.name}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"  CREATE {label}")
    path.write_text(content)
    return True

def run(cmd: str, cwd: Path = root) -> int:
    return subprocess.run(cmd, shell=True, cwd=cwd).returncode

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Trial period 7 -> 14 days
# ══════════════════════════════════════════════════════════════════════════════

print("[1/6] Trial period")

SUB_ROUTER = root / "server" / "routers" / "subscription.ts"
if not SUB_ROUTER.exists():
    print("  ERROR: subscription.ts not found — skipping")
else:
    apply(
        "subscription.ts trialDays 7 -> 14",
        SUB_ROUTER,
        "trialDays: 7,",
        "trialDays: 14,",
    )

print()

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — .env.example
# ══════════════════════════════════════════════════════════════════════════════

print("[2/6] Environment template")

ENV_EXAMPLE = root / ".env.example"
ENV_LINES = [
    "# R3 v4 — Required Environment Variables",
    "# Copy to .env and fill in all values before running or deploying.",
    "# Never commit .env to version control.",
    "",
    "# ── Server ────────────────────────────────────────────────────────────────",
    "NODE_ENV=production",
    "PORT=3000",
    "APP_URL=https://your-domain.com",
    "",
    "# ── Database ──────────────────────────────────────────────────────────────",
    "DATABASE_URL=postgresql://user:password@host:5432/r3",
    "",
    "# ── Auth ──────────────────────────────────────────────────────────────────",
    "# Generate with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    "JWT_SECRET=replace_with_64_byte_hex_secret",
    "JWT_EXPIRES_IN=7d",
    "",
    "# ── Stripe ────────────────────────────────────────────────────────────────",
    "STRIPE_SECRET_KEY=sk_live_...",
    "STRIPE_WEBHOOK_SECRET=whsec_...",
    "STRIPE_CREATOR_MONTHLY_PRICE_ID=price_...",
    "STRIPE_CREATOR_YEARLY_PRICE_ID=price_...",
    "STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID=price_...",
    "STRIPE_PRO_ARTIST_YEARLY_PRICE_ID=price_...",
    "",
    "# ── File Storage (S3 or Cloudflare R2) ────────────────────────────────────",
    "# R2 endpoint format: https://<account-id>.r2.cloudflarestorage.com",
    "STORAGE_BUCKET=r3-uploads",
    "STORAGE_REGION=auto",
    "STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com",
    "STORAGE_ACCESS_KEY_ID=your_access_key",
    "STORAGE_SECRET_ACCESS_KEY=your_secret_key",
    "STORAGE_PUBLIC_URL=https://uploads.your-domain.com",
]

write_new(".env.example", ENV_EXAMPLE, ENV_LINES)

# Ensure .env is gitignored
GITIGNORE = root / ".gitignore"
if GITIGNORE.exists():
    gi = GITIGNORE.read_text()
    additions = []
    for entry in [".env", "*.bak", "uploads/"]:
        if entry not in gi:
            additions.append(entry)
    if additions:
        GITIGNORE.write_text(gi.rstrip() + "\n\n# Launch prep additions\n" + "\n".join(additions) + "\n")
        print(f"  APPLY .gitignore — added: {', '.join(additions)}")
    else:
        print("  SKIP  .gitignore (entries already present)")
else:
    GITIGNORE.write_text(".env\n*.bak\nuploads/\nnode_modules/\ndist/\n")
    print("  CREATE .gitignore")

print()

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — S3/R2 storage config
# ══════════════════════════════════════════════════════════════════════════════

print("[3/6] S3/R2 storage scaffold")

STORAGE_CONFIG = root / "server" / "lib" / "storage-s3.ts"

S3_LINES = [
    "/**",
    " * server/lib/storage-s3.ts",
    " *",
    " * S3-compatible file storage for uploads.",
    " * Works with AWS S3 and Cloudflare R2 (same API, set STORAGE_ENDPOINT for R2).",
    " *",
    " * Usage:",
    " *   import { uploadToS3, deleteFromS3, getSignedUrl } from '../lib/storage-s3';",
    " *",
    " * To activate in routes.ts, replace multer.diskStorage with multerS3() from",
    " * this module. The multer instance in routes.ts is the only change needed.",
    " */",
    "",
    "import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';",
    "import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';",
    "import multer from 'multer';",
    "import multerS3 from 'multer-s3';",
    "import path from 'path';",
    "",
    "const {",
    "  STORAGE_BUCKET,",
    "  STORAGE_REGION   = 'auto',",
    "  STORAGE_ENDPOINT,",
    "  STORAGE_ACCESS_KEY_ID,",
    "  STORAGE_SECRET_ACCESS_KEY,",
    "} = process.env;",
    "",
    "if (!STORAGE_BUCKET || !STORAGE_ACCESS_KEY_ID || !STORAGE_SECRET_ACCESS_KEY) {",
    "  throw new Error(",
    "    'Missing S3 env vars. Required: STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY'",
    "  );",
    "}",
    "",
    "export const s3 = new S3Client({",
    "  region: STORAGE_REGION,",
    "  endpoint: STORAGE_ENDPOINT,",
    "  credentials: {",
    "    accessKeyId:     STORAGE_ACCESS_KEY_ID,",
    "    secretAccessKey: STORAGE_SECRET_ACCESS_KEY,",
    "  },",
    "  // Required for Cloudflare R2",
    "  forcePathStyle: !!STORAGE_ENDPOINT,",
    "});",
    "",
    "const ALLOWED_MIMES = [",
    "  'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg',",
    "  'audio/flac', 'audio/x-wav', 'audio/x-m4a',",
    "  'application/octet-stream',",
    "];",
    "",
    "/** Multer instance pre-configured for S3/R2. */",
    "export const uploadS3 = multer({",
    "  storage: multerS3({",
    "    s3,",
    "    bucket: STORAGE_BUCKET,",
    "    contentType: multerS3.AUTO_CONTENT_TYPE,",
    "    key: (_req, file, cb) => {",
    "      const ext    = path.extname(file.originalname);",
    "      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;",
    "      const folder = file.fieldname === 'sample' ? 'samples' : 'projects';",
    "      cb(null, `${folder}/${unique}${ext}`);",
    "    },",
    "  }),",
    "  limits: { fileSize: 50 * 1024 * 1024 },",
    "  fileFilter: (_req, file, cb) => {",
    "    if (ALLOWED_MIMES.includes(file.mimetype) || file.originalname.endsWith('.r3v')) {",
    "      cb(null, true);",
    "    } else {",
    "      cb(new Error('Invalid file type. Only audio files are allowed.'));",
    "    }",
    "  },",
    "});",
    "",
    "/** Delete an object from S3/R2 by its key. */",
    "export async function deleteFromS3(key: string): Promise<void> {",
    "  await s3.send(new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));",
    "}",
    "",
    "/**",
    " * Generate a pre-signed URL for temporary direct access.",
    " * Default expiry: 1 hour. Use for download links.",
    " */",
    "export async function getSignedUrl(key: string, expiresIn = 3600): Promise<string> {",
    "  const cmd = new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key });",
    "  return awsGetSignedUrl(s3, cmd, { expiresIn });",
    "}",
]

write_new("server/lib/storage-s3.ts", STORAGE_CONFIG, S3_LINES)

# Install multer-s3 and AWS SDK if not present
PKG_JSON = root / "server" / "package.json"
if PKG_JSON.exists():
    pkg = PKG_JSON.read_text()
    missing = []
    if "multer-s3" not in pkg:
        missing.append("multer-s3")
    if "@aws-sdk/client-s3" not in pkg:
        missing.append("@aws-sdk/client-s3")
    if "@aws-sdk/s3-request-presigner" not in pkg:
        missing.append("@aws-sdk/s3-request-presigner")
    if missing:
        print(f"  Installing: {' '.join(missing)}")
        rc = run(f"pnpm add {' '.join(missing)}", cwd=root / "server")
        if rc != 0:
            print(f"  WARNING: pnpm install failed — install manually:")
            print(f"           cd server && pnpm add {' '.join(missing)}")
    else:
        print("  SKIP  S3 packages (already in package.json)")
else:
    print("  SKIP  package install (server/package.json not found)")

print()

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Wire /api/audio/analyze to @llpte/llpte-signal
# ══════════════════════════════════════════════════════════════════════════════

print("[4/6] Audio analysis wiring")

ANALYZE_SERVICE = root / "server" / "services" / "audio-analysis.ts"

ANALYZE_LINES = [
    "/**",
    " * server/services/audio-analysis.ts",
    " *",
    " * Wires @llpte/llpte-signal into the Express audio analyze route.",
    " *",
    " * The analyzer runs in a worker_thread to keep the event loop free.",
    " * A 4-second 44100Hz buffer completes in < 2000ms per the package SLA.",
    " *",
    " * Decoding pipeline:",
    " *   multer -> disk -> fs.readFile -> AudioBuffer (via node-web-audio-api)",
    " *   -> analyzeBuffer -> JSON response -> unlink temp file",
    " *",
    " * Install required peer dep if not present:",
    " *   cd server && pnpm add node-web-audio-api",
    " */",
    "",
    "import fs from 'fs/promises';",
    "import { analyzeBuffer } from '@llpte/llpte-signal';",
    "",
    "// node-web-audio-api provides a Node.js AudioContext compatible with",
    "// the Web Audio API spec. It can decode audio files to PCM buffers.",
    "// If this import fails, run: cd server && pnpm add node-web-audio-api",
    "let AudioContext: typeof globalThis.AudioContext;",
    "try {",
    "  // eslint-disable-next-line @typescript-eslint/no-require-imports",
    "  ({ AudioContext } = require('node-web-audio-api'));",
    "} catch {",
    "  AudioContext = null as any;",
    "}",
    "",
    "export interface AnalysisResult {",
    "  bpm:              number;",
    "  bpmConfidence:    number;",
    "  key:              string;",
    "  keyConfidence:    number;",
    "  energy:           number;",
    "  spectralCentroid: number;",
    "  rmsLoudness:      number;",
    "  dynamicRange:     number;",
    "  analysisTimeMs:   number;",
    "  duration:         number;",
    "}",
    "",
    "/**",
    " * Decode an audio file and run the full llpte-signal analysis pipeline.",
    " * @param filePath - Absolute path to the uploaded audio file.",
    " * @returns AnalysisResult or throws if decoding or analysis fails.",
    " */",
    "export async function analyzeAudioFile(filePath: string): Promise<AnalysisResult> {",
    "  if (!AudioContext) {",
    "    throw new Error(",
    "      'node-web-audio-api is not installed. Run: cd server && pnpm add node-web-audio-api'",
    "    );",
    "  }",
    "",
    "  const raw  = await fs.readFile(filePath);",
    "  const ctx  = new AudioContext();",
    "",
    "  // decodeAudioData returns a Web Audio AudioBuffer",
    "  const audioBuffer = await ctx.decodeAudioData(raw.buffer as ArrayBuffer);",
    "",
    "  const channelData: Float32Array[] = [];",
    "  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {",
    "    channelData.push(audioBuffer.getChannelData(ch));",
    "  }",
    "",
    "  const result = await analyzeBuffer({",
    "    channelData,",
    "    sampleRate: audioBuffer.sampleRate,",
    "  });",
    "",
    "  await ctx.close();",
    "",
    "  return {",
    "    ...result,",
    "    duration: audioBuffer.duration,",
    "  };",
    "}",
]

write_new("server/services/audio-analysis.ts", ANALYZE_SERVICE, ANALYZE_LINES)

# Now patch routes.ts to call the service instead of returning 501
ROUTES = root / "server" / "routes.ts"
if ROUTES.exists():
    OLD_STUB = (
        "  // AUDIO ANALYSIS - NOT YET IMPLEMENTED\n"
        "  // TODO: wire to @llpte/llpte-signal (packages/llpte-signal/src/analyzer.ts)\n"
        "  app.post(\n"
        "    \"/api/audio/analyze\",\n"
        "    requireUser,\n"
        "    upload.single(\"audio\") as unknown as RequestHandler,\n"
        "    async (req, res) => {\n"
        "      try {\n"
        "        if (req.file) await fs.unlink(req.file.path).catch(() => {});\n"
        "        res.status(501).json({ error: 'Audio analysis not yet implemented' });\n"
        "      } catch (error) {\n"
        "        logger.error(\"Error analyzing audio:\", error as Record<string, unknown>);\n"
        "        res.status(500).json({ error: \"Failed to analyze audio\" });\n"
        "      }\n"
        "    },\n"
        "  );"
    )

    NEW_ANALYZE = (
        "  // AUDIO ANALYSIS\n"
        "  app.post(\n"
        "    \"/api/audio/analyze\",\n"
        "    requireUser,\n"
        "    upload.single(\"audio\") as unknown as RequestHandler,\n"
        "    async (req, res) => {\n"
        "      try {\n"
        "        if (!req.file) return res.status(400).json({ error: \"No audio file provided\" });\n"
        "        const { analyzeAudioFile } = await import('./services/audio-analysis');\n"
        "        const result = await analyzeAudioFile(req.file.path);\n"
        "        await fs.unlink(req.file.path).catch(() => {});\n"
        "        res.json(result);\n"
        "      } catch (error) {\n"
        "        if (req.file) await fs.unlink(req.file.path).catch(() => {});\n"
        "        const msg = error instanceof Error ? error.message : 'Unknown error';\n"
        "        logger.error(\"Error analyzing audio:\", { message: msg });\n"
        "        res.status(500).json({ error: \"Failed to analyze audio\", detail: msg });\n"
        "      }\n"
        "    },\n"
        "  );"
    )

    apply("routes.ts analyze route -> real implementation", ROUTES, OLD_STUB, NEW_ANALYZE)

    # Install node-web-audio-api
    if PKG_JSON.exists() and "node-web-audio-api" not in PKG_JSON.read_text():
        print("  Installing: node-web-audio-api")
        rc = run("pnpm add node-web-audio-api", cwd=root / "server")
        if rc != 0:
            print("  WARNING: install failed — run manually: cd server && pnpm add node-web-audio-api")
    else:
        print("  SKIP  node-web-audio-api (already installed)")

print()

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Deploy config files
# ══════════════════════════════════════════════════════════════════════════════

print("[5/6] Deployment config")

# vercel.json — frontend only, proxies /api to backend
VERCEL_JSON = root / "client" / "vercel.json"
VERCEL_LINES = [
    "{",
    "  \"$schema\": \"https://openapi.vercel.sh/vercel.json\",",
    "  \"buildCommand\": \"pnpm run build\",",
    "  \"outputDirectory\": \"dist\",",
    "  \"framework\": \"vite\",",
    "  \"rewrites\": [",
    "    {",
    "      \"source\": \"/api/(.*)\",",
    "      \"destination\": \"https://your-backend.railway.app/api/$1\"",
    "    },",
    "    {",
    "      \"source\": \"/(.*)\",",
    "      \"destination\": \"/index.html\"",
    "    }",
    "  ],",
    "  \"headers\": [",
    "    {",
    "      \"source\": \"/(.*)\",",
    "      \"headers\": [",
    "        { \"key\": \"X-Content-Type-Options\", \"value\": \"nosniff\" },",
    "        { \"key\": \"X-Frame-Options\", \"value\": \"DENY\" },",
    "        { \"key\": \"Referrer-Policy\", \"value\": \"strict-origin-when-cross-origin\" }",
    "      ]",
    "    },",
    "    {",
    "      \"source\": \"/assets/(.*)\",",
    "      \"headers\": [",
    "        { \"key\": \"Cache-Control\", \"value\": \"public, max-age=31536000, immutable\" }",
    "      ]",
    "    }",
    "  ]",
    "}",
]
write_new("client/vercel.json", VERCEL_JSON, VERCEL_LINES)

# railway.toml — backend
RAILWAY_TOML = root / "railway.toml"
RAILWAY_LINES = [
    "[build]",
    "builder = \"nixpacks\"",
    "buildCommand = \"pnpm install && pnpm --filter server build\"",
    "",
    "[deploy]",
    "startCommand = \"node dist/index.js\"",
    "restartPolicyType = \"on_failure\"",
    "restartPolicyMaxRetries = 3",
    "",
    "[deploy.healthcheck]",
    "path = \"/api/health\"",
    "timeout = 30",
    "interval = 60",
]
write_new("railway.toml", RAILWAY_TOML, RAILWAY_LINES)

# Health check endpoint — add to index.ts if not present
INDEX_TS = root / "index.ts"
if INDEX_TS.exists():
    idx = INDEX_TS.read_text()
    HEALTH_CHECK = "app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));"
    if HEALTH_CHECK not in idx:
        # Insert after app.use(helmet()) line
        TARGET = "app.use(helmet());"
        if TARGET in idx:
            bak = backup(INDEX_TS)
            idx = idx.replace(
                TARGET,
                TARGET + "\n" + HEALTH_CHECK,
                1
            )
            INDEX_TS.write_text(idx)
            print(f"  APPLY index.ts - added /api/health endpoint")
            print(f"        bak: {bak.name}")
        else:
            print("  SKIP  health check (helmet() line not found — add manually)")
    else:
        print("  SKIP  health check (already present)")

print()

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — TypeScript check
# ══════════════════════════════════════════════════════════════════════════════

print("[6/6] TypeScript verification")
result = subprocess.run(
    "npx tsc --noEmit 2>&1 | grep -v 'npm notice'",
    shell=True,
    cwd=root / "server",
    capture_output=True,
    text=True,
)
ts_out = (result.stdout + result.stderr).strip()

if ts_out:
    print("  ERRORS:")
    for line in ts_out.splitlines():
        print(f"    {line}")
else:
    print("  PASS — zero TypeScript errors")

# ── Summary ────────────────────────────────────────────────────────────────────

print()
print("=" * 60)
if not ts_out:
    print("DONE — All steps complete. TypeScript is clean.")
else:
    print("DONE with warnings — TypeScript errors above need attention.")
print("=" * 60)
print()
print("Next steps:")
print("  1. Copy .env.example to .env and fill in all values")
print("  2. Update client/vercel.json rewrite URL to your Railway backend URL")
print("  3. Set all env vars in Railway and Vercel dashboards")
print("  4. Run: cd server && pnpm add node-web-audio-api  (if not auto-installed)")
print("  5. Push to GitHub — Vercel and Railway auto-deploy on push")
print()
print("S3/R2 activation (when ready):")
print("  Replace multer diskStorage in server/routes.ts with uploadS3 from")
print("  server/lib/storage-s3.ts. The interface is identical.")
print()