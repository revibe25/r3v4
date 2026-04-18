/**
 * server/routes/effects.ts
 *
 * Audio effects routes.
 *
 * §SES.16 BLOCK fix — POST /:id/apply now reads the effect ID from
 *   req.params.id (URL path parameter) instead of req.body.effectId.
 *
 *   Previously the body-supplied effectId completely decoupled the handler
 *   from the URL: any effectId in the body would override the route, violating
 *   REST conventions and allowing a caller to target any effect ID regardless
 *   of what was in the URL.
 *
 *   Fix: const effectId = req.params.id;
 *        Body must NOT contain effectId — use params only.
 */

import { Router }      from "express";
import { z }           from "zod";
import { requireUser } from "../middleware/requireUser";
import { logger }      from "../utils/logger";
import { storage }     from "../storage";

const router = Router();

// ── Effect registry ───────────────────────────────────────────────────────────

type EffectCategory =
  | "eq"
  | "compression"
  | "reverb"
  | "delay"
  | "saturation"
  | "modulation"
  | "filter";

type ParamSpec = {
  type:    "float" | "int" | "bool";
  min?:    number;
  max?:    number;
  default: number | boolean;
  unit?:   string;
};

interface EffectMeta {
  id:          string;
  name:        string;
  category:    EffectCategory;
  description: string;
  parameters:  Record<string, ParamSpec>;
}

// Explicit Map<string, EffectMeta> type — no `as const` narrowing needed
const EFFECTS_REGISTRY = new Map<string, EffectMeta>([
  ["eq-3band", {
    id: "eq-3band", name: "3-Band EQ", category: "eq",
    description: "Low / mid / high shelf equalizer",
    parameters: {
      lowGain:   { type: "float", min: -24, max: 24, default: 0, unit: "dB" },
      midGain:   { type: "float", min: -24, max: 24, default: 0, unit: "dB" },
      highGain:  { type: "float", min: -24, max: 24, default: 0, unit: "dB" },
      midFreq:   { type: "float", min: 200, max: 8000, default: 1000, unit: "Hz" },
    },
  }],
  ["compressor", {
    id: "compressor", name: "Dynamics Compressor", category: "compression",
    description: "Feed-forward dynamic range compressor",
    parameters: {
      threshold: { type: "float", min: -60, max: 0,   default: -12,  unit: "dB" },
      ratio:     { type: "float", min: 1,   max: 20,  default: 4             },
      attack:    { type: "float", min: 0,   max: 1,   default: 0.003, unit: "s" },
      release:   { type: "float", min: 0,   max: 1,   default: 0.25,  unit: "s" },
      knee:      { type: "float", min: 0,   max: 40,  default: 10,    unit: "dB" },
    },
  }],
  ["reverb", {
    id: "reverb", name: "Convolution Reverb", category: "reverb",
    description: "Impulse-response based room reverb",
    parameters: {
      roomSize: { type: "float", min: 0, max: 1, default: 0.5 },
      wet:      { type: "float", min: 0, max: 1, default: 0.3 },
      dry:      { type: "float", min: 0, max: 1, default: 0.7 },
      preDelay: { type: "float", min: 0, max: 0.5, default: 0.02, unit: "s" },
    },
  }],
  ["delay", {
    id: "delay", name: "Tape Delay", category: "delay",
    description: "Tempo-syncable tape delay with feedback",
    parameters: {
      delayTime: { type: "float", min: 0, max: 2, default: 0.25, unit: "s" },
      feedback:  { type: "float", min: 0, max: 0.95, default: 0.3 },
      mix:       { type: "float", min: 0, max: 1, default: 0.25 },
    },
  }],
  ["saturation", {
    id: "saturation", name: "Tape Saturation", category: "saturation",
    description: "Harmonic saturation / soft-clip",
    parameters: {
      drive:  { type: "float", min: 0, max: 1, default: 0.3 },
      colour: { type: "float", min: 0, max: 1, default: 0.5 },
      output: { type: "float", min: -12, max: 6, default: 0, unit: "dB" },
    },
  }],
]);

// ── Schemas ───────────────────────────────────────────────────────────────────

const applyEffectSchema = z.object({
  trackId:    z.string().min(1, "trackId is required"),
  parameters: z.record(z.union([z.number(), z.boolean()])).optional().default({}),
  // NOTE: effectId must NOT be accepted here — use req.params.id (§SES.16)
});

// ── GET /effects ──────────────────────────────────────────────────────────────

router.get("/", requireUser, (_req, res) => {
  const effects = Array.from(EFFECTS_REGISTRY.values());
  res.json({ effects, total: effects.length });
});

// ── GET /effects/:id ──────────────────────────────────────────────────────────

router.get("/:id", requireUser, (req, res) => {
  const effect = EFFECTS_REGISTRY.get(req.params.id);
  if (!effect) {
    return res.status(404).json({ error: `Effect '${req.params.id}' not found` });
  }
  return res.json({ effect });
});

// ── POST /effects/:id/apply ───────────────────────────────────────────────────

router.post("/:id/apply", requireUser, async (req, res) => {
  // §SES.16 BLOCK fix: effectId comes from the URL path parameter only.
  // Do NOT fall back to req.body.effectId — that would decouple the handler
  // from the route and violate REST semantics.
  const effectId = req.params.id;

  const parsed = applyEffectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const effect = EFFECTS_REGISTRY.get(effectId);
  if (!effect) {
    return res.status(404).json({ error: `Effect '${effectId}' not found` });
  }

  const { trackId, parameters } = parsed.data;
  const userId = req.user!.id;

  try {
    const result = await storage.applyEffectToTrack({
      userId,
      trackId,
      effectId,
      settings: parameters,
    });

    logger.info({ userId, trackId, effectId }, "Effect applied");
    return res.json({ success: true, effectId, trackId, result });
  } catch (err) {
    logger.error({ err, userId, trackId, effectId }, "Failed to apply effect");
    return res.status(500).json({ error: "Failed to apply effect" });
  }
});

// ── DELETE /effects/:id/apply ─────────────────────────────────────────────────

router.delete("/:id/apply", requireUser, async (req, res) => {
  const effectId = req.params.id;

  const bodySchema = z.object({ trackId: z.string().min(1) });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "trackId is required" });
  }

  const { trackId } = parsed.data;
  const userId = req.user!.id;

  try {
    await storage.removeEffectFromTrack({ userId, trackId, effectId });
    logger.info({ userId, trackId, effectId }, "Effect removed");
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId, trackId, effectId }, "Failed to remove effect");
    return res.status(500).json({ error: "Failed to remove effect" });
  }
});

export default router;
