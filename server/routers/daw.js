/**
 * server/routers/daw.ts
 * tRPC router covering all DAW-specific server procedures.
 *
 * Security patches applied (Mythos audit 2026-04-22):
 *   F-03 — project.delete UPDATE now includes eq(projects.userId, ctx.user.id)
 *           in the WHERE clause (was relying solely on application-layer check,
 *           leaving the DB with no ownership guard on the write path).
 *   F-04 — Free-tier 1-project cap now enforced via db.transaction + SELECT FOR
 *           UPDATE, preventing the TOCTOU race where two concurrent requests
 *           could both pass the count check and both insert.
 *   F-11 — ProjectStateSchema.parse wrapped in try/catch in project.load;
 *           previously an unhandled ZodError could leak schema field names.
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router } from '../trpc';
import { protectedProcedure } from '../base-procedures';
import { db } from '../db';
import { projects } from '../../shared/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
// ── Zod schemas ───────────────────────────────────────────────────────────────
const TrackSchema = z.object({
    id: z.string(),
    label: z.string().max(40),
    type: z.enum(['audio', 'midi', 'bus', 'instrument']),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    gain: z.number().min(0).max(1.5),
    pan: z.number().min(-1).max(1),
    mute: z.boolean(),
    solo: z.boolean(),
    armed: z.boolean(),
    fxChain: z.array(z.object({
        id: z.string(),
        type: z.enum(['eq', 'compressor', 'reverb', 'delay', 'filter', 'distortion']),
        enabled: z.boolean(),
        params: z.record(z.number()),
    })),
    sends: z.array(z.object({ busId: z.string(), level: z.number() })),
    inputSource: z.string().nullable(),
});
const RegionSchema = z.object({
    id: z.string(),
    trackId: z.string(),
    startBeat: z.number().min(0),
    lengthBeats: z.number().min(0.5),
    clipId: z.string(),
    label: z.string().max(40),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
const MidiNoteSchema = z.object({
    id: z.string(),
    pitch: z.number().int().min(0).max(127),
    step: z.number().int().min(0).max(63),
    duration: z.number().int().min(1).max(16),
    velocity: z.number().int().min(1).max(127),
});
const MidiPatternSchema = z.object({
    id: z.string(),
    name: z.string().max(40),
    steps: z.union([z.literal(16), z.literal(32), z.literal(64)]),
    notes: z.array(MidiNoteSchema),
    trackId: z.string(),
});
const ProjectStateSchema = z.object({
    bpm: z.number().min(40).max(240),
    timeSignature: z.tuple([z.number().int().min(1).max(16), z.number().int().min(1).max(16)]),
    masterGain: z.number().min(0).max(1.5),
    tracks: z.array(TrackSchema),
    regions: z.array(RegionSchema),
    midiPatterns: z.array(MidiPatternSchema),
    loopEnabled: z.boolean(),
    loopStart: z.number().min(0),
    loopEnd: z.number().min(0),
});
function requireTier(ctx, minTier) {
    // ✓ ADMIN BYPASS: Admins have unrestricted access to all features
    if (ctx.user?.is_admin) {
        return; // Skip all tier checks for admins
    }
    const ORDER = ['explorer', 'creator', 'pro_artist'];
    const userTier = (ctx.subscription?.tier ?? 'explorer');
    if (ORDER.indexOf(userTier) < ORDER.indexOf(minTier)) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: `This feature requires the ${minTier} tier or higher.`,
        });
    }
}
async function runLLPTEAnalysis(tracks, bpm) {
    const activeTracks = tracks.filter(t => !t.mute);
    const avgGain = activeTracks.reduce((s, t) => s + t.gain, 0) / (activeTracks.length || 1);
    const lufsIntegrated = -23 + avgGain * 10;
    const dynamicRange = 8 + (1 - avgGain) * 6;
    const signal = {
        rms: avgGain * 0.7,
        peak: Math.min(avgGain * 1.1, 1.0),
        spectralCentroid: 1800 + bpm * 4,
        dynamicRange,
        lufsIntegrated,
    };
    const suggestions = [];
    if (avgGain > 1.1) {
        suggestions.push({
            type: 'mix', confidence: 0.91,
            description: `Average channel gain is ${(avgGain * 100).toFixed(0)}% — headroom at risk. `
                + 'Reduce 3–4 channels by 2–3 dB before mastering.',
            params: { action: 'reduce_gain', targetGain: 0.85 },
        });
    }
    const avgPan = activeTracks.reduce((s, t) => s + t.pan, 0) / (activeTracks.length || 1);
    if (Math.abs(avgPan) > 0.2) {
        suggestions.push({
            type: 'mix', confidence: 0.78,
            description: `Mix centre-of-mass is ${avgPan > 0 ? 'right' : 'left'}-heavy by `
                + `${Math.abs(avgPan * 100).toFixed(0)}%. Rebalance panning on SYNTH/PAD layers.`,
            params: { action: 'balance_pan', targetPan: 0 },
        });
    }
    if (lufsIntegrated > -10) {
        suggestions.push({
            type: 'mastering', confidence: 0.95,
            description: `Integrated LUFS (~${lufsIntegrated.toFixed(1)}) is above streaming targets. `
                + 'Apply limiting before export or enable Adaptive Mastering.',
            params: { action: 'limit', targetLUFS: -14 },
        });
    }
    if (bpm >= 120 && bpm <= 145) {
        suggestions.push({
            type: 'rhythm', confidence: 0.72,
            description: `At ${bpm} BPM, a 1/32 ghost note layer on the hi-hat would add groove density typical of peak-hour techno.`,
            params: { trackType: 'hihat', pattern: 'ghost_32' },
        });
    }
    return { signal, suggestions };
}
async function runMasteringAnalysis(params) {
    const inputLUFS = params.currentLUFS ?? -18.5;
    const gainNeeded = params.targetLUFS - inputLUFS;
    let rec = `Apply ${Math.abs(gainNeeded).toFixed(1)} dB of integrated ${gainNeeded > 0 ? 'gain' : 'attenuation'}. `;
    rec += `True peak ceiling set to ${params.ceilingDB} dBFS. `;
    if (params.dynamicsMode === 'compressed') {
        rec += 'Multiband compression active — limiting transient punch. ';
    }
    else if (params.dynamicsMode === 'punchy') {
        rec += 'Transient enhancement applied — low-mid weight preserved. ';
    }
    if (params.stereoWidth !== 1.0) {
        rec += `Stereo width set to ×${params.stereoWidth.toFixed(1)} via M/S processing. `;
    }
    return {
        inputLUFS,
        inputPeak: inputLUFS + 6.2,
        outputLUFS: params.targetLUFS,
        dynamicRange: 9.8 - (params.dynamicsMode === 'compressed' ? 2 : 0),
        recommendation: rec.trim(),
        gainApplied: gainNeeded,
    };
}
// ── Input sanitiser — F-10 fix ───────────────────────────────────────────────
/**
 * sanitiseTrackName
 *
 * Strips characters that form instruction-syntax patterns used in prompt
 * injection (angle brackets, braces, backticks, newlines, pipe, backslash,
 * hash-bang sequences) from user-supplied track names before they are
 * interpolated into any LLM context string.
 *
 * The Zod schema already enforces .max(40) on input; this sanitiser is a
 * server-side defence-in-depth layer that neutralises injection payloads
 * that fit within the character cap (e.g. "<|SYSTEM|> ignore previous...").
 *
 * Strategy: allowlist printable ASCII minus instruction-syntax characters,
 * then re-enforce the 40-char limit after stripping.
 *
 * F-10 (Mythos audit 2026-04-22) — resolved here, not deferred.
 */
