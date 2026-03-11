import { z } from 'zod';
/**
 * server/routes.ts
 *
 * Canonical REST surface - tRPC handles all CRUD.
 * Only routes that cannot be expressed as tRPC procedures live here:
 *   . /api/auth/*          - token issuance (login/register/me/refresh)
 *   . /api/samples/upload  - multipart file upload (tRPC cannot handle multipart)
 *   . /api/audio/analyze   - reserved; returns 501 until llpte-signal is wired in
 *
 * All session/project/preset/settings CRUD has been removed - the client
 * calls those exclusively via tRPC (/api/trpc/*) and the duplicate REST
 * surface was untested, unmaintained dead code.
 */

import { logger } from './lib/logger';
import type { Express, RequestHandler } from "express";
import type { Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { insertSampleSchema } from "./db/schema";
import { storage } from "./storage";
import { requireUser } from "./middleware/auth";
import authRouter from "./routes/auth";
import { uploadLimiter } from "./middleware/rateLimit";

const uploadDir   = path.join(process.cwd(), "uploads");
const samplesDir  = path.join(uploadDir, "samples");
const projectsDir = path.join(uploadDir, "projects");

const storage_config = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(samplesDir,  { recursive: true });
      await fs.mkdir(projectsDir, { recursive: true });
      if      (file.fieldname === "sample")  cb(null, samplesDir);
      else if (file.fieldname === "project") cb(null, projectsDir);
      else                                   cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
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
    } else {
      cb(new Error("Invalid file type. Only audio files are allowed."));
    }
  },
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // AUTH
  app.use('/api/auth', authRouter);

  // SAMPLE UPLOAD
  app.post(
    "/api/samples/upload",
    requireUser,
    uploadLimiter as unknown as RequestHandler,
    upload.single("sample") as unknown as RequestHandler,
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const sampleData = {
          name:     req.body.name || req.file.originalname,
          filePath: req.file.path,
          fileName: req.file.filename,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          duration: parseFloat(req.body.duration) || 0,
          bpm:      req.body.bpm ? parseFloat(req.body.bpm) : null,
          key:      req.body.key || null,
          tags:     req.body.tags ? JSON.parse(req.body.tags) : [],
          userId:   req.user!.id,
        };

        const parsed = insertSampleSchema.safeParse(sampleData);
        if (!parsed.success) {
          await fs.unlink(req.file.path);
          return res.status(400).json({ error: "Invalid sample data", details: parsed.error.issues });
        }

        const sample = await storage.createSample(parsed.data as any);
        res.status(201).json(sample);
      } catch (error) {
        logger.error("Error uploading sample:", error as Record<string, unknown>);
        if (req.file) await fs.unlink(req.file.path).catch(console.error);
        res.status(500).json({ error: "Failed to upload sample" });
      }
    },
  );

  // AUDIO ANALYSIS
  app.post(
    "/api/audio/analyze",
    requireUser,
    upload.single("audio") as unknown as RequestHandler,
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No audio file provided" });
        const { analyzeAudioFile } = await import('./services/audio-analysis');
        const result = await analyzeAudioFile(req.file.path);
        await fs.unlink(req.file.path).catch(() => {});
        res.json(result);
      } catch (error) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.error("Error analyzing audio:", { message: msg });
        res.status(500).json({ error: "Failed to analyze audio", detail: msg });
      }
    },
  );

  return httpServer;
}
