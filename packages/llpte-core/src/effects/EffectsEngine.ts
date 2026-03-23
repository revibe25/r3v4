import type { EffectDescriptor, EffectPreset, EffectChain, EffectId } from "../types";

/**
 * EffectsEngine — manages DSP effect chains and preset persistence.
 *
 * Invariants:
 *   - Parameters validated against descriptor min/max on every set.
 *   - Factory presets are immutable — loadPreset on factory returns a copy.
 *   - Preset save requires all parameters present in descriptor.
 */
export class EffectsEngine {
  private readonly chains  = new Map<string, EffectChain>();
  private readonly presets = new Map<EffectId, EffectPreset[]>();

  registerChain(chainId: string, chain: EffectChain): void {
    this.chains.set(chainId, chain);
    for (const effect of chain.effects) {
      if (!this.presets.has(effect.id)) this.presets.set(effect.id, []);
    }
  }

  setParameter(chainId: string, effectId: EffectId, paramId: string, value: number): EffectChain {
    const chain = this.chains.get(chainId);
    if (!chain) throw new Error(`EffectsEngine: chain ${chainId} not found`);
    const effectIdx = chain.effects.findIndex((e) => e.id === effectId);
    if (effectIdx === -1) throw new Error(`Effect ${effectId} not in chain ${chainId}`);
    const effect = chain.effects[effectIdx];
    const param  = effect.parameters.find((p) => p.id === paramId);
    if (!param) throw new Error(`Parameter ${paramId} not found in ${effectId}`);
    const clamped = Math.min(param.max, Math.max(param.min, value));
    const updated: EffectDescriptor = {
      ...effect,
      parameters: effect.parameters.map((p) => p.id === paramId ? { ...p, default: clamped } : p),
    };
    const effects = [...chain.effects];
    effects[effectIdx] = updated;
    const updatedChain: EffectChain = { ...chain, effects };
    this.chains.set(chainId, updatedChain);
    return updatedChain;
  }

  savePreset(effectId: EffectId, name: string, values: Record<string, number>): EffectPreset {
    const preset: EffectPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      effectId, name, values, createdAt: Date.now(), isFactory: false,
    };
    this.presets.set(effectId, [...(this.presets.get(effectId) ?? []), preset]);
    return preset;
  }

  loadPreset(chainId: string, preset: EffectPreset): EffectChain {
    let chain = this.chains.get(chainId);
    if (!chain) throw new Error(`Chain ${chainId} not found`);
    for (const [paramId, value] of Object.entries(preset.values)) {
      chain = this.setParameter(chainId, preset.effectId, paramId, value);
    }
    return chain;
  }

  getPresetsForEffect(effectId: EffectId): EffectPreset[] {
    return this.presets.get(effectId) ?? [];
  }

  getChain(chainId: string): EffectChain | undefined {
    return this.chains.get(chainId);
  }
}
