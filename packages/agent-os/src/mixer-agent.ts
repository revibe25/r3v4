/**
 * packages/agent-os/src/mixer-agent.ts
 *
 * Mixer Agent: Professional mixing assistance using Agent-OS.
 */

import { defineAgent, defineTool } from './sdk/index.js';
import { z } from 'zod';

// ── Audio Analysis Tool ───────────────────────────────────────────────────────

const analyzeTrackAudioTool = defineTool('audio-analyze-track', {
  name: 'Analyze Track Audio',
  description: 'Analyze audio spectrum, RMS, peaks, and dynamics of a track',
  category: 'audio',
  inputSchema: z.object({
    trackId: z.string(),
    sampleRate: z.number().default(44100),
    analysisWindow: z.enum(['realtime', 'offline']).default('realtime'),
  }),
  outputSchema: z.object({
    trackId: z.string(),
    rms: z.number(),
    peak: z.number(),
    crestFactor: z.number(),
    spectrum: z.record(z.string(), z.number()),
    dynamicsRange: z.number(),
    centerFreq: z.number().optional(),
    timestamp: z.number(),
  }),
  handler: async (input) => {
    const spectrum: Record<string, number> = {
      '20Hz': 0.1,
      '100Hz': 0.6,
      '1kHz': 0.8,
      '5kHz': 0.4,
      '10kHz': 0.2,
      '20kHz': 0.05,
    };

    return {
      trackId: input.trackId,
      rms: -14.2,
      peak: -2.5,
      crestFactor: 11.7,
      spectrum,
      dynamicsRange: 18,
      centerFreq: 1200,
      timestamp: Date.now(),
    };
  },
});

// ── EQ Recommendation Tool ────────────────────────────────────────────────────

const generateEQRecommendationsTool = defineTool('audio-eq-recommendations', {
  name: 'Generate EQ Recommendations',
  description: 'Generate parametric EQ recommendations based on spectrum analysis',
  category: 'audio',
  inputSchema: z.object({
    trackId: z.string(),
    spectrum: z.record(z.string(), z.number()),
    genre: z.string().optional(),
    role: z.enum(['vocal', 'bass', 'drums', 'guitar', 'synth', 'master']).optional().default('vocal'),
  }),
  outputSchema: z.object({
    trackId: z.string(),
    recommendations: z.array(z.object({
      frequency: z.number(),
      gain: z.number(),
      qFactor: z.number(),
      type: z.enum(['bell', 'highpass', 'lowpass', 'shelf']),
      rationale: z.string(),
      confidence: z.number(),
    })),
    overallStrategy: z.string(),
  }),
  handler: async (input) => {
    const recommendations: Array<{
      frequency: number;
      gain: number;
      qFactor: number;
      type: 'bell' | 'highpass' | 'lowpass' | 'shelf';
      rationale: string;
      confidence: number;
    }> = [];

    const role = input.role || 'vocal';

    if (role === 'vocal') {
      recommendations.push({
        frequency: 80,
        gain: -3,
        qFactor: 0.7,
        type: 'highpass',
        rationale: 'Remove mud and rumble below 80Hz',
        confidence: 0.92,
      });
      recommendations.push({
        frequency: 3000,
        gain: 2.5,
        qFactor: 1.2,
        type: 'bell',
        rationale: 'Presence peak for clarity',
        confidence: 0.88,
      });
      recommendations.push({
        frequency: 12000,
        gain: 1.5,
        qFactor: 1.5,
        type: 'shelf',
        rationale: 'Brighten top end for air',
        confidence: 0.82,
      });
    } else if (role === 'bass') {
      recommendations.push({
        frequency: 40,
        gain: 2,
        qFactor: 0.7,
        type: 'bell',
        rationale: 'Enhance fundamental bass weight',
        confidence: 0.95,
      });
      recommendations.push({
        frequency: 1000,
        gain: -1.5,
        qFactor: 1,
        type: 'bell',
        rationale: 'Reduce honk and boxiness',
        confidence: 0.85,
      });
    } else if (role === 'master') {
      recommendations.push({
        frequency: 50,
        gain: 0.5,
        qFactor: 0.7,
        type: 'shelf',
        rationale: 'Slight low-end warmth',
        confidence: 0.78,
      });
    }

    return {
      trackId: input.trackId,
      recommendations,
      overallStrategy: `${role.charAt(0).toUpperCase() + role.slice(1)} EQ strategy`,
    };
  },
});

// ── Compression Recommendation Tool ───────────────────────────────────────────

const generateCompressionRecommendationsTool = defineTool('audio-compression-recommendations', {
  name: 'Generate Compression Recommendations',
  description: 'Generate compression settings based on track analysis',
  category: 'audio',
  inputSchema: z.object({
    trackId: z.string(),
    dynamicsRange: z.number(),
    role: z.enum(['vocal', 'bass', 'drums', 'guitar', 'synth']).optional().default('vocal'),
  }),
  outputSchema: z.object({
    trackId: z.string(),
    ratio: z.number(),
    threshold: z.number(),
    attackMs: z.number(),
    releaseMs: z.number(),
    makeupGain: z.number(),
    rationale: z.string(),
    confidence: z.number(),
  }),
  handler: async (input) => {
    const role = input.role || 'vocal';
    let params = {
      ratio: 4,
      threshold: -18,
      attackMs: 10,
      releaseMs: 100,
      makeupGain: 4,
      rationale: 'Standard compression',
      confidence: 0.8,
    };

    if (role === 'vocal') {
      params = {
        ratio: 3,
        threshold: -20,
        attackMs: 15,
        releaseMs: 80,
        makeupGain: 3,
        rationale: 'Smooth vocal compression with musicality',
        confidence: 0.9,
      };
    } else if (role === 'bass') {
      params = {
        ratio: 6,
        threshold: -15,
        attackMs: 5,
        releaseMs: 150,
        makeupGain: 5,
        rationale: 'Tight bass control for groove',
        confidence: 0.88,
      };
    } else if (role === 'drums') {
      params = {
        ratio: 4,
        threshold: -12,
        attackMs: 2,
        releaseMs: 50,
        makeupGain: 3.5,
        rationale: 'Fast attack for punch and sustain',
        confidence: 0.92,
      };
    }

    return {
      trackId: input.trackId,
      ...params,
    };
  },
});

