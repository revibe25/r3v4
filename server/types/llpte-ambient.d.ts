// Ambient stubs for @llpte/* packages
// Used by root tsconfig during Docker build (server-only install, no workspace symlinks)
// server/tsconfig.json path aliases handle local/IDE compilation independently
// Mythos: dev-build-isolated, code_change, blast-radius=low, ALLOW_RUNTIME
declare module '@llpte/llpte-signal' {
  export interface RawAudioBuffer {
    [key: string]: unknown;
  }
  export interface AnalysisResult {
    [key: string]: unknown;
  }
  export function analyzeAudio(buffer: RawAudioBuffer): Promise<AnalysisResult>;
  export function clearAnalysisCache(): void;
}
declare module '@llpte/llpte-ai' {}
declare module '@llpte/llpte-core' {}
declare module '@llpte/llpte-adapters' {}
declare module '@llpte/llpte-execution' {}
declare module '@llpte/llpte-transition-graph' {}
