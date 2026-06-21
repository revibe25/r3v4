/**
 * server/routes.ts
 *
 * Canonical REST surface — tRPC handles all CRUD.
 * Only routes that cannot be expressed as tRPC procedures live here:
 *   . /api/auth/*          — token issuance (login/register/me/change-password)
 *   . /api/samples/upload  — multipart file upload (tRPC cannot handle multipart)
 *   . /api/audio/analyze   — audio analysis endpoint
 *
 * ── CHANGE: trpcAuth mounted globally ────────────────────────────────────────
 * ROOT CAUSE: trpcAuth reads the Authorization header, verifies the JWT, and
 * populates req.user. It was exported from server/middleware/auth.ts but never
 * applied as middleware anywhere in this file. Every request arrived at every
 * handler with req.user = undefined. requireUser on /api/auth/me therefore
 * always returned 401. hydrateFromToken() in the client received 401, called
 * clearAuth(), set isAuthenticated=false, and ProtectedRoute redirected to
 * /login — destroying the session on every protected-page mount.
 *
 * FIX RATIONALE: app.use(trpcAuth) before all route mounts guarantees req.user
 * is populated for any request carrying a valid Bearer token. trpcAuth is
 * non-blocking — it unconditionally calls next() — so public routes that do
 * not call requireUser are completely unaffected.
 *
 * AFFECTED SURFACE: All routes that call requireUser. No route logic changes.
 *
 * REGRESSION CHECK: Public routes (/api/auth/login, /api/auth/register) do not
 * call requireUser. trpcAuth only writes to req.user; it never rejects. Existing
 * upload and audio-analysis routes gain correct req.user population, which they
 * already required — they were silently broken before this fix.
 */
import { logger } from './lib/logger';
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { insertSampleSchema } from "./db/schema";
import { storage } from "./storage";
import { trpcAuth, requireUser } from "./middleware/auth";
import authRouter from "./routes/auth";
import { internalRouter } from "./routes/internal";
import { uploadLimiter } from "./middleware/rateLimit";
const uploadDir = path.join(process.cwd(), "uploads");
const samplesDir = path.join(uploadDir, "samples");
const projectsDir = path.join(uploadDir, "projects");
const storage_config = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fs.mkdir(samplesDir, { recursive: true });
            await fs.mkdir(projectsDir, { recursive: true });
            if (file.fieldname === "sample")
                cb(null, samplesDir);
            else if (file.fieldname === "project")
                cb(null, projectsDir);
            else
                cb(null, uploadDir);
        }
        catch (error) {
            cb(error, uploadDir);
        }
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
});
const upload = multer({
    storage: storage_config,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowedMimes = [
            "audio/wav", "audio/mpeg", "audio/mp3", "audio/ogg",
            "audio/flac", "audio/x-wav", "audio/x-m4a",
            "application/octet-stream",
        ];
        if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.r3v')) {
            cb(null, true);
        }
        else {
            cb(new Error("Invalid file type. Only audio files are allowed."));
        }
    },
});
export async function registerRoutes(httpServer, app) {
    // ── GLOBAL JWT MIDDLEWARE ─────────────────────────────────────────────────
    // Must be first. Parses Authorization: Bearer <token>, verifies the JWT,
    // and writes the decoded payload to req.user when valid. Non-blocking:
    // always calls next(). An invalid or absent token is silently ignored here;
    // routes that require authentication enforce it via requireUser below.
    app.use(trpcAuth);
    // ── AUTH ROUTES ───────────────────────────────────────────────────────────
    app.use('/api/auth', authRouter);
    // ── SAMPLE UPLOAD ─────────────────────────────────────────────────────────
    app.post("/api/samples/upload", requireUser, uploadLimiter, upload.single("sample"), async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ error: "No file uploaded" });
            const sampleData = {
                name: req.body.name || req.file.originalname,
                filePath: req.file.path,
                fileName: req.file.filename,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                duration: parseFloat(req.body.duration) || 0,
                bpm: req.body.bpm ? parseFloat(req.body.bpm) : null,
                key: req.body.key || null,
                tags: req.body.tags ? JSON.parse(req.body.tags) : [],
                userId: req.user.id,
            };
            const parsed = insertSampleSchema.safeParse(sampleData);
            if (!parsed.success) {
                await fs.unlink(req.file.path);
                return res.status(400).json({ error: "Invalid sample data", details: parsed.error.issues });
            }
            const sample = await storage.createSample(parsed.data);
            res.status(201).json(sample);
        }
        catch (error) {
            logger.error("Error uploading sample:", error);
            if (req.file)
                await fs.unlink(req.file.path).catch((err) => logger.error('Failed to unlink uploaded file', { error: err instanceof Error ? err.message : String(err) }));
            res.status(500).json({ error: "Failed to upload sample" });
        }
    });
    // ── AUDIO ANALYSIS ────────────────────────────────────────────────────────
    app.post("/api/audio/analyze", requireUser, upload.single("audio"), async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ error: "No audio file provided" });
            const { analyzeAudioFile } = await import('./services/audio-analysis');
            const result = await analyzeAudioFile(req.file.path);
            await fs.unlink(req.file.path).catch(() => { });
            res.json(result);
        }
        catch (error) {
            if (req.file)
                await fs.unlink(req.file.path).catch(() => { });
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error("Error analyzing audio:", { message: msg });
            res.status(500).json({ error: "Failed to analyze audio", detail: msg });
        }
    });
    // -- INTERNAL ROUTES (Agi-Suite integration) --
    app.use('/internal', internalRouter);
    // -- INTERNAL ROUTES --
    return httpServer;
}