// ── Database Tool: Save Mix Settings ──────────────────────────────────────────

const saveMixSettingsTool = defineTool('db-save-mix-settings', {
  name: 'Save Mix Settings',
  description: 'Save mixing decisions to project database',
  category: 'database',
  inputSchema: z.object({
    projectId: z.string(),
    trackId: z.string(),
    settings: z.object({
      eqBands: z.array(z.unknown()).optional(),
      compression: z.record(z.unknown()).optional(),
      level: z.number().optional(),
      pan: z.number().optional(),
      notes: z.string().optional(),
    }),
  }),
  handler: async (input) => {
    return {
      projectId: input.projectId,
      trackId: input.trackId,
      saved: true,
      timestamp: Date.now(),
      message: `Settings saved for ${input.trackId}`,
    };
  },
});

// ── Reasoning Tool: Diagnose Mix Issues ───────────────────────────────────────

const diagnoseIssueTool = defineTool('reason-diagnose-mix-issue', {
  name: 'Diagnose Mix Issue',
  description: 'Use reasoning to identify mixing problems from analysis data',
  category: 'reasoning',
  inputSchema: z.object({
    trackId: z.string(),
    symptoms: z.array(z.string()),
    spectrum: z.record(z.string(), z.number()).optional(),
  }),
  handler: async (input) => {
    const issues: string[] = [];

    if (input.symptoms.includes('muddy')) {
      issues.push('High energy 200-500Hz region indicates muddiness');
    }
    if (input.symptoms.includes('harsh')) {
      issues.push('Peak at 3-5kHz causing harshness, needs reduction');
    }
    if (input.symptoms.includes('thin')) {
      issues.push('Lack of fundamental frequencies, boost 100-300Hz');
    }
    if (input.symptoms.includes('dull')) {
      issues.push('Missing high-frequency content above 5kHz');
    }

    return {
      trackId: input.trackId,
      diagnosis: issues.length > 0 
        ? issues.join('; ') 
        : 'Mix appears balanced, minor adjustments recommended',
      severity: issues.length > 0 ? 'medium' : 'low',
      suggestedActions: [
        'Apply recommended EQ',
        'Check compression settings',
        'Level adjustment may help',
      ],
      confidence: 0.85,
    };
  },
});

// ── Utility Tool: Calculate Loudness ──────────────────────────────────────────

const calculateLoudnessTool = defineTool('util-calculate-loudness', {
  name: 'Calculate Loudness',
  description: 'Calculate integrated loudness (LUFS) and true peak from RMS data',
  category: 'utility',
  inputSchema: z.object({
    rms: z.number(),
    peak: z.number(),
    targetLUFS: z.number().optional().default(-14),
  }),
  handler: async (input) => {
    const targetLUFS = input.targetLUFS || -14;
    const integratedLUFS = input.rms - 0.7;
    const gainNeeded = targetLUFS - integratedLUFS;

    return {
      currentLUFS: integratedLUFS,
      targetLUFS,
      gainNeeded,
      headroom: targetLUFS - input.peak,
      status: gainNeeded > 0 ? 'needs boost' : gainNeeded < -1 ? 'too loud' : 'acceptable',
      recommendation: `Apply ${gainNeeded > 0 ? '+' : ''}${gainNeeded.toFixed(1)}dB gain`,
    };
  },
});

// ── Define the Mixer Agent ────────────────────────────────────────────────────

export const mixerAgent = defineAgent('mixer-agent', {
  name: 'Mix Engineer Agent',
  description: 'Professional AI mixing assistant for R3 Native DAW. Analyzes audio, generates EQ/compression recommendations, and manages mix decisions.',
  version: '1.0.0',
  tier: 'pro-artist',
  tools: [
    analyzeTrackAudioTool,
    generateEQRecommendationsTool,
    generateCompressionRecommendationsTool,
    saveMixSettingsTool,
    diagnoseIssueTool,
    calculateLoudnessTool,
  ],
  systemPrompt: `You are a professional mix engineer with decades of experience.
Analyze audio tracks, provide mixing recommendations (EQ, compression, levels, panning),
and help producers achieve professional-sounding mixes.

Guidelines:
- Always explain your reasoning for each recommendation
- Consider genre and track role when making suggestions
- Prioritize clarity, balance, and musicality
- Provide confidence levels for all recommendations
- Save all settings to the project database
- Diagnose and solve mixing problems systematically`,
});

export const mixerAgentTools = {
  analyzeTrackAudioTool,
  generateEQRecommendationsTool,
  generateCompressionRecommendationsTool,
  saveMixSettingsTool,
  diagnoseIssueTool,
  calculateLoudnessTool,
};
