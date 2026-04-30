// client/src/audio/fx/worklets/vst-processor.worklet.ts

interface VSTProcessorOptions {
  wasmModule: WebAssembly.Module;
  wasmMemory: WebAssembly.Memory;
  parameterCount: number;
  inputChannels: number;
  outputChannels: number;
}

interface VSTExports {
  memory: WebAssembly.Memory;
  init: (sampleRate: number, blockSize: number) => void;
  process: (
    inputPtr: number,
    outputPtr: number,
    numFrames: number,
    numInputChannels: number,
    numOutputChannels: number
  ) => void;
  setParameter: (paramId: number, value: number) => void;
  getParameter: (paramId: number) => number;
  getLatency?: () => number;
  suspend?: () => void;
  resume?: () => void;
  cleanup?: () => void;
}

class VSTProcessor extends AudioWorkletProcessor {
  private wasmInstance: WebAssembly.Instance | null = null;
  private wasmExports: VSTExports | null = null;
  private wasmMemory: WebAssembly.Memory | null = null;
  
  private inputBufferPtr: number = 0;
  private outputBufferPtr: number = 0;
  private inputChannels: number = 2;
  private outputChannels: number = 2;
  private blockSize: number = 128;
  
  private parameters: Map<number, number> = new Map();
  private automationData: Map<number, Float32Array> = new Map();
  private automationPosition: number = 0;
  
  private isInitialized: boolean = false;
  private isBypassed: boolean = false;
  private latencyFrames: number = 0;

  constructor(options: AudioWorkletNodeOptions) {
    super();
    
    const processorOptions = options.processorOptions as VSTProcessorOptions;
    this.inputChannels = processorOptions.inputChannels || 2;
    this.outputChannels = processorOptions.outputChannels || 2;
    
    this.initializeWasm(processorOptions).then(() => {
      this.port.postMessage({ type: 'initialized' });
    }).catch((error) => {
      this.port.postMessage({ type: 'error', error: error.message });
    });
    
    this.setupMessageHandlers();
  }