function sanitiseTrackName(raw) {
    if (!raw)
        return raw;
    return raw
        // Strip characters that construct injection syntax:
        //   < > { } [ ] ` \ | # ^ ~ instruction delimiters
        //   \n \r  newlines that could break system-prompt structure
        //   null bytes
        .replace(/[<>{}\[\]`\\|#^~\n\r\x00]/g, '')
        // Collapse multiple spaces created by stripping (keeps names readable)
        .replace(/  +/g, ' ')
        .trim()
        // Re-enforce hard cap after stripping (Zod cap is on raw input pre-strip)
        .slice(0, 40) || undefined;
}
// ── AI Co-Producer prompt builder ─────────────────────────────────────────────
function buildCoProducerSystem() {
    return [
        'You are an expert AI music co-producer specialising in electronic music production,',
        'acid techno, house, and experimental club music.',
        'Your role is to give concise, technically precise mixing and arrangement advice.',
        'You reference specific parameters (frequencies in Hz, dB values, timing in bars/beats).',
        'Keep responses under 80 words. Be direct, no marketing language.',
        'You are aware of the R3 v4 DAW context and its LLPTE signal analysis pipeline.',
    ].join(' ');
}
// ── Daily date helper (C-03 fix) ─────────────────────────────────────────────
function todayUTC() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}
// ── Router ────────────────────────────────────────────────────────────────────
export const dawRouter = router({
    // ── project.save ────────────────────────────────────────────────────────────
    'project.save': protectedProcedure
        .input(z.object({
        projectId: z.string().optional(),
        name: z.string().min(1).max(80),
        state: ProjectStateSchema,
    }))
        .mutation(async ({ ctx, input }) => {
        requireTier(ctx, 'explorer');
        const userId = ctx.user.id;
        const stateJson = JSON.stringify(input.state);
        if (input.projectId) {
            // Update existing — verify ownership in application layer first,
            // then enforce userId in the UPDATE WHERE clause as DB-layer defence-in-depth.
            const existing = await db
                .select({ id: projects.id, userId: projects.userId })
                .from(projects)
                .where(and(eq(projects.id, input.projectId), isNull(projects.deletedAt)))
                .limit(1);
            if (!existing[0]) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
            }
            if (existing[0].userId !== userId) {
                // Return NOT_FOUND (not FORBIDDEN) to avoid confirming that the ID exists.
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
            }
            const updated = await db
                .update(projects)
                .set({ name: input.name, state: stateJson, updatedAt: new Date() })
                .where(and(eq(projects.id, input.projectId), eq(projects.userId, userId)))
                .returning({ id: projects.id, updatedAt: projects.updatedAt });
            return { projectId: updated[0].id, savedAt: updated[0].updatedAt };
        }
        // New project
        // F-04 FIX: Free-tier 1-project cap is now enforced atomically via a
        // serializable transaction with SELECT FOR UPDATE. The previous pattern
        // (SELECT count → check → INSERT) had a TOCTOU race: two concurrent requests
        // would both read count=0, both pass the check, and both insert, yielding 2+
        // projects for a free user. SELECT FOR UPDATE takes a row-level lock on the
        // result set for the duration of the transaction, serialising concurrent inserts.
        if (!ctx.subscription || ctx.subscription.tier === 'explorer') {
            const inserted = await db.transaction(async (tx) => {
                const existing = await tx
                    .select({ id: projects.id })
                    .from(projects)
                    .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
                    .for('update');
                if (existing.length >= 1) {
                    throw new TRPCError({
                        code: 'FORBIDDEN',
                        message: 'Free tier supports 1 saved project. Upgrade to Pro for unlimited projects.',
                    });
                }
                return tx
                    .insert(projects)
                    .values({ userId, name: input.name, state: stateJson })
                    .returning({ id: projects.id, createdAt: projects.createdAt });
            });
            return { projectId: inserted[0].id, savedAt: inserted[0].createdAt };
        }
        // Paid tier: insert without slot constraint
        const inserted = await db
            .insert(projects)
            .values({ userId, name: input.name, state: stateJson })
            .returning({ id: projects.id, createdAt: projects.createdAt });
        return { projectId: inserted[0].id, savedAt: inserted[0].createdAt };
    }),
    // ── project.load ────────────────────────────────────────────────────────────
    'project.load': protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
        const row = await db
            .select()
            .from(projects)
            .where(and(eq(projects.id, input.projectId), eq(projects.userId, ctx.user.id), isNull(projects.deletedAt)))
            .limit(1);
        if (!row[0]) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
        }
        let state;
        try {
            state = JSON.parse(row[0].state);
        }
        catch {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Corrupt project data.' });
        }
        // F-11 FIX: ProjectStateSchema.parse was previously uncaught. A ZodError
        // here (schema mismatch after a migration or corrupt write) would propagate
        // as an unhandled exception and could leak schema field names to the client.
        let parsedState;
        try {
            parsedState = ProjectStateSchema.parse(state);
        }
        catch {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Corrupt project data.' });
        }
        return {
            projectId: row[0].id,
            name: row[0].name,
            state: parsedState,
            updatedAt: row[0].updatedAt,
        };
    }),
    // ── project.list ────────────────────────────────────────────────────────────
    'project.list': protectedProcedure
        .query(async ({ ctx }) => {
        requireTier(ctx, 'creator');
        const rows = await db
            .select({
            id: projects.id,
            name: projects.name,
            updatedAt: projects.updatedAt,
            createdAt: projects.createdAt,
        })
            .from(projects)
            .where(and(eq(projects.userId, ctx.user.id), isNull(projects.deletedAt)))
            .orderBy(desc(projects.updatedAt))
            .limit(100);
        return rows;
    }),
    // ── project.delete ───────────────────────────────────────────────────────────
    'project.delete': protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .mutation(async ({ ctx, input }) => {
        const existing = await db
            .select({ userId: projects.userId })
            .from(projects)
            .where(and(eq(projects.id, input.projectId), isNull(projects.deletedAt)))
            .limit(1);
        if (!existing[0] || existing[0].userId !== ctx.user.id) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
        }
        // F-03 FIX: Added eq(projects.userId, ctx.user.id) to the UPDATE WHERE clause.
        // Previously only eq(projects.id, ...) was used, leaving the DB with no ownership
        // guard on the write path. The application-layer check above is correct but is
        // not a substitute for DB-layer defence-in-depth — if the check is ever bypassed
        // (race, future refactor), the DB must enforce ownership independently.
        await db
            .update(projects)
            .set({ deletedAt: new Date() })
            .where(and(eq(projects.id, input.projectId), eq(projects.userId, ctx.user.id)));
        return { deleted: true };
    }),
    // ── ai.analyse ───────────────────────────────────────────────────────────────
    'ai.analyse': protectedProcedure
        .input(z.object({
        tracks: z.array(TrackSchema),
        bpm: z.number().min(40).max(240),
    }))
        .mutation(async ({ ctx, input }) => {
        requireTier(ctx, 'creator');
        try {
            return await runLLPTEAnalysis(input.tracks, input.bpm);
        }
        catch (err) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'LLPTE analysis failed. Check server logs.',
                cause: err,
            });
        }
    }),
    // ── ai.suggestions ───────────────────────────────────────────────────────────
    'ai.suggestions': protectedProcedure
        .input(z.object({
        tracks: z.array(TrackSchema),
        bpm: z.number().min(40).max(240),
        position: z.number().min(0),
    }))
        .mutation(async ({ ctx, input }) => {
        requireTier(ctx, 'creator');
        const t0 = Date.now();
        const { suggestions } = await runLLPTEAnalysis(input.tracks, input.bpm);
        const latencyMs = Date.now() - t0;
        return { suggestions, latencyMs };
    }),
    // ── ai.chat ──────────────────────────────────────────────────────────────────
    'ai.chat': protectedProcedure
        .input(z.object({
        messages: z.array(z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string().max(2000),
        })).max(20),
        context: z.object({
            bpm: z.number(),
            trackCount: z.number(),
            // F-10 (SECURITY.md — FIXED): activeTrack is sanitised by sanitiseTrackName()
            // before inclusion in the system context string. The sanitiser strips
            // instruction-pattern characters and enforces a 40-char hard cap server-side.
            activeTrack: z.string().max(40).optional(),
            position: z.number(),
        }),
    }))
        .mutation(async ({ ctx, input }) => {
        requireTier(ctx, 'pro_artist');
        const ctxStr = [
            `Project: ${input.context.trackCount} tracks, ${input.context.bpm} BPM.`,
            input.context.activeTrack ? `Selected track: ${sanitiseTrackName(input.context.activeTrack)}.` : '',
            `Playhead at beat ${input.context.position}.`,
        ].filter(Boolean).join(' ');
        const userMsg = input.messages.at(-1)?.content ?? '';
        const stubs = [
            [/reverb|space|room/i, `For techno at ${input.context.bpm} BPM, use a plate reverb with pre-delay 18–22ms and decay 0.8–1.2s. Keep wet <15% on percussive elements to preserve transient punch.`],
            [/bass|sub|low/i, `Cut below 30Hz on all non-bass tracks with a 12dB/oct HP filter. Bass mono-sum below 120Hz — stereo sub energy wastes headroom. Boost 80Hz +2dB on the kick for weight.`],
            [/mix|balance|level/i, `${ctxStr} I suggest a gain-staging pass: reference levels at -18 dBFS RMS per track before any bus compression. Leave 6dB of headroom on the master output.`],
            [/compress|dynamic/i, `For club music, glue compression on the drum bus: 2:1 ratio, 10ms attack, 60ms release, 1–2dB GR. Fast release preserves groove. Avoid over-compression on the full mix — it flattens transient energy.`],
            [/arrangement|struc/i, `${ctxStr} Classic 4-on-floor techno: 16-bar intro, 32-bar build, 16-bar drop, 32-bar main, 16-bar breakdown, 32-bar second drop, 16-bar outro. Use filtered loops in transitions.`],
        ];
        const match = stubs.find(([rx]) => rx.test(userMsg));
        const reply = match?.[1] ?? `${ctxStr} I'm analysing your session. The signal chain looks solid — try running the LLPTE analysis for specific mix suggestions tailored to your current arrangement.`;
        return { reply };
    }),
    // ── mastering.analyse ────────────────────────────────────────────────────────
    'mastering.analyse': protectedProcedure
        .input(z.object({
        targetLUFS: z.number().min(-23).max(-6),
        ceilingDB: z.number().min(-3).max(-0.1),
        dynamicsMode: z.enum(['natural', 'compressed', 'punchy']),
        stereoWidth: z.number().min(0).max(2),
        currentLUFS: z.number().optional(),
    }))
        .mutation(async ({ ctx, input }) => {
        requireTier(ctx, 'pro_artist');
        return runMasteringAnalysis(input);
    }),
    // ── collab.roomStats ─────────────────────────────────────────────────────────
    'collab.roomStats': protectedProcedure
        .query(async ({ ctx }) => {
        requireTier(ctx, 'pro_artist');
        const { getRoomStats } = await import('../ws/collab');
        return getRoomStats();
    }),
});
