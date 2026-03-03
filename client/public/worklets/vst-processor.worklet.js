// public/worklets/vst-processor.worklet.js
// Pure JavaScript version - no TypeScript compilation needed

class VSTProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    this.wasmInstance = null;
    this.wasmExports = null;
    this.wasmMemory = null;
    this.inputBufferPtr = 0;
    this.outputBufferPtr = 0;
    this.inputChannels = 2;
    this.outputChannels = 2;
    this.blockSize = 128;
    this.parameters = new Map();
    this.automationData = new Map();
    this.automationPosition = 0;
    this.isInitialized = false;
    this.isBypassed = false;
    this.latencyFrames = 0;

    const processorOptions = options.processorOptions;
    this.inputChannels = processorOptions.inputChannels || 2;
    this.outputChannels = processorOptions.outputChannels || 2;
    
    this.initializeWasm(processorOptions)
      .then(() => {
        this.port.postMessage({ type: 'initialized' });
      })
      .catch((error) => {
        this.port.postMessage({ type: 'error', error: error.message });
      });
    
    this.setupMessageHandlers();
  }

  async initializeWasm(options) {
    try {
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
      
      this.wasmExports = this.wasmInstance.exports;
      this.wasmMemory = options.wasmMemory || this.wasmExports.memory;

      const bytesPerSample = 4;
      const inputBufferSize = this.blockSize * this.inputChannels * bytesPerSample;
      const outputBufferSize = this.blockSize * this.outputChannels * bytesPerSample;
      
      this.inputBufferPtr = 1024;
      this.outputBufferPtr = this.inputBufferPtr + inputBufferSize;

      if (this.wasmExports.init) {
        this.wasmExports.init(sampleRate, this.blockSize);
      }

      if (this.wasmExports.getLatency) {
        this.latencyFrames = this.wasmExports.getLatency();
      }

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

  setupMessageHandlers() {
    this.port.onmessage = (event) => {
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
          if (this.wasmExports && this.wasmExports.suspend) {
            this.wasmExports.suspend();
          }
          break;
          
        case 'resume':
          if (this.wasmExports && this.wasmExports.resume) {
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

  setParameter(paramId, value) {
    this.parameters.set(paramId, value);
    
    if (this.wasmExports && this.wasmExports.setParameter) {
      this.wasmExports.setParameter(paramId, value);
    }
  }

  setAutomation(paramId, values) {
    this.automationData.set(paramId, values);
  }

  applyAutomation(currentFrame) {
    this.automationData.forEach((values, paramId) => {
      const index = currentFrame % values.length;
      const value = values[index];
      this.setParameter(paramId, value);
    });
  }

  async hotSwap(newModule, preset) {
    try {
      const currentState = new Map(this.parameters);
      
      if (this.wasmExports && this.wasmExports.suspend) {
        this.wasmExports.suspend();
      }

      if (this.wasmExports && this.wasmExports.cleanup) {
        this.wasmExports.cleanup();
      }

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
      this.wasmExports = this.wasmInstance.exports;

      if (this.wasmExports.init) {
        this.wasmExports.init(sampleRate, this.blockSize);
      }

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

  sendState() {
    this.port.postMessage({
      type: 'state',
      parameters: Object.fromEntries(this.parameters),
      latency: this.latencyFrames,
      bypassed: this.isBypassed,
    });
  }

  process(inputs, outputs, parameters) {
    if (!this.isInitialized || !this.wasmExports || !this.wasmMemory) {
      for (let ch = 0; ch < outputs[0].length; ch++) {
        if (inputs[0] && inputs[0][ch]) {
          outputs[0][ch].set(inputs[0][ch]);
        }
      }
      return true;
    }

    const input = inputs[0];
    const output = outputs[0];
    const frameCount = output[0].length;

    this.applyAutomation(this.automationPosition);
    this.automationPosition += frameCount;

    if (this.isBypassed) {
      for (let ch = 0; ch < output.length; ch++) {
        if (input && input[ch]) {
          output[ch].set(input[ch]);
        }
      }
      return true;
    }

    try {
      const memoryView = new Float32Array(this.wasmMemory.buffer);
      const inputOffset = this.inputBufferPtr / 4;
      
      for (let frame = 0; frame < frameCount; frame++) {
        for (let ch = 0; ch < this.inputChannels; ch++) {
          const sample = (input[ch] && input[ch][frame]) || 0;
          memoryView[inputOffset + frame * this.inputChannels + ch] = sample;
        }
      }

      this.wasmExports.process(
        this.inputBufferPtr,
        this.outputBufferPtr,
        frameCount,
        this.inputChannels,
        this.outputChannels
      );

      const outputOffset = this.outputBufferPtr / 4;
      
      for (let frame = 0; frame < frameCount; frame++) {
        for (let ch = 0; ch < this.outputChannels; ch++) {
          const sample = memoryView[outputOffset + frame * this.outputChannels + ch];
          output[ch][frame] = sample;
        }
      }
    } catch (error) {
      console.error('VST processing error:', error);
      
      for (let ch = 0; ch < output.length; ch++) {
        if (input && input[ch]) {
          output[ch].set(input[ch]);
        }
      }
    }

    return true;
  }
}

registerProcessor('vst-processor', VSTProcessor);