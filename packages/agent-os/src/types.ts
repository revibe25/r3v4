/**
 * src/types.ts
 *
 * Core type definitions and Zod schemas for Agent-OS.
 * Bridges Agent-OS (Openclaw + Hermes) with Stable tRPC callbacks.
 */

import { z } from 'zod';

// ── Agent Core Types ──────────────────────────────────────────────────────────

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  tools: ToolDefinition[];
  systemPrompt?: string;
  tier: 'explorer' | 'pro-artist' | 'founder' | 'enterprise';
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
  inputSchema: z.ZodSchema;
  outputSchema?: z.ZodSchema;
  category: 'audio' | 'integration' | 'database' | 'utility' | 'reasoning';
}

export interface ToolCall {
  toolId: string;
  input: Record<string, unknown>;
  id: string;
}

export interface ToolResult {
  toolId: string;
  output: unknown;
  error?: string;
  duration: number;
}

// ── Session & Context ─────────────────────────────────────────────────────────

export interface AgentSession {
  sessionId: string;
  agentId: string;
  userId: string;
  startedAt: number;
  context: Record<string, unknown>;
  state: 'active' | 'paused' | 'completed' | 'failed';
}

export interface AgentContext {
  session: AgentSession;
  tools: Map<string, ToolDefinition>;
  memory: AgentMemory;
  logger: AgentLogger;
}

export interface AgentMemory {
  shortTerm: Record<string, unknown>;
  longTerm?: Record<string, unknown>;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  clear(): void;
}

export interface AgentLogger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

// ── Hermes Reasoning Types ────────────────────────────────────────────────────

export interface HermesThought {
  id: string;
  type: 'analysis' | 'planning' | 'reasoning' | 'reflection';
  content: string;
  confidence: number;
  timestamp: number;
}

export interface HermesPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  reasoning: HermesThought[];
  estimatedCost: number;
}

export interface PlanStep {
  id: string;
  action: 'tool_call' | 'decision' | 'wait';
  toolId?: string;
  input?: Record<string, unknown>;
  decision?: string;
  rationale: string;
}

export interface HermesOutput {
  type: 'decision' | 'plan' | 'reflection';
  content: unknown;
  confidence: number;
  reasoning: HermesThought[];
}

// ── Mix & Audio Decision Types ────────────────────────────────────────────────

export interface MixDecision {
  trackId: string;
  parameter: string;
  value: number;
  confidence: number;
  rationale?: string;
}

export interface MixResult {
  sessionId: string;
  agentId: string;
  trackIds: string[];
  targetLUFS?: number;
  genre?: string;
  decisions: MixDecision[];
  audioData?: Record<string, unknown>;
  timestamp: number;
}

export interface DiagnosticsResult {
  sessionId: string;
  agentId: string;
  symptoms: string[];
  findings: DiagnosticFinding[];
  recommendations: string[];
  timestamp: number;
}

export interface DiagnosticFinding {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  fix?: string;
}

// ── Zod Schemas (for validation/tRPC) ─────────────────────────────────────────

export const toolCallSchema = z.object({
  toolId: z.string(),
  input: z.record(z.unknown()),
  id: z.string().optional(),
});

export const toolResultSchema = z.object({
  toolId: z.string(),
  output: z.unknown(),
  error: z.string().optional(),
  duration: z.number(),
});

export const mixDecisionSchema = z.object({
  trackId: z.string(),
  parameter: z.string(),
  value: z.number(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

export const mixResultSchema = z.object({
  sessionId: z.string(),
  agentId: z.string(),
  trackIds: z.array(z.string()),
  targetLUFS: z.number().optional(),
  genre: z.string().optional(),
  decisions: z.array(mixDecisionSchema),
  audioData: z.record(z.unknown()).optional(),
  timestamp: z.number(),
});

export const diagnosticsSchema = z.object({
  sessionId: z.string(),
  agentId: z.string(),
  symptoms: z.array(z.string()),
  findings: z.array(z.object({
    code: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    message: z.string(),
    fix: z.string().optional(),
  })),
  recommendations: z.array(z.string()),
  timestamp: z.number(),
});

// Type exports for tRPC usage
export type MixResultInput = z.infer<typeof mixResultSchema>;
export type DiagnosticsInput = z.infer<typeof diagnosticsSchema>;
export type ToolCallInput = z.infer<typeof toolCallSchema>;
