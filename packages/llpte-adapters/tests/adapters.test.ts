import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebAudioAdapter } from '../src/webAudioAdapter';

function makeCtxMock() {
  const gainNode = { connect: vi.fn(), gain: { value: 1 } };
  const ctx = {
    createGain:  vi.fn(() => gainNode),
    destination: {},
    close:       vi.fn(),
    _gainNode:   gainNode,
  };
  return { ctx, gainNode };
}

describe('WebAudioAdapter', () => {
  let adapter: WebAudioAdapter;
  let ctx: ReturnType<typeof makeCtxMock>['ctx'];
  let gainNode: ReturnType<typeof makeCtxMock>['gainNode'];

  beforeEach(() => {
    ({ ctx, gainNode } = makeCtxMock());
    vi.stubGlobal('AudioContext', vi.fn(() => ctx));
    adapter = new WebAudioAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('identity', () => {
    it('has correct name', () => {
      expect(adapter.name).toBe('@llpte/adapters:webaudio');
    });
    it('has correct version', () => {
      expect(adapter.version).toBe('0.1.0');
    });
  });

  describe('init', () => {
    it('resolves when AudioContext is available', async () => {
      await expect(adapter.init()).resolves.toBeUndefined();
    });
    it('throws when AudioContext is unavailable', async () => {
      vi.stubGlobal('AudioContext', undefined);
      await expect(new WebAudioAdapter().init()).rejects.toThrow('AudioContext not available');
    });
  });

  describe('getContext', () => {
    it('throws before init', () => {
      expect(() => adapter.getContext()).toThrow('Not initialized');
    });
    it('returns AudioContext after init', async () => {
      await adapter.init();
      expect(adapter.getContext()).toBe(ctx);
    });
  });

  describe('createGainNode', () => {
    it('returns GainNode connected to destination', async () => {
      await adapter.init();
      const node = adapter.createGainNode('track-1');
      expect(node).toBe(gainNode);
      expect(gainNode.connect).toHaveBeenCalledWith(ctx.destination);
    });
    it('stores node retrievable by trackId', async () => {
      await adapter.init();
      adapter.createGainNode('track-a');
      expect(adapter.getGainNode('track-a')).toBe(gainNode);
    });
    it('returns undefined for unknown trackId', async () => {
      await adapter.init();
      expect(adapter.getGainNode('ghost')).toBeUndefined();
    });
    it('stores independent entries for multiple tracks', async () => {
      await adapter.init();
      adapter.createGainNode('track-1');
      adapter.createGainNode('track-2');
      expect(adapter.getGainNode('track-1')).toBeDefined();
      expect(adapter.getGainNode('track-2')).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('clears all gain nodes', async () => {
      await adapter.init();
      adapter.createGainNode('track-1');
      adapter.destroy();
      expect(adapter.getGainNode('track-1')).toBeUndefined();
    });
    it('closes the AudioContext', async () => {
      await adapter.init();
      adapter.destroy();
      expect(ctx.close).toHaveBeenCalled();
    });
    it('getContext throws after destroy', async () => {
      await adapter.init();
      adapter.destroy();
      expect(() => adapter.getContext()).toThrow('Not initialized');
    });
    it('is safe to call before init', () => {
      expect(() => adapter.destroy()).not.toThrow();
    });
  });
});
