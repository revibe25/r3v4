/**
 * src/sdk/index.ts
 *
 * Agent-OS SDK: defineAgent, defineTool, AgentRuntime
 * Core framework for building agents with Openclaw + Hermes.
 */

import { z } from 'zod';
import {
  AgentDefinition,
  ToolDefinition,
  AgentContext,
  AgentSession,
  AgentMemory,
  AgentLogger,
  ToolCall,
  ToolResult,
} from '../types.js';

// ── Logger Implementation ─────────────────────────────────────────────────────

export class ConsoleLogger implements AgentLogger {
  constructor(private prefix: string = '[Agent-OS]') {}

  debug(msg: string, meta?: Record<string, unknown>) {
    console.debug(`${this.prefix} DEBUG:`, msg, meta || '');
  }

  info(msg: string, meta?: Record<string, unknown>) {
    console.info(`${this.prefix} INFO:`, msg, meta || '');
  }

  warn(msg: string, meta?: Record<string, unknown>) {
    console.warn(`${this.prefix} WARN:`, msg, meta || '');
  }

  error(msg: string, meta?: Record<string, unknown>) {
    console.error(`${this.prefix} ERROR:`, msg, meta || '');
  }
}

// ── Memory Implementation ─────────────────────────────────────────────────────

export class AgentMemoryImpl implements AgentMemory {
  shortTerm: Record<string, unknown> = {};
  longTerm?: Record<string, unknown>;

  constructor(longTermEnabled: boolean = false) {
    if (longTermEnabled) {
      this.longTerm = {};
    }
  }

  get(key: string): unknown {
    return this.shortTerm[key] ?? this.longTerm?.[key];
  }

  set(key: string, value: unknown): void {
    this.shortTerm[key] = value;
  }

  clear(): void {
    this.shortTerm = {};
  }
}

// ── Tool Definition Builder ───────────────────────────────────────────────────

export interface ToolOptions<I = Record<string, unknown>, O = unknown> {
  name: string;
  description: string;
  category: 'audio' | 'integration' | 'database' | 'utility' | 'reasoning';
  inputSchema: z.ZodSchema<I>;
  outputSchema?: z.ZodSchema<O>;
  handler: (input: I) => Promise<O>;
}

export function defineTool<I = Record<string, unknown>, O = unknown>(
  id: string,
  options: ToolOptions<I, O>
): ToolDefinition {
  return {
    id,
    name: options.name,
    description: options.description,
    category: options.category,
    inputSchema: options.inputSchema,
    outputSchema: options.outputSchema,
    handler: async (input: Record<string, unknown>) => {
      // Validate input
      const validated = await options.inputSchema.parseAsync(input);
      // Call handler
      const result = await options.handler(validated as I);
      // Validate output if schema provided
      if (options.outputSchema) {
        return await options.outputSchema.parseAsync(result);
      }
      return result;
    },
  };
}

// ── Agent Definition Builder ──────────────────────────────────────────────────

export interface AgentOptions {
  name: string;
  description: string;
  version: string;
  tier: 'explorer' | 'pro-artist' | 'founder' | 'enterprise';
  tools: ToolDefinition[];
  systemPrompt?: string;
}

export function defineAgent(id: string, options: AgentOptions): AgentDefinition {
  return {
    id,
    name: options.name,
    description: options.description,
    version: options.version,
    tier: options.tier,
    tools: options.tools,
    systemPrompt: options.systemPrompt || `You are ${options.name}. ${options.description}`,
  };
}

// ── Agent Runtime ────────────────────────────────────────────────────────────

export class AgentRuntime {
  private agent: AgentDefinition;
  private toolMap: Map<string, ToolDefinition>;
  private context: AgentContext | null = null;

  constructor(agent: AgentDefinition, logger?: AgentLogger) {
    this.agent = agent;
    this.toolMap = new Map(agent.tools.map(t => [t.id, t]));
  }

  /**
   * Initialize runtime with a session and context
   */
  async initialize(
    sessionId: string,
    userId: string,
    contextData: Record<string, unknown> = {},
    logger?: AgentLogger
  ): Promise<AgentContext> {
    const session: AgentSession = {
      sessionId,
      agentId: this.agent.id,
      userId,
      startedAt: Date.now(),
      context: contextData,
      state: 'active',
    };

    const memory = new AgentMemoryImpl(this.agent.tier !== 'explorer');
    const agentLogger = logger || new ConsoleLogger(`[${this.agent.name}]`);

    this.context = {
      session,
      tools: this.toolMap,
      memory,
      logger: agentLogger,
    };

    agentLogger.info('Agent runtime initialized', {
      agentId: this.agent.id,
      sessionId,
      tools: this.toolMap.size,
    });

    return this.context;
  }

  /**
   * Execute a tool call via Openclaw routing
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    if (!this.context) {
      throw new Error('Runtime not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    const { logger } = this.context;

    const tool = this.toolMap.get(toolCall.toolId);
    if (!tool) {
      const error = `Tool ${toolCall.toolId} not found`;
      logger.error(error);
      return {
        toolId: toolCall.toolId,
        output: null,
        error,
        duration: Date.now() - startTime,
      };
    }

    try {
      logger.debug(`Executing tool: ${tool.name}`, { input: toolCall.input });

      const output = await tool.handler(toolCall.input);

      const duration = Date.now() - startTime;
      logger.info(`Tool ${tool.name} completed`, { duration });

      return {
        toolId: toolCall.toolId,
        output,
        duration,
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);

      logger.error(`Tool ${tool.name} failed`, { error, duration });

      return {
        toolId: toolCall.toolId,
        output: null,
        error,
        duration,
      };
    }
  }

  /**
   * Get available tools (for Hermes planning)
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.toolMap.values());
  }

  /**
   * Get agent definition
   */
  getAgent(): AgentDefinition {
    return this.agent;
  }

  /**
   * Get current context (requires initialize() first)
   */
  getContext(): AgentContext {
    if (!this.context) {
      throw new Error('Runtime not initialized. Call initialize() first.');
    }
    return this.context;
  }

  /**
   * Update session state
   */
  setSessionState(state: 'active' | 'paused' | 'completed' | 'failed'): void {
    if (!this.context) {
      throw new Error('Runtime not initialized.');
    }
    this.context.session.state = state;
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export { AgentDefinition, ToolDefinition, AgentContext, AgentSession };
