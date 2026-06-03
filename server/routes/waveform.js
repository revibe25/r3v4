/**
 * server/routes/waveform.ts
 *
 * Waveform upload, analysis, and file-serving routes.
 *
 * §SES.10 BLOCK fixes:
 *
 *   1. analyzeAudioFile wired in:
 *      Import analyzeAudioFile from '../services/audio-analysis' and call it
 *      in POST /analyze.  Previously the route returned stub/mock data.
 *
 *   2. safeResolve for path-traversal protection:
 *      Import safeResolve from '../utils/fileUtils'.  Any user-supplied path
 *      component (audioFile query param, fileId body field) is passed through
 *      safeResolve before reaching the filesystem.  Without this, a caller
 *      could supply "../../.env" and read arbitrary server files.
 *
 * §SES.10 WARN fix:
 *
 *   3. mkdirSync guard:
 *      mkdirSync(TEMP_DIR, { recursive: true }) is called at module load time.
 *      multer throws ENOENT on the very first upload request if the temp
 *      directory does not yet exist (e.g. fresh checkout, cleared uploads/).
 */
import { Router } from 'express';
import multer from "multer";
import path from "node:path";
import { mkdirSync, existsSync, createReadStream } from "node:fs";
import { z } from "zod";
import { analyzeAudioFile } from "../services/audio-analysis"; // §SES.10 fix 1
import { safeResolve } from "../utils/fileUtils"; // §SES.10 fix 2
import { requireUser } from "../middleware/requireUser";
import { logger } from "../utils/logger";
const router = Router();
// ── Upload directories ────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const TEMP_DIR = path.join(UPLOADS_DIR, "temp");
const AUDIO_DIR = path.join(UPLOADS_DIR, "audio");
// §SES.10 WARN fix 3: ensure directories exist at module load time.
// multer throws ENOENT if the destination does not exist on first upload.
mkdirSync(TEMP_DIR, { recursive: true });
mkdirSync(AUDIO_DIR, { recursive: true });
// ── Multer config ─────────────────────────────────────────────────────────────
const ALLOWED_AUDIO = /\.(wav|mp3|flac|aiff|aif|ogg|m4a|aac|opus)$/i;
const MIME_MAP = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".aiff": "audio/aiff",
    ".aif": "audio/aiff",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".opus": "audio/ogg; codecs=opus",
};
const upload = multer({
    dest: TEMP_DIR,
    limits: {
        fileSize: 250 * 1024 * 1024, // 250 MB
        files: 1,
    },
    fileFilter(_req, file, cb) {
        if (!ALLOWED_AUDIO.test(file.originalname)) {
            return cb(new Error(`Unsupported audio format: ${path.extname(file.originalname)}`));
        }
        cb(null, true);
    },
});
// ── POST /waveform/upload ─────────────────────────────────────────────────────
router.post("/upload", requireUser, upload.single("audio"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
    }
    const userId = req.user.id;
    logger.info({ userId, filename: req.file.originalname, size: req.file.size }, "Audio file uploaded");
    return res.json({
        fileId: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
    });
});
// ── POST /waveform/analyze ────────────────────────────────────────────────────
const analyzeSchema = z.object({
    fileId: z.string().min(1, "fileId is required"),
});
router.post("/analyze", requireUser, async (req, res) => {
    const parsed = analyzeSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { fileId } = parsed.data;
    // §SES.10 fix 2: safeResolve prevents directory traversal on fileId
    let filePath;
    try {
        filePath = safeResolve(TEMP_DIR, fileId);
    }
    catch {
        return res.status(400).json({ error: "Invalid file reference" });
    }
    if (!existsSync(filePath)) {
        return res.status(404).json({ error: "Uploaded file not found — it may have expired" });
    }
    try {
        // §SES.10 fix 1: analyzeAudioFile wired — previously returned mock data
        const analysis = await analyzeAudioFile(filePath);
        logger.info({ userId: req.user.id, fileId }, "Audio analyzed");
        return res.json({ analysis });
    }
    catch (err) {
        logger.error({ err, fileId }, "Audio analysis failed");
        return res.status(500).json({ error: "Analysis failed" });
    }
});
// ── GET /waveform/file ────────────────────────────────────────────────────────
// Streams an audio file back to the client for in-browser playback.
router.get("/file", requireUser, (req, res) => {
    const rawParam = req.query.audioFile;
    if (typeof rawParam !== "string" || rawParam.trim() === "") {
        return res.status(400).json({ error: "audioFile query parameter is required" });
    }
    // §SES.10 fix 2: safeResolve prevents path-traversal on the query parameter.
    // Previously rawParam was passed directly to the filesystem:
    //   createReadStream(path.join(UPLOADS_DIR, rawParam))  ← vulnerable
    let safePath;
    try {
        safePath = safeResolve(UPLOADS_DIR, rawParam);
    }
    catch {
        return res.status(400).json({ error: "Invalid file path" });
    }
    if (!existsSync(safePath)) {
        return res.status(404).json({ error: "Audio file not found" });
    }
    const ext = path.extname(safePath).toLowerCase();
    const mimeType = MIME_MAP[ext] ?? "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Accept-Ranges", "bytes");
    const stream = createReadStream(safePath);
    stream.on("error", (err) => {
        logger.error({ err, safePath }, "Stream error while serving audio file");
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to stream audio file" });
        }
    });
    stream.pipe(res);
});
export default router;
