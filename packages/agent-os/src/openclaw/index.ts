/**
 * src/openclaw/index.ts
 *
 * Openclaw: Tool routing, validation, and execution system.
 * Handles tool discovery, schema validation, execution dispatch,
 * and integration with audio/integration/database categories.
 */

import { z } from 'zod';
import {
  ToolDefinition,
  ToolCall,
  ToolResult,
  AgentLogger,
} from '../types.js';
import { ConsoleLogger } from '../sdk/index.js';

// ── Tool Category Routing ─────────────────────────────────────────────────────

export interface ToolCategory {
  name: string;
  handler: ToolCategoryHandler;
}

export interface ToolCategoryHandler {
  validate(tool: ToolDefinition, input: Record<string, unknown>): Promise<boolean>;
  execute(tool: ToolDefinition, input: Record<string, unknown>): Promise<unknown>;
  preprocess?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  postprocess?(output: unknown): Promise<unknown>;
}

// ── Audio Category Handler ────────────────────────────────────────────────────

export class AudioCategoryHandler implements ToolCategoryHandler {
  constructor(private logger: AgentLogger = new ConsoleLogger('[Openclaw:Audio]')) {}

  async validate(tool: ToolDefinition, input: Record<string, unknown>): Promise<boolean> {
    try {
      await tool.inputSchema.parseAsync(input);
      return true;
    } catch (err) {
      this.logger.error(`Audio tool validation failed: ${tool.id}`, { error: String(err) });
      return false;
    }
  }

  async execute(tool: ToolDefinition, input: Record<string, unknown>): Promise<unknown> {
    this.logger.info(`Executing audio tool: ${tool.name}`);
    return await tool.handler(input);
  }

  async preprocess(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Normalize audio input (sampleRate, channels, bitDepth, etc.)
    if (input.sampleRate && typeof input.sampleRate === 'number') {
      input.sampleRate = Math.max(8000, Math.min(192000, input.sampleRate));
    }
    return input;
  }

  async postprocess(output: unknown): Promise<unknown> {
    // Ensure audio output has required metadata
    if (typeof output === 'object' && output !== null) {
      const obj = output as Record<string, unknown>;
      if (!obj.timestamp) obj.timestamp = Date.now();
    }
    return output;
  }
}

// ── Integration Category Handler ──────────────────────────────────────────────

export class IntegrationCategoryHandler implements ToolCategoryHandler {
  constructor(private logger: AgentLogger = new ConsoleLogger('[Openclaw:Integration]')) {}

  async validate(tool: ToolDefinition, input: Record<string, unknown>): Promise<boolean> {
    try {
      await tool.inputSchema.parseAsync(input);
      return true;
    } catch (err) {
      this.logger.error(`Integration tool validation failed: ${tool.id}`, { error: String(err) });
      return false;
    }
  }

  async execute(tool: ToolDefinition, input: Record<string, unknown>): Promise<unknown> {
    this.logger.info(`Executing integration tool: ${tool.name}`);
    // Could add rate limiting, retry logic, etc. here
    return await tool.handler(input);
  }

  async preprocess(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Add auth context, API keys, etc. if needed
    return input;
  }

  async postprocess(output: unknown): Promise<unknown> {
    return output;
  }
}

// ── Database Category Handler ─────────────────────────────────────────────────

export class DatabaseCategoryHandler implements ToolCategoryHandler {
  constructor(private logger: AgentLogger = new ConsoleLogger('[Openclaw:Database]')) {}

  async validate(tool: ToolDefinition, input: Record<string, unknown>): Promise<boolean> {
    try {
      await tool.inputSchema.parseAsync(input);
      return true;
    } catch (err) {
      this.logger.error(`Database tool validation failed: ${tool.id}`, { error: String(err) });
      return false;
    }
  }

  async execute(tool: ToolDefinition, input: Record<string, unknown>): Promise<unknown> {
    this.logger.info(`Executing database tool: ${tool.name}`);
    return await tool.handler(input);
  }

  async preprocess(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Sanitize queries, normalize column names, etc.
    return input;
  }

  async postprocess(output: unknown): Promise<unknown> {
    return output;
  }
}

// ── Utility & Reasoning Handlers ──────────────────────────────────────────────

export class UtilityCategoryHandler implements ToolCategoryHandler {
  constructor(private logger: AgentLogger = new ConsoleLogger('[Openclaw:Utility]')) {}

  async validate(tool: ToolDefinition, input: Record<string, unknown>): Promise<boolean> {
    try {
      await tool.inputSchema.parseAsync(input);
      return true;
    } catch (err) {
      this.logger.error(`Utility tool validation failed: ${tool.id}`, { error: String(err) });
      return false;
    }
  }

  async execute(tool: ToolDefinition, input: Record<string, unknown>): Promise<unknown> {
    return await tool.handler(input);
  }
}

export class ReasoningCategoryHandler implements ToolCategoryHandler {
  constructor(private logger: AgentLogger = new ConsoleLogger('[Openclaw:Reasoning]')) {}

  async validate(tool: ToolDefinition, input: Record<string, unknown>): Promise<boolean> {
    try {
      await tool.inputSchema.parseAsync(input);
      return true;
    } catch (err) {
      this.logger.error(`Reasoning tool validation failed: ${tool.id}`, { error: String(err) });
      return false;
    }
  }

  async execute(tool: ToolDefinition, input: Record<string, unknown>): Promise<unknown> {
    return await tool.handler(input);
  }
}

// ── Openclaw Router ───────────────────────────────────────────────────────────

export class OpenclawRouter {
  private handlers: Map<string, ToolCategoryHandler> = new Map();
  private logger: AgentLogger;

  constructor(logger?: AgentLogger) {
    this.logger = logger || new ConsoleLogger('[Openclaw]');

    // Register default category handlers
    this.handlers.set('audio', new AudioCategoryHandler(this.logger));
    this.handlers.set('integration', new IntegrationCategoryHandler(this.logger));
    this.handlers.set('database', new DatabaseCategoryHandler(this.logger));
    this.handlers.set('utility', new UtilityCategoryHandler(this.logger));
    this.handlers.set('reasoning', new ReasoningCategoryHandler(this.logger));
  }

  /**
   * Register a custom handler for a tool category
   */
  registerHandler(category: string, handler: ToolCategoryHandler): void {
    this.handlers.set(category, handler);
    this.logger.info(`Registered handler for category: ${category}`);
  }

  /**
   * Route and execute a tool call
   */
  async route(
    tool: ToolDefinition,
    input: Record<string, unknown>
  ): Promise<{ output: unknown; error?: string; duration: number }> {
    const startTime = Date.now();

    const handler = this.handlers.get(tool.category);
    if (!handler) {
      return {
        output: null,
        error: `No handler for category: ${tool.category}`,
        duration: Date.now() - startTime,
      };
    }

    try {
      // Validate input
      const isValid = await handler.validate(tool, input);
      if (!isValid) {
        return {
          output: null,
          error: `Input validation failed for tool: ${tool.id}`,
          duration: Date.now() - startTime,
        };
      }

      // Preprocess (if handler provides it)
      let processedInput = input;
      if (handler.preprocess) {
        processedInput = await handler.preprocess(input);
      }

      // Execute
      let output = await handler.execute(tool, processedInput);

      // Postprocess (if handler provides it)
      if (handler.postprocess) {
        output = await handler.postprocess(output);
      }

      return {
        output,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Tool execution failed: ${tool.id}`, { error });
      return {
        output: null,
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get available handlers
   */
  getHandlers(): Map<string, ToolCategoryHandler> {
    return new Map(this.handlers);
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

// Classes exported as declarations.
