export type EffectId = string & { readonly __brand: "EffectId" };

export interface EffectParameter {
  readonly id: string;
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly step: number;
  readonly unit: "Hz" | "dB" | "ms" | "%" | "ratio" | "";
}

export interface EffectDescriptor {
  readonly id: EffectId;
  readonly name: string;
  readonly category: "eq" | "dynamics" | "reverb" | "delay" | "modulation" | "utility";
  readonly parameters: EffectParameter[];
  readonly latencySamples: number;
  readonly isBypassed: boolean;
}

export interface EffectPreset {
  readonly id: string;
  readonly effectId: EffectId;
  readonly name: string;
  readonly values: Record<string, number>;
  readonly createdAt: number;
  readonly isFactory: boolean;
}

export interface EffectChain {
  readonly id: string;
  readonly effects: EffectDescriptor[];
  readonly presets: EffectPreset[];
}
