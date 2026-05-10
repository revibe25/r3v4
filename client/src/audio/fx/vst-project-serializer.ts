// @ts-nocheck
// client/src/audio/fx/vst-project-serializer.ts

import { FXChain } from './fx-chain';
import { VSTFXNode } from './vst-fx-node';
import type { SidechainRouter } from './vst-sidechain';
import type { SidechainConfig } from '@/types/audio';

export interface SerializedVSTChain {
  version: string;
  timestamp: number;
  chains: SerializedChain[];
  sidechains: SidechainConfig[];
  globalSettings: {
    sampleRate: number;
    bufferSize: number;
  };
}

export interface SerializedChain {
  channelId: string;
  effects: SerializedEffect[];
}

export interface SerializedEffect {
  id: string;
  type: 'vst' | 'native';
  vstUrl?: string;
  parameters: Record<number, number>;
  automation: SerializedAutomation[];
  presets: any[];
  currentPreset?: string;
  bypassed: boolean;
  config: any;
}

export interface SerializedAutomation {
  paramId: number;
  points: Array<{ time: number; value: number }>;
  enabled: boolean;
}

export class VSTProjectSerializer {
  private static VERSION = '1.0.0';

  /**
   * Serialize an FX chain to JSON
   */
  static serializeChain(chain: FXChain, channelId: string): SerializedChain {
    const effects: SerializedEffect[] = [];

    (chain as any).effects.forEach(fx => {
      if (fx instanceof VSTFXNode) {
        const vstData = fx.serialize();
        effects.push({
          id: vstData.id,
          type: 'vst',
          vstUrl: vstData.vstUrl,
          parameters: vstData.parameters,
          automation: vstData.automation,
          presets: vstData.presets,
          currentPreset: vstData.currentPreset,
          bypassed: vstData.bypassed,
          config: vstData.config,
        });
      } else {
        // Handle native effects
        effects.push({
          id: fx.id,
          type: 'native',
          parameters: {},
          automation: [],
          presets: [],
          bypassed: fx.bypassed,
          config: {},
        });
      }
    });

    return {
      channelId,
      effects,
    };
  }

  /**
   * Serialize entire project
   */
  static serializeProject(
    chains: Map<string, FXChain>,
    sidechainRouter: SidechainRouter,
    audioContext: AudioContext
  ): SerializedVSTChain {
    const serializedChains: SerializedChain[] = [];

    chains.forEach((chain, channelId) => {
      serializedChains.push(this.serializeChain(chain, channelId));
    });

    const sidechains = sidechainRouter
      .getAllConnections()
      .map(conn => conn.config);

    return {
      version: this.VERSION,
      timestamp: Date.now(),
      chains: serializedChains,
      sidechains,
      globalSettings: {
        sampleRate: audioContext.sampleRate,
        bufferSize: 128, // Get from actual config
      },
    };
  }

  /**
   * Deserialize and restore project
   */
  static async deserializeProject(
    data: SerializedVSTChain,
    audioContext: AudioContext
  ): Promise<Map<string, FXChain>> {
    if (data.version !== this.VERSION) {
      console.warn(`Project version mismatch: ${data.version} vs ${this.VERSION}`);
    }

    const chains = new Map<string, FXChain>();

    for (const chainData of data.chains) {
      const chain = new FXChain();

      for (const effectData of (chainData as any).effects) {
        if (effectData.type === 'vst' && effectData.vstUrl) {
          try {
            const vstNode = await VSTFXNode.deserialize(effectData, audioContext);
            chain.addFX(vstNode as unknown as import("../fx/fx-chain").FXNode);
          } catch (error) {
            console.error(`Failed to load VST: ${effectData.vstUrl}`, error);
          }
        }
        // Handle native effects here
      }

      chains.set(chainData.channelId, chain);
    }

    return chains;
  }

  /**
   * Export project to file
   */
  static exportToFile(
    data: SerializedVSTChain,
    filename: string = 'project.vstchain'
  ): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Import project from file
   */
  static async importFromFile(file: File): Promise<SerializedVSTChain> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          const data = JSON.parse(json) as SerializedVSTChain;
          resolve(data);
        } catch (_error) {
          reject(new Error('Invalid project file'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Create project backup
   */
  static createBackup(
    data: SerializedVSTChain,
    name: string = 'backup'
  ): void {
    const backups = this.getBackups();
    backups.push({
      name,
      timestamp: Date.now(),
      data,
    });

    // Keep only last 10 backups
    if (backups.length > 10) {
      backups.shift();
    }

    localStorage.setItem('vst-project-backups', JSON.stringify(backups));
  }

  /**
   * Get all backups
   */
  static getBackups(): Array<{ name: string; timestamp: number; data: SerializedVSTChain }> {
    const stored = localStorage.getItem('vst-project-backups');
    if (!stored) return [];

    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  /**
   * Restore from backup
   */
  static restoreBackup(index: number): SerializedVSTChain | null {
    const backups = this.getBackups();
    return backups[index]?.data || null;
  }
}