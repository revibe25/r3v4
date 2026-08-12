// @ts-nocheck
// client/src/audio/fx/vst-loader.ts
export class VSTLoader {
    static async ensureWorkletRegistered(audioCtx) {
        if (this.workletRegistered)
            return;
        try {
            await audioCtx.audioWorklet.addModule(this.workletUrl.href);
            this.workletRegistered = true;
            console.log('VST AudioWorklet registered');
        }
        catch (error) {
            console.error('Failed to register VST AudioWorklet:', error);
            throw new Error(`AudioWorklet registration failed: ${error}`);
        }
    }
    static async loadVST(options) {
        const { url, audioCtx, sampleRate, blockSize = 128, inputChannels = 2, outputChannels = 2, parameterCount = 32, imports = {}, workletPath, } = options;
        if (!audioCtx) {
            throw new Error('AudioContext is required');
        }
        if (workletPath) {
            // workletPath override: this.workletUrl = new URL(workletPath, import.meta.url);
        }
        // Ensure worklet is registered
        await this.ensureWorkletRegistered(audioCtx);
        try {
            const vstUrl = new URL(url, window.location.href);
            // Fetch with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(vstUrl.href, {
                signal: controller.signal,
                headers: { Accept: 'application/wasm' },
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Failed to fetch VST: ${response.status} ${response.statusText}`);
            }
            // Enhanced imports
            const enhancedImports = {
                env: {
                    getSampleRate: () => sampleRate || audioCtx.sampleRate,
                    getCurrentTime: () => audioCtx.currentTime,
                    consoleLog: (ptr, len, memory) => {
                        const bytes = new Uint8Array(memory.buffer, ptr, len);
                        const str = new TextDecoder().decode(bytes);
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
            const result = await WebAssembly.instantiateStreaming(response, enhancedImports);
            const vstExports = result.instance.exports;
            if (!vstExports.memory) {
                throw new Error('VST module must export memory');
            }
            // Initialize VST to probe capabilities
            if (vstExports.init) {
                vstExports.init(sampleRate || audioCtx.sampleRate, blockSize);
            }
            // Get parameter information
            const parameters = await this.probeParameters(vstExports, parameterCount);
            // Get latency
            const latency = vstExports.getLatency ? vstExports.getLatency() : 0;
            // Extract metadata (if available)
            const metadata = await this.extractMetadata(vstExports, url);
            const vstModule = {
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
        }
        catch (error) {
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
    static async probeParameters(exports, maxParams) {
        const parameters = [];
        const paramCount = exports.getParameterCount ? exports.getParameterCount() : maxParams;
        for (let i = 0; i < paramCount; i++) {
            const defaultValue = exports.getParameter ? exports.getParameter(i) : 0;
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
    static async extractMetadata(exports, url) {
        const filename = url.split('/').pop() || 'unknown';
        const name = filename.replace(/\.wasm$/, '');
        return {
            name,
            vendor: 'Unknown',
            version: '1.0.0',
            uniqueId: `vst_${name}_${Date.now()}`,
            category: 'Effect',
        };
    }
}
VSTLoader.workletRegistered = false;
VSTLoader.workletUrl = new URL('../../public/worklets/vst-processor.worklet.js', import.meta.url);
export async function loadVST(options) {
    return VSTLoader.loadVST(options);
}
