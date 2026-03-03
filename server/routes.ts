import { logger } from './lib/logger';
import type { Express, RequestHandler } from "express";
import type { Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { insertSessionSchema, insertProjectSchema, insertSampleSchema, insertPresetSchema } from "./db/schema";
import { storage } from "./storage";

// Configure multer for audio file uploads
const uploadDir = path.join(process.cwd(), "uploads");
const samplesDir = path.join(uploadDir, "samples");
const projectsDir = path.join(uploadDir, "projects");

const storage_config = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(samplesDir, { recursive: true });
      await fs.mkdir(projectsDir, { recursive: true });
      
      if (file.fieldname === "sample") {
        cb(null, samplesDir);
      } else if (file.fieldname === "project") {
        cb(null, projectsDir);
      } else {
        cb(null, uploadDir);
      }
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "audio/wav",
      "audio/mpeg",
      "audio/mp3",
      "audio/ogg",
      "audio/flac",
      "audio/x-wav",
      "audio/x-m4a",
      "application/octet-stream" // For .r3v project files
    ];

    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.r3v')) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only audio files are allowed."));
    }
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ==================== SESSION ROUTES ====================

  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await storage.getSessions();
      res.json(sessions);
    } catch (error) {
      logger.error("Error fetching sessions:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      logger.error("Error fetching session:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      const parsed = insertSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid session data", 
          details: parsed.error.issues  // was: .errors — Zod v3 uses .issues
        });
      }
      const session = await storage.createSession(parsed.data as any);
      res.status(201).json(session);
    } catch (error) {
      logger.error("Error creating session:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.updateSession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      logger.error("Error updating session:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSession(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Error deleting session:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // ==================== PROJECT ROUTES ====================

  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      logger.error("Error fetching projects:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      logger.error("Error fetching project:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid project data", 
          details: parsed.error.issues  // was: .errors
        });
      }
      const project = await storage.createProject(parsed.data as any);
      res.status(201).json(project);
    } catch (error) {
      logger.error("Error creating project:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      logger.error("Error updating project:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Error deleting project:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // ==================== SAMPLE ROUTES ====================

  app.get("/api/samples", async (req, res) => {
    try {
      const samples = await storage.getSamples();
      res.json(samples);
    } catch (error) {
      logger.error("Error fetching samples:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to fetch samples" });
    }
  });

  app.get("/api/samples/:id", async (req, res) => {
    try {
      const sample = await storage.getSample(req.params.id);
      if (!sample) {
        return res.status(404).json({ error: "Sample not found" });
      }
      res.json(sample);
    } catch (error) {
      logger.error("Error fetching sample:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to fetch sample" });
    }
  });

  // Cast upload.single() to RequestHandler to satisfy Express overload resolution
  app.post(
    "/api/samples/upload",
    upload.single("sample") as unknown as RequestHandler,
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

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
        };

        const parsed = insertSampleSchema.safeParse(sampleData);
        if (!parsed.success) {
          await fs.unlink(req.file.path);
          return res.status(400).json({ 
            error: "Invalid sample data", 
            details: parsed.error.issues  // was: .errors
          });
        }

        const sample = await storage.createSample(parsed.data as any);
        res.status(201).json(sample);
      } catch (error) {
        logger.error("Error uploading sample:", error as Record<string, unknown>);
        if (req.file) {
          await fs.unlink(req.file.path).catch(console.error);
        }
        res.status(500).json({ error: "Failed to upload sample" });
      }
    }
  );

  app.get("/api/samples/:id/download", async (req, res) => {
    try {
      const sample = await storage.getSample(req.params.id);
      if (!sample) {
        return res.status(404).json({ error: "Sample not found" });
      }

      const filePath = path.join(process.cwd(), sample.filePath);
      res.download(filePath, sample.fileName);
    } catch (error) {
      logger.error("Error downloading sample:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to download sample" });
    }
  });

  app.delete("/api/samples/:id", async (req, res) => {
    try {
      const sample = await storage.getSample(req.params.id);
      if (!sample) {
        return res.status(404).json({ error: "Sample not found" });
      }

      const filePath = path.join(process.cwd(), sample.filePath);
      await fs.unlink(filePath).catch(console.error);

      const deleted = await storage.deleteSample(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Sample not found" });
      }

      res.status(204).send();
    } catch (error) {
      logger.error("Error deleting sample:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to delete sample" });
    }
  });

  // ==================== PRESET ROUTES ====================

  app.get("/api/presets", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const presets = await storage.getPresets(type);
      res.json(presets);
    } catch (error) {
      logger.error("Error fetching presets:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to fetch presets" });
    }
  });

  app.get("/api/presets/:id", async (req, res) => {
    try {
      const preset = await storage.getPreset(req.params.id);
      if (!preset) {
        return res.status(404).json({ error: "Preset not found" });
      }
      res.json(preset);
    } catch (error) {
      logger.error("Error fetching preset:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to fetch preset" });
    }
  });

  app.post("/api/presets", async (req, res) => {
    try {
      const parsed = insertPresetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid preset data", 
          details: parsed.error.issues  // was: .errors
        });
      }
      const preset = await storage.createPreset(parsed.data as any);
      res.status(201).json(preset);
    } catch (error) {
      logger.error("Error creating preset:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to create preset" });
    }
  });

  app.patch("/api/presets/:id", async (req, res) => {
    try {
      const preset = await storage.updatePreset(req.params.id, req.body);
      if (!preset) {
        return res.status(404).json({ error: "Preset not found" });
      }
      res.json(preset);
    } catch (error) {
      logger.error("Error updating preset:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to update preset" });
    }
  });

  app.delete("/api/presets/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePreset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Preset not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Error deleting preset:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to delete preset" });
    }
  });

  // ==================== SETTINGS ROUTES ====================

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      logger.error("Error fetching settings:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const settings = await storage.updateSettings(req.body);
      res.json(settings);
    } catch (error) {
      logger.error("Error updating settings:", error as Record<string, unknown>);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ==================== AUDIO PROCESSING ROUTES ====================

  app.post(
    "/api/audio/analyze",
    upload.single("audio") as unknown as RequestHandler,  // cast for overload resolution
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No audio file provided" });
        }

        // Audio analysis (BPM detection, key detection, etc.) — implement with music-metadata or essentia.js
        res.json({
          duration: 0,
          bpm: null,
          key: null,
          peaks: [],
        });

        await fs.unlink(req.file.path);
      } catch (error) {
        logger.error("Error analyzing audio:", error as Record<string, unknown>);
        res.status(500).json({ error: "Failed to analyze audio" });
      }
    }
  );

  return httpServer;
}