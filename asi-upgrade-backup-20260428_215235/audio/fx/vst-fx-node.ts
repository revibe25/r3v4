// client/src/audio/fx/vst-fx-node.ts

import { FXNodeBase } from './fx-nodebase';
import { loadVST, VSTModule } from './vst-loader';
import { VSTParameterInfo } from './vst-loader';

export interface VSTPreset {
  name: string;
  parameters: Record<number, number>;
  metadata?: Record<string, any>;
}

export interface VSTFXConfig {
  id?: string;
  vstUrl: string;
  workletName?: string;
  inputChannels?: number;
  outputChannels?: number;
  parameters?: Record<string, number>;
  preset?: VSTPreset;
}

export interface AutomationPoint {
  time: number;
  value: number;
}

export interface AutomationLane {
  paramId: number;
  points: AutomationPoint[];
  enabled: boolean;
}

export class VSTFXNode extends FXNodeBase {
  protected connectEffect(): void {
    // VST effect connection handled by loadPlugin()
  }

  private vstModule: VSTModule | null = null;
  private vstNode: AudioWorkletNode | null = null;
  private vstUrl: string;
  private workletName: string;
  private config: VSTFXConfig;
  
  private automationLanes: Map<number, AutomationLane> = new Map();
  private parameterValues: Map<number, number> = new Map();
  private presets: Map<string, VSTPreset> = new Map();
  private currentPreset: string | null = null;
  
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private isProcessing: boolean = false;

  constructor(audioContext: AudioContext, config: VSTFXConfig) {
    super(config.id ?? `vst-${Date.now()}`);
    this.config = config;
    this.vstUrl = config.vstUrl;
    this.workletName = config.workletName || 'vst-processor';
    
    this.setupMessageHandlers();
  }

