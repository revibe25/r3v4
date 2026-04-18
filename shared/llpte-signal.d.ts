declare module '@llpte/llpte-signal' {
  export interface AnalysisResult {
    [key: string]: unknown;
  }
  export function analyzeAudio(input: unknown): Promise<AnalysisResult>;
}
