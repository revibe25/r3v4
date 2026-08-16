/**
 * EXAMPLE.ts
 *
 * Complete example of Agent-OS: Building a music production agent
 * with Openclaw tool routing and Hermes reasoning engine.
 *
 * This demonstrates:
 * 1. Defining tools (audio, database, integration)
 * 2. Creating an agent with SDK
 * 3. Running with Hermes planning
 * 4. Routing through Openclaw
 * 5. Sending results back to Stable via tRPC bridge
 */

import {
  defineAgent,
  defineTool,
  AgentRuntime,
  OpenclawRouter,
  HermesEngine,
  HermesBatchPlanner,
  StableBridge,
  ConsoleLogger,
} from './src/index.js';
import { z } from 'zod';

// ── 1. Define Tools ───────────────────────────────────────────────────────────

// Audio analysis tool
const analyzeAudioTool = defineTool('audio-analyze', {
  name: 'Analyze Audio',
  description: 'Analyze audio spectrum and dynamics',
  category: 'audio',
  inputSchema: z.object({
    trackId: z.string(),
    sampleRate: z.number().default(44100),
  }),
  outputSchema: z.object({
    trackId: z.string(),
    rms: z.number(),
    peaks: z.array(z.number()),
    spectrum: z.record(z.number()),
  }),
  handler: async (input) => {
    // Simulate audio analysis
    return {
      trackId: input.trackId,
      rms: -12.5,
      peaks: [-3, -2.5, -4],
      spectrum: {
        '100Hz': 0.5,
        '1kHz': 0.7,
        '10kHz': 0.3,
      },
    };
  },
});

// Database tool: Save mix settings
const saveMixSettingsTool = defineTool('db-save-mix', {
  name: 'Save Mix Settings',
  description: 'Save mix configuration to database',
  category: 'database',
  inputSchema: z.object({
    projectId: z.string(),
    settings: z.record(z.unknown()),
  }),
  handler: async (input) => {
    // Simulate database write
    return {
      projectId: input.projectId,
      saved: true,
      timestamp: Date.now(),
    };
  },
});

// Integration tool: Export to Stripe (for subscription)
const checkSubscriptionTool = defineTool('stripe-check-sub', {
  name: 'Check Subscription',
  description: 'Verify user subscription tier via Stripe API',
  category: 'integration',
  inputSchema: z.object({
    userId: z.string(),
  }),
  handler: async (input) => {
    // Simulate Stripe API call
    return {
      userId: input.userId,
      tier: 'pro-artist',
      active: true,
      features: ['unlimited-tracks', 'hermes-reasoning'],
    };
  },
});

// Utility tool: Generate mix recommendations
const generateRecommendationsTool = defineTool('util-gen-recs', {
  name: 'Generate Recommendations',
  description: 'Generate mix parameter recommendations based on audio analysis',
  category: 'utility',
  inputSchema: z.object({
    spectrum: z.record(z.number()),
    genre: z.string().optional(),
  }),
  handler: async (input) => {
    return {
      recommendations: [
        { parameter: 'bass_gain', value: 2.5, reason: 'Boost low frequencies' },
        { parameter: 'treble_gain', value: -1.0, reason: 'Reduce harshness' },
      ],
    };
  },
});

// Reasoning tool: Analyze production issue
const analyzeIssueTool = defineTool('reason-analyze-issue', {
  name: 'Analyze Production Issue',
  description: 'Use reasoning to diagnose production problems',
  category: 'reasoning',
  inputSchema: z.object({
    symptoms: z.array(z.string()),
  }),
  handler: async (input) => {
    return {
      diagnosis: 'Likely EQ issue in midrange',
      severity: 'medium',
      suggestedAction: 'Apply parametric EQ boost at 2kHz',
    };
  },
});

// ── 2. Define Agent ───────────────────────────────────────────────────────────

const musicProductionAgent = defineAgent('music-producer-agent', {
  name: 'Music Producer Agent',
  description: 'AI agent for music production and mixing assistance',
  version: '1.0.0',
  tier: 'founder',
  tools: [
    analyzeAudioTool,
    saveMixSettingsTool,
    checkSubscriptionTool,
    generateRecommendationsTool,
    analyzeIssueTool,
  ],
  systemPrompt: `You are a professional music producer AI. Your job is to analyze audio,
suggest mixing decisions, and help users optimize their productions. Be analytical,
precise, and provide rationale for all recommendations.`,
});

// ── 3. Main Workflow ──────────────────────────────────────────────────────────

