/**
 * src/index.ts
 *
 * Agent-OS: Main entry point
 * Exports SDK, Openclaw router, Hermes engine, and Stable bridge
 */

// ── SDK Exports ───────────────────────────────────────────────────────────────
export {
  defineAgent,
  defineTool,
  AgentRuntime,
  ConsoleLogger,
  AgentMemoryImpl,
} from './sdk/index.js';

export type {
  AgentDefinition,
  ToolDefinition,
  AgentContext,
  AgentSession,
  AgentLogger,
  AgentMemory,
} from './types.js';

// ── Openclaw Exports ──────────────────────────────────────────────────────────
export { OpenclawRouter } from './openclaw/index.js';

export {
  AudioCategoryHandler,
  IntegrationCategoryHandler,
  DatabaseCategoryHandler,
  UtilityCategoryHandler,
  ReasoningCategoryHandler,
} from './openclaw/index.js';

export type {
  ToolCategory,
  ToolCategoryHandler,
} from './openclaw/index.js';

// ── Hermes Exports ────────────────────────────────────────────────────────────
export {
  HermesEngine,
  HermesBatchPlanner,
  HermesLiveReasoner,
} from './hermes/index.js';

export type {
  HermesConfig,
  ReasoningMode,
} from './hermes/index.js';

// ── Type Exports ──────────────────────────────────────────────────────────────
export {
  mixResultSchema,
  diagnosticsSchema,
  toolCallSchema,
  toolResultSchema,
} from './types.js';

export type {
  MixResult,
  DiagnosticsResult,
  MixDecision,
  DiagnosticFinding,
  ToolCall,
  ToolResult,
  HermesThought,
  HermesPlan,
  HermesOutput,
} from './types.js';

// ── Stable Bridge Exports ─────────────────────────────────────────────────────
export { StableBridge } from './trpc-bridge.js';


// ── Version Info ──────────────────────────────────────────────────────────────
export const AGENT_OS_VERSION = '0.1.0';