  async initialize(): Promise<void> {
    try {
      // Load VST WASM module
      this.vstModule = await loadVST({
        url: this.vstUrl,
        audioCtx: this.context,
        inputChannels: this.config.inputChannels,
        outputChannels: this.config.outputChannels,
      });

      // Create AudioWorkletNode
      this.vstNode = new AudioWorkletNode(this.context, this.workletName, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [this.vstModule.outputChannels],
        processorOptions: {
          wasmModule: this.vstModule.module,
          wasmMemory: this.vstModule.memory,
          parameterCount: this.vstModule.parameters.length,
          inputChannels: this.vstModule.inputChannels,
          outputChannels: this.vstModule.outputChannels,
        },
      });

      // Setup message handlers
      this.vstNode.port.onmessage = (event: MessageEvent) => {
        const { type, ...data } = event.data;
        const handler = this.messageHandlers.get(type);
        if (handler) {
          handler(data);
        }
      };

      // Connect audio graph
      this.input.connect(this.vstNode);
      this.vstNode.connect(this.output);

      // Initialize parameters
      this.vstModule.parameters.forEach((param) => {
        this.parameterValues.set(param.id, param.defaultValue);
      });

      // Apply initial preset or parameters
      if (this.config.preset) {
        await this.loadPreset(this.config.preset);
      } else if (this.config.parameters) {
        Object.entries(this.config.parameters).forEach(([id, value]) => {
          this.setParameter(Number(id), value);
        });
      }

      // Wait for initialization confirmation
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('VST initialization timeout'));
        }, 5000);

        this.messageHandlers.set('initialized', () => {
          clearTimeout(timeout);
          this.isProcessing = true;
          resolve();
        });

        this.messageHandlers.set('error', (data) => {
          clearTimeout(timeout);
          reject(new Error(data.error));
        });
      });

      console.log(`VST loaded: ${this.vstModule.metadata.name}`);
    } catch (error) {
      console.error('Failed to initialize VST:', error);
      throw error;
    }
  }

  private setupMessageHandlers(): void {
    this.messageHandlers.set('parameterValue', (data) => {
      this.parameterValues.set(data.paramId, data.value);
    });

    this.messageHandlers.set('state', (data) => {
      Object.entries(data.parameters).forEach(([id, value]) => {
        this.parameterValues.set(Number(id), value as number);
      });
    });

    this.messageHandlers.set('hotSwapComplete', () => {
      console.log('VST hot swap completed');
      this.isProcessing = true;
    });
  }

  /* ===========================
     Parameter Control
  ============================ */

  setParameter(paramId: number, value: number): void {
    if (!this.vstNode) {
      console.warn('VST not initialized');
      return;
    }

    // Clamp value
    const param = this.vstModule?.parameters.find((p) => p.id === paramId);
    if (param) {
      value = Math.max(param.minValue, Math.min(param.maxValue, value));
    }

    this.parameterValues.set(paramId, value);
    this.vstNode.port.postMessage({
      type: 'setParameter',
      data: { paramId, value },
    });
  }

  getParameter(paramId: number): number {
    return this.parameterValues.get(paramId) ?? 0;
  }

  async getParameterFromWorklet(paramId: number): Promise<number> {
    if (!this.vstNode) return 0;

    return new Promise((resolve) => {
      const handler = (data: any) => {
        if (data.paramId === paramId) {
          this.messageHandlers.delete('parameterValue');
          resolve(data.value);
        }
      };

      this.messageHandlers.set('parameterValue', handler);
      this.vstNode!.port.postMessage({
        type: 'getParameter',
        data: { paramId },
      });

      // Timeout fallback
      setTimeout(() => {
        this.messageHandlers.delete('parameterValue');
        resolve(this.parameterValues.get(paramId) ?? 0);
      }, 1000);
    });
  }

  getParameterInfo(): VSTParameterInfo[] {
    return this.vstModule?.parameters ?? [];
  }

  /* ===========================
     Automation
  ============================ */

  setAutomation(paramId: number, points: AutomationPoint[]): void {
    if (!this.vstNode) return;

    const lane: AutomationLane = {
      paramId,
      points: points.sort((a, b) => a.time - b.time),
      enabled: true,
    };

    this.automationLanes.set(paramId, lane);

    // Convert to sample-rate automation buffer
    const duration = points[points.length - 1].time;
    const sampleRate = this.context.sampleRate;
    const bufferLength = Math.ceil(duration * sampleRate);
    const buffer = new Float32Array(bufferLength);

    let pointIndex = 0;
    for (let i = 0; i < bufferLength; i++) {
      const time = i / sampleRate;

      // Find surrounding points
      while (pointIndex < points.length - 1 && points[pointIndex + 1].time <= time) {
        pointIndex++;
      }

      if (pointIndex === points.length - 1) {
        buffer[i] = points[pointIndex].value;
      } else {
        // Linear interpolation
        const p1 = points[pointIndex];
        const p2 = points[pointIndex + 1];
        const t = (time - p1.time) / (p2.time - p1.time);
        buffer[i] = p1.value + (p2.value - p1.value) * t;
      }
    }

    this.vstNode.port.postMessage(
      {
        type: 'setAutomation',
        data: { paramId, values: buffer },
      },
      [buffer.buffer]
    );
  }

  clearAutomation(paramId: number): void {
    if (!this.vstNode) return;

    this.automationLanes.delete(paramId);
    this.vstNode.port.postMessage({
      type: 'clearAutomation',
      data: { paramId },
    });
  }

  getAutomation(paramId: number): AutomationLane | null {
    return this.automationLanes.get(paramId) ?? null;
  }

  enableAutomation(paramId: number, enabled: boolean): void {
    const lane = this.automationLanes.get(paramId);
    if (lane) {
      lane.enabled = enabled;
      if (!enabled) {
        this.clearAutomation(paramId);
      } else {
        this.setAutomation(paramId, lane.points);
      }
    }
  }

  /* ===========================
     Preset Management
  ============================ */

  async savePreset(name: string, metadata?: Record<string, any>): Promise<VSTPreset> {
    const parameters: Record<number, number> = {};

    // Get all parameter values
    for (const param of this.vstModule?.parameters ?? []) {
      parameters[param.id] = await this.getParameterFromWorklet(param.id);
    }

    const preset: VSTPreset = {
      name,
      parameters,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        vstName: this.vstModule?.metadata.name,
      },
    };

    this.presets.set(name, preset);
    this.currentPreset = name;

    return preset;
  }

  async loadPreset(preset: VSTPreset | string): Promise<void> {
    const presetData = typeof preset === 'string' ? this.presets.get(preset) : preset;

    if (!presetData) {
      throw new Error(`Preset not found: ${preset}`);
    }

    // Apply all parameters
    Object.entries(presetData.parameters).forEach(([id, value]) => {
      this.setParameter(Number(id), value);
    });

    if (typeof preset === 'string') {
      this.currentPreset = preset;
    } else {
      this.currentPreset = preset.name;
      this.presets.set(preset.name, preset);
    }
  }

  getPresets(): VSTPreset[] {
    return Array.from(this.presets.values());
  }

  deletePreset(name: string): void {
    this.presets.delete(name);
    if (this.currentPreset === name) {
      this.currentPreset = null;
    }
  }

  exportPreset(name?: string): string {
    const preset = name ? this.presets.get(name) : this.getCurrentPreset();
    if (!preset) {
      throw new Error('No preset to export');
    }
    return JSON.stringify(preset, null, 2);
  }

  importPreset(json: string): VSTPreset {
    const preset = JSON.parse(json) as VSTPreset;
    this.presets.set(preset.name, preset);
    return preset;
  }

  private async getCurrentPreset(): Promise<VSTPreset> {
    return this.savePreset(this.currentPreset || 'Current State');
  }

  /* ===========================
     Hot Swap
  ============================ */

  async hotSwap(newVstUrl: string, preserveState: boolean = true): Promise<void> {
    if (!this.vstNode) {
      throw new Error('VST not initialized');
    }

    this.isProcessing = false;

    try {
      // Save current state
      const currentState = preserveState ? await this.getCurrentPreset() : null;

      // Load new VST module
      const newModule = await loadVST({
        url: newVstUrl,
        audioCtx: this.context,
        inputChannels: this.config.inputChannels,
        outputChannels: this.config.outputChannels,
      });

      // Send hot swap message to worklet
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Hot swap timeout'));
        }, 5000);

        this.messageHandlers.set('hotSwapComplete', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.messageHandlers.set('error', (data) => {
          clearTimeout(timeout);
          reject(new Error(data.error));
        });

        this.vstNode!.port.postMessage({
          type: 'hotSwap',
          data: {
            wasmModule: newModule.module,
            preset: currentState?.parameters,
          },
        });
      });

      // Update module reference
      this.vstModule = newModule;
      this.vstUrl = newVstUrl;
      this.isProcessing = true;

      console.log(`VST hot swapped to: ${newModule.metadata.name}`);
    } catch (error) {
      console.error('Hot swap failed:', error);
      this.isProcessing = true; // Resume with old plugin
      throw error;
    }
  }

  /* ===========================
     Control & Lifecycle
  ============================ */

  bypass(shouldBypass: boolean): void {
    super.bypass(shouldBypass);

    if (this.vstNode) {
      this.vstNode.port.postMessage({
        type: 'bypass',
        data: { bypassed: shouldBypass },
      });
    }
  }

  suspend(): void {
    if (this.vstNode) {
      this.vstNode.port.postMessage({ type: 'suspend' });
      this.isProcessing = false;
    }
  }

  resume(): void {
    if (this.vstNode) {
      this.vstNode.port.postMessage({ type: 'resume' });
      this.isProcessing = true;
    }
  }

  getLatency(): number {
    return this.vstModule?.latency ?? 0;
  }

  getMetadata() {
    return this.vstModule?.metadata;
  }

  isReady(): boolean {
    return this.isProcessing;
  }

  async getState(): Promise<any> {
    if (!this.vstNode) return null;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, 1000);

      this.messageHandlers.set('state', (data) => {
        clearTimeout(timeout);
        this.messageHandlers.delete('state');
        resolve(data);
      });

      this.vstNode!.port.postMessage({ type: 'getState' });
    });
  }

  dispose(): void {
    this.suspend();

    if (this.vstNode) {
      this.vstNode.disconnect();
      this.vstNode.port.close();
      this.vstNode = null;
    }

    this.automationLanes.clear();
    this.parameterValues.clear();
    this.presets.clear();
    this.messageHandlers.clear();

    super.dispose();
  }

  /* ===========================
     Serialization
  ============================ */

  serialize(): any {
    return {
      id: this.id,
      type: 'vst',
      vstUrl: this.vstUrl,
      parameters: Object.fromEntries(this.parameterValues),
      automation: Array.from(this.automationLanes.values()),
      currentPreset: this.currentPreset,
      presets: Array.from(this.presets.values()),
      bypassed: this.bypassed,
      config: this.config,
    };
  }

  static async deserialize(data: any, audioContext: AudioContext): Promise<VSTFXNode> {
    const node = new VSTFXNode(audioContext, data.config);
    await node.initialize();

    // Restore parameters
    Object.entries(data.parameters).forEach(([id, value]) => {
      node.setParameter(Number(id), value as number);
    });

    // Restore automation
    data.automation?.forEach((lane: AutomationLane) => {
      node.setAutomation(lane.paramId, lane.points);
      node.enableAutomation(lane.paramId, lane.enabled);
    });

    // Restore presets
    data.presets?.forEach((preset: VSTPreset) => {
      node.presets.set(preset.name, preset);
    });

    if (data.currentPreset) {
      await node.loadPreset(data.currentPreset);
    }

    node.bypass(data.bypassed);

    return node;
  }
}