import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { storage } from "./storage";
import { insertSessionSchema, insertProjectSchema, insertSampleSchema, insertPresetSchema } from "@shared/schema";

// Configure multer for audio file uploads
const uploadDir = path.join(process.cwd(), "uploads");
const samplesDir = path.join(uploadDir, "samples");
const projectsDir = path.join(uploadDir, "projects");

// Ensure upload directories exist
await fs.mkdir(samplesDir, { recursive: true });
await fs.mkdir(projectsDir, { recursive: true });

const storage_config = multer.diskStorage({
  destination: async (req, file, cb) => {
    if (file.fieldname === "sample") {
      cb(null, samplesDir);
    } else if (file.fieldname === "project") {
      cb(null, projectsDir);
    } else {
      cb(null, uploadDir);
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
      console.error("Error fetching sessions:", error);
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
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      const parsed = insertSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid session data", 
          details: parsed.error.errors 
        });
      }
      const session = await storage.createSession(parsed.data);
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating session:", error);
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
      console.error("Error updating session:", error);
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
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // ==================== PROJECT ROUTES ====================

  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
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
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const parsed = insertProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid project data", 
          details: parsed.error.errors 
        });
      }
      const project = await storage.createProject(parsed.data);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
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
      console.error("Error updating project:", error);
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
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // ==================== SAMPLE ROUTES ====================

  app.get("/api/samples", async (req, res) => {
    try {
      const samples = await storage.getSamples();
      res.json(samples);
    } catch (error) {
      console.error("Error fetching samples:", error);
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
      console.error("Error fetching sample:", error);
      res.status(500).json({ error: "Failed to fetch sample" });
    }
  });

  app.post("/api/samples/upload", upload.single("sample"), async (req, res) => {
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
        // Delete uploaded file if validation fails
        await fs.unlink(req.file.path);
        return res.status(400).json({ 
          error: "Invalid sample data", 
          details: parsed.error.errors 
        });
      }

      const sample = await storage.createSample(parsed.data);
      res.status(201).json(sample);
    } catch (error) {
      console.error("Error uploading sample:", error);
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ error: "Failed to upload sample" });
    }
  });

  app.get("/api/samples/:id/download", async (req, res) => {
    try {
      const sample = await storage.getSample(req.params.id);
      if (!sample) {
        return res.status(404).json({ error: "Sample not found" });
      }

      const filePath = path.join(process.cwd(), sample.filePath);
      res.download(filePath, sample.fileName);
    } catch (error) {
      console.error("Error downloading sample:", error);
      res.status(500).json({ error: "Failed to download sample" });
    }
  });

  app.delete("/api/samples/:id", async (req, res) => {
    try {
      const sample = await storage.getSample(req.params.id);
      if (!sample) {
        return res.status(404).json({ error: "Sample not found" });
      }

      // Delete file from disk
      const filePath = path.join(process.cwd(), sample.filePath);
      await fs.unlink(filePath).catch(console.error);

      // Delete from database
      const deleted = await storage.deleteSample(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Sample not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting sample:", error);
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
      console.error("Error fetching presets:", error);
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
      console.error("Error fetching preset:", error);
      res.status(500).json({ error: "Failed to fetch preset" });
    }
  });

  app.post("/api/presets", async (req, res) => {
    try {
      const parsed = insertPresetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid preset data", 
          details: parsed.error.errors 
        });
      }
      const preset = await storage.createPreset(parsed.data);
      res.status(201).json(preset);
    } catch (error) {
      console.error("Error creating preset:", error);
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
      console.error("Error updating preset:", error);
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
      console.error("Error deleting preset:", error);
      res.status(500).json({ error: "Failed to delete preset" });
    }
  });

  // ==================== SETTINGS ROUTES ====================

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const settings = await storage.updateSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ==================== AUDIO PROCESSING ROUTES ====================

  app.post("/api/audio/analyze", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      // TODO: Implement audio analysis (BPM detection, key detection, etc.)
      // This would use a library like music-metadata or essentia.js

      res.json({
        duration: 0, // Placeholder
        bpm: null,
        key: null,
        peaks: [],
      });

      // Clean up temporary file
      await fs.unlink(req.file.path);
    } catch (error) {
      console.error("Error analyzing audio:", error);
      res.status(500).json({ error: "Failed to analyze audio" });
    }
  });

  return httpServer;
}