async function runMusicProductionWorkflow() {
  const logger = new ConsoleLogger('[MusicProducerWorkflow]');

  // Initialize Agent Runtime
  const runtime = new AgentRuntime(musicProductionAgent, logger);
  const context = await runtime.initialize(
    'session-123', // sessionId
    'user-456', // userId
    {
      projectId: 'proj-789',
      genre: 'Electronic',
      targetLUFS: -14,
    }
  );

  logger.info('✓ Agent runtime initialized', {
    agentId: musicProductionAgent.id,
    tools: context.tools.size,
  });

  // Initialize Openclaw Router
  const openclaw = new OpenclawRouter(logger);

  logger.info('✓ Openclaw router ready', {
    handlers: openclaw.getHandlers().size,
  });

  // Initialize Hermes Engine
  const hermes = new HermesEngine(
    {
      mode: 'hybrid',
      maxThoughts: 50,
      enableMemory: true,
      enableReflection: true,
    },
    logger
  );

  logger.info('✓ Hermes reasoning engine ready');

  // ── Reasoning Phase ───────────────────────────────────────────────────────

  // 1. Hermes analyzes the production task
  const goal = 'Optimize mix levels and EQ for electronic dance music';
  const plan = hermes.createPlan(goal, runtime.getTools(), context.session.context);

  logger.info('✓ Hermes created plan', {
    steps: plan.steps.length,
    estimatedCost: plan.estimatedCost,
  });

  // 2. Hermes generates thoughts on strategy
  const strategyThought = hermes.addThought(
    'reasoning',
    'Electronic music benefits from clear bass and bright highs. Will use audio analysis then apply EQ.',
    0.88
  );

  // ── Execution Phase ───────────────────────────────────────────────────────

  logger.info('\n=== EXECUTION PHASE ===');

  // Execute plan step 1: Analyze audio via Openclaw
  const analyzeResult = await openclaw.route(analyzeAudioTool, {
    trackId: 'track-master',
    sampleRate: 44100,
  });

  logger.info('✓ Audio analyzed via Openclaw', {
    duration: `${analyzeResult.duration}ms`,
  });

  if (analyzeResult.error) {
    logger.error('Audio analysis failed', { error: analyzeResult.error });
  } else {
    context.session.context.audioData = analyzeResult.output;
  }

  // Execute plan step 2: Check subscription (integration tool)
  const subResult = await openclaw.route(checkSubscriptionTool, {
    userId: context.session.userId,
  });

  logger.info('✓ Subscription verified', { duration: `${subResult.duration}ms` });

  // Execute plan step 3: Generate recommendations
  const recResult = await openclaw.route(generateRecommendationsTool, {
    spectrum: { '100Hz': 0.5, '1kHz': 0.7, '10kHz': 0.3 },
    genre: 'Electronic',
  });

  logger.info('✓ Recommendations generated', { duration: `${recResult.duration}ms` });

  // Execute plan step 4: Save to database
  const saveResult = await openclaw.route(saveMixSettingsTool, {
    projectId: context.session.context.projectId as string,
    settings: {
      recommendations: recResult.output,
      timestamp: Date.now(),
    },
  });

  logger.info('✓ Settings saved to database', { duration: `${saveResult.duration}ms` });

  // ── Reflection Phase ──────────────────────────────────────────────────────

  logger.info('\n=== REFLECTION PHASE ===');

  const reflection = await hermes.reflect();
  if (reflection) {
    logger.info('✓ Hermes reflected on execution', {
      thought: reflection.content.slice(0, 50),
    });
  }

  // ── Send Results Back to Stable ───────────────────────────────────────────

  logger.info('\n=== SENDING RESULTS TO STABLE ===');

  const bridge = new StableBridge(
    'http://localhost:3000',
    process.env.AGENT_SERVICE_TOKEN || 'test-token',
    logger
  );

  try {
    // Send mix decisions to Stable
    const mixResult = await bridge.sendMixResult({
      sessionId: context.session.sessionId,
      agentId: musicProductionAgent.id,
      trackIds: ['track-master'],
      targetLUFS: -14,
      genre: 'Electronic',
      decisions: [
        {
          trackId: 'track-master',
          parameter: 'bass_gain',
          value: 2.5,
          confidence: 0.88,
        },
        {
          trackId: 'track-master',
          parameter: 'treble_gain',
          value: -1.0,
          confidence: 0.82,
        },
      ],
      timestamp: Date.now(),
    });

    logger.info('✓ Mix result sent to Stable', { response: mixResult });
  } catch (err) {
    logger.error('Failed to send mix result', { error: String(err) });
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  logger.info('\n=== WORKFLOW COMPLETE ===');
  logger.info('Final state:', {
    sessionState: context.session.state,
    thoughtCount: hermes.getThoughts().length,
    planCount: hermes.getPlans().length,
    toolsAvailable: context.tools.size,
  });

  // Print thoughts for audit trail
  const recentThoughts = hermes.getThoughts().slice(-5);
  logger.info('Recent reasoning:', {
    thoughts: recentThoughts.map(t => ({
      type: t.type,
      confidence: t.confidence,
      content: t.content.slice(0, 40),
    })),
  });
}

// ── Run Example ───────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  runMusicProductionWorkflow().catch(console.error);
}

export { runMusicProductionWorkflow };
