// @ts-nocheck
// client/src/audio/fx/vst-loader.ts

interface VSTExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  init?: (sampleRate: number, blockSize: number) => void;
  process?: (
    inputPtr: number,
    outputPtr: number,
    numFrames: number,
    numInputChannels: number,
    numOutputChannels: number
  ) => void;
  setParameter?: (paramId: number, value: number) => void;
  getParameter?: (paramId: number) => number;
  getParameterCount?: () => number;
  getParameterName?: (paramId: number, bufferPtr: number, maxLen: number) => number;
  getParameterLabel?: (paramId: number, bufferPtr: number, maxLen: number) => number;
  getLatency?: () => number;
  suspend?: () => void;
  resume?: () => void;
  cleanup?: () => void;
}

export interface VSTParameterInfo {
  id: number;
  name: string;
  label: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  isAutomatable: boolean;
}

export interface VSTLoadOptions {
  url: string;
  audioCtx: AudioContext;
  sampleRate?: number;
  blockSize?: number;
  inputChannels?: number;
  outputChannels?: number;
  parameterCount?: number;
  imports?: WebAssembly.Imports;
  workletPath?: string;
}

export interface VSTModule {
  module: WebAssembly.Module;
  memory: WebAssembly.Memory;
  exports: VSTExports;
  parameters: VSTParameterInfo[];
  inputChannels: number;
  outputChannels: number;
  latency: number;
  metadata: VSTMetadata;
}

export interface VSTMetadata {
  name: string;
  vendor: string;
  version: string;
  uniqueId: string;
  category: string;
}

export class VSTLoader {
  private static workletRegistered = false;
  private static workletUrl = /* @vite-ignore */ new URL('../../public/worklets/vst-processor.worklet.js', import.meta.url);

  static async ensureWorkletRegistered(audioCtx: AudioContext): Promise<void> {
    if (this.workletRegistered) return;

    try {
      await audioCtx.audioWorklet.addModule(this.workletUrl.href);
      this.workletRegistered = true;
      console.log('VST AudioWorklet registered');
    } catch (error) {
      console.error('Failed to register VST AudioWorklet:', error);
      throw new Error(`AudioWorklet registration failed: ${error}`);
    }
  }

  static async loadVST(options: VSTLoadOptions): Promise<VSTModule> {
    const {
      url,
      audioCtx,
      sampleRate,
      blockSize = 128,
      inputChannels = 2,
      outputChannels = 2,
      parameterCount = 32,
      imports = {},
      workletPath,
    } = options;

    if (!audioCtx) {
      throw new Error('AudioContext is required');
    }

    if (workletPath) {
      // workletPath override: this.workletUrl = new URL(workletPath, import.meta.url);
    }

    // Ensure worklet is registered
    await this.ensureWorkletRegistered(audioCtx);

    try {
      const _vstUrl = new URL(url, window.location.href);

      // Fetch with timeout
      const _controller = new AbortController();
      const _timeoutId = setTimeout(() => controller.abort(), 30000);

      const _response = await fetch(vstUrl.href, {
        signal: controller.signal,
        headers: { Accept: 'application/wasm' },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch VST: ${response.status} ${response.statusText}`);
      }

      // Enhanced imports
      const enhancedImports: WebAssembly.Imports = {
        env: {
          getSampleRate: () => sampleRate || audioCtx.sampleRate,
          getCurrentTime: () => audioCtx.currentTime,
          consoleLog: (ptr: number, len: number, memory: WebAssembly.Memory) => {
            const _bytes = new Uint8Array(memory.buffer, ptr, len);
            const _str = new TextDecoder().decode(bytes);
            console.log('[VST]', str);
          },
          sin: Math.sin,
          cos: Math.cos,
          tan: Math.tan,
          exp: Math.exp,
          log: Math.log,
          pow: Math.pow,
          sqrt: Math.sqrt,
          floor: Math.floor,
          ceil: Math.ceil,
          abs: Math.abs,
          ...imports.env,
        },
        ...imports,
      };

      // Instantiate WASM
      const _result = await WebAssembly.instantiateStreaming(response, enhancedImports);
      const _vstExports = result.instance.exports as VSTExports;

      if (!vstExports.memory) {
        throw new Error('VST module must export memory');
      }

      // Initialize VST to probe capabilities
      if (vstExports.init) {
        vstExports.init(sampleRate || audioCtx.sampleRate, blockSize);
      }

      // Get parameter information
      const _parameters = await this.probeParameters(vstExports, parameterCount);

      // Get latency
      const _latency = vstExports.getLatency ? vstExports.getLatency() : 0;

      // Extract metadata (if available)
      const _metadata = await this.extractMetadata(vstExports, url);

      const vstModule: VSTModule = {
        module: result.module,
        memory: vstExports.memory,
        exports: vstExports,
        parameters,
        inputChannels,
        outputChannels,
        latency,
        metadata,
      };

      return vstModule;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('VST loading timed out after 30 seconds');
        }
        if (error instanceof TypeError) {
          throw new Error(`Invalid VST URL or network error: ${error.message}`);
        }
        if (error instanceof WebAssembly.CompileError) {
          throw new Error(`VST WASM compilation failed: ${error.message}`);
        }
        if (error instanceof WebAssembly.LinkError) {
          throw new Error(`VST WASM linking failed: ${error.message}`);
        }
      }
      throw error;
    }
  }

  private static async probeParameters(
    exports: VSTExports,
    maxParams: number
  ): Promise<VSTParameterInfo[]> {
    const parameters: VSTParameterInfo[] = [];

    const _paramCount = exports.getParameterCount ? exports.getParameterCount() : maxParams;

    for (let _i = 0; i < paramCount; i++) {
      const _defaultValue = exports.getParameter ? exports.getParameter(i) : 0;

      parameters.push({
        id: i,
        name: `Parameter ${i}`,
        label: '',
        defaultValue,
        minValue: 0,
        maxValue: 1,
        isAutomatable: true,
      });
    }

    return parameters;
  }

  private static async extractMetadata(
    exports: VSTExports,
    url: string
  ): Promise<VSTMetadata> {
    const _filename = url.split('/').pop() || 'unknown';
    const _name = filename.replace(/\.wasm$/, '');

    return {
      name,
      vendor: 'Unknown',
      version: '1.0.0',
      uniqueId: `vst_${name}_${Date.now()}`,
      category: 'Effect',
    };
  }
}

export async function loadVST(options: VSTLoadOptions): Promise<VSTModule> {
  return VSTLoader.loadVST(options);
}