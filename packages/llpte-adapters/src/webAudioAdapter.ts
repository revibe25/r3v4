/**
 * @llpte/llpte-adapters — Web Audio API Adapter
 *
 * Reference adapter. Wires LLPTE execution core to Web Audio API.
 * Other adapters (VST, MIDI, Mobile) follow this interface contract.
 */

import type { LLPTEAdapter } from './types';

export class WebAudioAdapter implements LLPTEAdapter {
  name    = '@llpte/adapters:webaudio';
  version = '0.1.0';

  private ctx: AudioContext | null = null;
  private gainNodes = new Map<string, GainNode>();

  async init(): Promise<void> {
    if (typeof AudioContext === 'undefined') {
      throw new Error('[WebAudioAdapter] AudioContext not available in this environment.');
    }
    this.ctx = new AudioContext();
  }

  getContext(): AudioContext {
    if (!this.ctx) throw new Error('[WebAudioAdapter] Not initialized. Call init() first.');
    return this.ctx;
  }

  createGainNode(trackId: string): GainNode {
    const ctx  = this.getContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    this.gainNodes.set(trackId, gain);
    return gain;
  }

  getGainNode(trackId: string): GainNode | undefined {
    return this.gainNodes.get(trackId);
  }

  destroy(): void {
    this.gainNodes.clear();
    this.ctx?.close();
    this.ctx = null;
  }
}