  private async initializeWasm(options: VSTProcessorOptions): Promise<void> {
    try {
      // Import WASM with audio-specific imports
      const imports = {
        env: {
          getSampleRate: () => sampleRate,
          getCurrentTime: () => currentTime,
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
        },
      };

      this.wasmInstance = await WebAssembly.instantiate(
        options.wasmModule,
        imports
      );
      
      this.wasmExports = this.wasmInstance.exports as unknown as VSTExports;
      this.wasmMemory = options.wasmMemory || this.wasmExports.memory;

      // Allocate audio buffers in WASM memory
      const bytesPerSample = 4; // Float32
      const inputBufferSize = this.blockSize * this.inputChannels * bytesPerSample;
      const outputBufferSize = this.blockSize * this.outputChannels * bytesPerSample;
      
      // Simple allocation at specific offsets (in production, use proper allocator)
      this.inputBufferPtr = 1024; // Start after initial WASM data
      this.outputBufferPtr = this.inputBufferPtr + inputBufferSize;

      // Initialize VST
      if (this.wasmExports.init) {
        this.wasmExports.init(sampleRate, this.blockSize);
      }

      // Get latency if available
      if (this.wasmExports.getLatency) {
        this.latencyFrames = this.wasmExports.getLatency();
      }

      // Initialize parameters
      for (let i = 0; i < (options.parameterCount || 32); i++) {
        if (this.wasmExports.getParameter) {
          this.parameters.set(i, this.wasmExports.getParameter(i));
        } else {
          this.parameters.set(i, 0);
        }
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize VST WASM:', error);
      throw error;
    }
  }

  private setupMessageHandlers(): void {
    this.port.onmessage = (event: MessageEvent) => {
      const { type, data } = event.data;

      switch (type) {
        case 'setParameter':
          this.setParameter(data.paramId, data.value);
          break;
          
        case 'getParameter':
          this.port.postMessage({
            type: 'parameterValue',
            paramId: data.paramId,
            value: this.parameters.get(data.paramId) || 0,
          });
          break;
          
        case 'setAutomation':
          this.setAutomation(data.paramId, data.values);
          break;
          
        case 'clearAutomation':
          this.automationData.delete(data.paramId);
          break;
          
        case 'bypass':
          this.isBypassed = data.bypassed;
          break;
          
        case 'suspend':
          if (this.wasmExports?.suspend) {
            this.wasmExports.suspend();
          }
          break;
          
        case 'resume':
          if (this.wasmExports?.resume) {
            this.wasmExports.resume();
          }
          break;
          
        case 'getState':
          this.sendState();
          break;
          
        case 'hotSwap':
          this.hotSwap(data.wasmModule, data.preset);
          break;
      }
    };
  }

  private setParameter(paramId: number, value: number): void {
    this.parameters.set(paramId, value);
    
    if (this.wasmExports?.setParameter) {
      this.wasmExports.setParameter(paramId, value);
    }
  }

  private setAutomation(paramId: number, values: Float32Array): void {
    this.automationData.set(paramId, values);
  }

  private applyAutomation(currentFrame: number): void {
    this.automationData.forEach((values, paramId) => {
      const index = currentFrame % values.length;
      const value = values[index];
      this.setParameter(paramId, value);
    });
  }

  private async hotSwap(
    newModule: WebAssembly.Module,
    preset?: Record<number, number>
  ): Promise<void> {
    try {
      // Save current state
      const currentState = new Map(this.parameters);
      
      // Suspend old instance
      if (this.wasmExports?.suspend) {
        this.wasmExports.suspend();
      }

      // Cleanup old instance
      if (this.wasmExports?.cleanup) {
        this.wasmExports.cleanup();
      }

      // Initialize new instance
      const imports = {
        env: {
          getSampleRate: () => sampleRate,
          getCurrentTime: () => currentTime,
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
        },
      };

      this.wasmInstance = await WebAssembly.instantiate(newModule, imports);
      this.wasmExports = this.wasmInstance.exports as unknown as VSTExports;

      if (this.wasmExports.init) {
        this.wasmExports.init(sampleRate, this.blockSize);
      }

      // Restore state or apply preset
      const stateToApply = preset || Object.fromEntries(currentState);
      Object.entries(stateToApply).forEach(([paramId, value]) => {
        this.setParameter(Number(paramId), value);
      });

      this.port.postMessage({ type: 'hotSwapComplete' });
    } catch (error) {
      this.port.postMessage({ 
        type: 'error', 
        error: `Hot swap failed: ${error}` 
      });
    }
  }

  private sendState(): void {
    this.port.postMessage({
      type: 'state',
      parameters: Object.fromEntries(this.parameters),
      latency: this.latencyFrames,
      bypassed: this.isBypassed,
    });
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    if (!this.isInitialized || !this.wasmExports || !this.wasmMemory) {
      // Pass through
      for (let ch = 0; ch < outputs[0].length; ch++) {
        if (inputs[0]?.[ch]) {
          outputs[0][ch].set(inputs[0][ch]);
        }
      }
      return true;
    }

    const input = inputs[0];
    const output = outputs[0];
    const frameCount = output[0].length;

    // Apply automation
    this.applyAutomation(this.automationPosition);
    this.automationPosition += frameCount;

    if (this.isBypassed) {
      // Bypass: copy input to output
      for (let ch = 0; ch < output.length; ch++) {
        if (input?.[ch]) {
          output[ch].set(input[ch]);
        }
      }
      return true;
    }

    try {
      // Interleave input channels into WASM memory
      const memoryView = new Float32Array(this.wasmMemory.buffer);
      const inputOffset = this.inputBufferPtr / 4;
      
      for (let frame = 0; frame < frameCount; frame++) {
        for (let ch = 0; ch < this.inputChannels; ch++) {
          const sample = input[ch]?.[frame] || 0;
          memoryView[inputOffset + frame * this.inputChannels + ch] = sample;
        }
      }

      // Process audio through VST
      this.wasmExports.process(
        this.inputBufferPtr,
        this.outputBufferPtr,
        frameCount,
        this.inputChannels,
        this.outputChannels
      );

      // Deinterleave output from WASM memory
      const outputOffset = this.outputBufferPtr / 4;
      
      for (let frame = 0; frame < frameCount; frame++) {
        for (let ch = 0; ch < this.outputChannels; ch++) {
          const sample = memoryView[outputOffset + frame * this.outputChannels + ch];
          output[ch][frame] = sample;
        }
      }
    } catch (error) {
      console.error('VST processing error:', error);
      
      // Pass through on error
      for (let ch = 0; ch < output.length; ch++) {
        if (input?.[ch]) {
          output[ch].set(input[ch]);
        }
      }
    }

    return true;
  }
}

registerProcessor('vst-processor', VSTProcessor);