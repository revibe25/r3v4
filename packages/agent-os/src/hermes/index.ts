/**
 * src/hermes/index.ts
 *
 * Hermes-Agent: Reasoning engine for planning, memory management, and live reasoning.
 * Integrates with Openclaw for tool execution and SDK runtime for agent control.
 */

import {
  HermesThought,
  HermesPlan,
  PlanStep,
  HermesOutput,
  ToolDefinition,
  AgentLogger,
} from '../types.js';
import { ConsoleLogger } from '../sdk/index.js';

// ── Reasoning Modes ───────────────────────────────────────────────────────────

export type ReasoningMode = 'live' | 'batch' | 'hybrid';

export interface HermesConfig {
  mode: ReasoningMode;
  maxThoughts: number;
  maxPlanSteps: number;
  confidenceThreshold: number;
  enableMemory: boolean;
  enableReflection: boolean;
}

// ── Hermes Reasoning Engine ───────────────────────────────────────────────────

export class HermesEngine {
  private config: HermesConfig;
  private logger: AgentLogger;
  private thoughts: HermesThought[] = [];
  private plans: HermesPlan[] = [];

  constructor(config: Partial<HermesConfig> = {}, logger?: AgentLogger) {
    this.config = {
      mode: config.mode || 'hybrid',
      maxThoughts: config.maxThoughts || 50,
      maxPlanSteps: config.maxPlanSteps || 20,
      confidenceThreshold: config.confidenceThreshold || 0.65,
      enableMemory: config.enableMemory !== false,
      enableReflection: config.enableReflection !== false,
    };
    this.logger = logger || new ConsoleLogger('[Hermes]');
  }

  addThought(
    type: 'analysis' | 'planning' | 'reasoning' | 'reflection',
    content: string,
    confidence: number = 0.8
  ): HermesThought {
    const thought: HermesThought = {
      id: `thought-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      confidence,
      timestamp: Date.now(),
    };

    this.thoughts.push(thought);

    if (this.thoughts.length > this.config.maxThoughts) {
      this.thoughts = this.thoughts.slice(-this.config.maxThoughts);
    }

    this.logger.debug(`Added ${type} thought`, { confidence, id: thought.id });

    return thought;
  }

  createPlan(
    goal: string,
    tools: ToolDefinition[],
    context: Record<string, unknown> = {}
  ): HermesPlan {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const analysisThought = this.addThought(
      'analysis',
      `Analyzing goal: "${goal}" with ${tools.length} available tools`,
      0.9
    );

    const steps: PlanStep[] = [];
    const relevantTools = this._rankToolsForGoal(goal, tools);

    for (let i = 0; i < Math.min(relevantTools.length, this.config.maxPlanSteps); i++) {
      const tool = relevantTools[i];
      const step: PlanStep = {
        id: `step-${i}`,
        action: 'tool_call',
        toolId: tool.id,
        rationale: `Tool "${tool.name}" relevant for: ${tool.description}`,
      };
      steps.push(step);
    }

    const planningThought = this.addThought(
      'planning',
      `Created ${steps.length} steps to achieve goal: ${goal}`,
      0.85
    );

    const plan: HermesPlan = {
      id: planId,
      goal,
      steps,
      reasoning: [analysisThought, planningThought],
      estimatedCost: steps.length * 10,
    };

    this.plans.push(plan);
    this.logger.info(`Plan created: ${planId}`, { goal, steps: steps.length });

    return plan;
  }

  async reason(
    query: string,
    tools: ToolDefinition[] = [],
    context: Record<string, unknown> = {}
  ): Promise<HermesOutput> {
    const reasoningThought = this.addThought('reasoning', query, 0.8);

    const relevantTools = this._rankToolsForGoal(query, tools);

    const output: HermesOutput = {
      type: 'decision',
      content: {
        query,
        recommendedTools: relevantTools.map(t => ({ id: t.id, name: t.name })),
        context,
      },
      confidence: reasoningThought.confidence,
      reasoning: [reasoningThought],
    };

    this.logger.info('Reasoning complete', {
      query: query.slice(0, 50),
      toolsRecommended: relevantTools.length,
    });

    return output;
  }

  async reflect(): Promise<HermesThought | null> {
    if (!this.config.enableReflection || this.thoughts.length === 0) {
      return null;
    }

    const recentThoughts = this.thoughts.slice(-10);
    const summary = recentThoughts
      .map(t => `[${t.type}] ${t.content.slice(0, 30)}...`)
      .join(' → ');

    const reflection = this.addThought(
      'reflection',
      `Reflecting on recent reasoning: ${summary}`,
      0.7
    );

    return reflection;
  }

  getThoughts(type?: string): HermesThought[] {
    if (!type) return this.thoughts;
    return this.thoughts.filter(t => t.type === type);
  }

  getPlans(): HermesPlan[] {
    return this.plans;
  }

  clearHistory(): void {
    this.thoughts = [];
    this.plans = [];
    this.logger.info('Cleared reasoning history');
  }

  getConfig(): HermesConfig {
    return { ...this.config };
  }

  private _rankToolsForGoal(goal: string, tools: ToolDefinition[]): ToolDefinition[] {
    const goalLower = goal.toLowerCase();

    const scored = tools.map(tool => {
      const nameScore = tool.name.toLowerCase().includes(goalLower) ? 10 : 0;
      const descScore = tool.description.toLowerCase().includes(goalLower) ? 5 : 0;
      const categoryScore =
        tool.category === 'reasoning' || tool.category === 'audio' ? 2 : 0;

      return {
        tool,
        score: nameScore + descScore + categoryScore + Math.random() * 0.5,
      };
    });

    return scored.sort((a, b) => b.score - a.score).map(s => s.tool);
  }
}

// ── Batch Planning Mode ───────────────────────────────────────────────────────

export class HermesBatchPlanner {
  private engine: HermesEngine;

  constructor(engine: HermesEngine) {
    this.engine = engine;
  }

  async planBatch(
    goal: string,
    tools: ToolDefinition[],
    constraints: Record<string, unknown> = {}
  ): Promise<HermesPlan> {
    return this.engine.createPlan(goal, tools, constraints);
  }

  validatePlan(plan: HermesPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!plan.goal) errors.push('Plan missing goal');
    if (plan.steps.length === 0) errors.push('Plan has no steps');

    plan.steps.forEach((step, i) => {
      if (!step.action) errors.push(`Step ${i} missing action`);
      if (step.action === 'tool_call' && !step.toolId) {
        errors.push(`Step ${i} is tool_call but missing toolId`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ── Live Reasoning Mode ───────────────────────────────────────────────────────

export class HermesLiveReasoner {
  private engine: HermesEngine;

  constructor(engine: HermesEngine) {
    this.engine = engine;
  }

  async respond(
    query: string,
    tools: ToolDefinition[],
    context: Record<string, unknown> = {}
  ): Promise<HermesOutput> {
    return this.engine.reason(query, tools, context);
  }

  getRecentReasoning(count: number = 5): HermesThought[] {
    return this.engine.getThoughts().slice(-count);
  }
}

