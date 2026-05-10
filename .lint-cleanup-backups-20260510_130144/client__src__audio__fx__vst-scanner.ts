// client/src/audio/fx/vst-scanner.ts

import type { VSTModule } from './vst-loader';
import { VSTLoader } from './vst-loader';

export interface VSTPluginInfo {
  id: string;
  name: string;
  vendor: string;
  version: string;
  category: 'Instrument' | 'Effect' | 'Analyzer' | 'Utility';
  path: string;
  thumbnail?: string;
  tags: string[];
  isFavorite: boolean;
  lastUsed?: number;
  rating?: number;
}

export interface VSTScanResult {
  plugins: VSTPluginInfo[];
  scanTime: number;
  errors: Array<{ path: string; error: string }>;
}

export class VSTScanner {
  private static cachedPlugins: Map<string, VSTPluginInfo> = new Map();
  private static scanInProgress = false;

  /**
   * Scan a directory for VST plugins
   */
  static async scanDirectory(
    directoryPath: string,
    audioCtx: AudioContext
  ): Promise<VSTScanResult> {
    if (this.scanInProgress) {
      throw new Error('Scan already in progress');
    }

    this.scanInProgress = true;
    const startTime = Date.now();
    const plugins: VSTPluginInfo[] = [];
    const errors: Array<{ path: string; error: string }> = [];

    try {
      // In a real implementation, you'd use the File System Access API
      // For now, we'll scan a predefined list of plugin paths
      const pluginPaths = await this.getPluginPaths(directoryPath);

      for (const path of pluginPaths) {
        try {
          const pluginInfo = await this.scanPlugin(path, audioCtx);
          plugins.push(pluginInfo);
          this.cachedPlugins.set(pluginInfo.id, pluginInfo);
        } catch (error) {
          errors.push({
            path,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        plugins,
        scanTime: Date.now() - startTime,
        errors,
      };
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * Scan a single plugin file
   */
  private static async scanPlugin(
    path: string,
    audioCtx: AudioContext
  ): Promise<VSTPluginInfo> {
    try {
      const vstModule = await VSTLoader.loadVST({
        url: path,
        audioCtx,
      });

      const filename = path.split('/').pop() || 'unknown';
      const name = vstModule.metadata.name || filename.replace(/\.wasm$/, '');

      return {
        id: vstModule.metadata.uniqueId,
        name,
        vendor: vstModule.metadata.vendor,
        version: vstModule.metadata.version,
        category: this.categorizePlugin(vstModule),
        path,
        tags: this.generateTags(vstModule),
        isFavorite: false,
      };
    } catch (error) {
      console.error(`Failed to scan plugin: ${path}`, error);
      throw error;
    }
  }

  /**
   * Get list of plugin paths (mock - replace with actual FS scan)
   */
  private static async getPluginPaths(directoryPath: string): Promise<string[]> {
    // In production, use File System Access API
    // For now, return mock paths
    return [
      '/plugins/reverb.wasm',
      '/plugins/compressor.wasm',
      '/plugins/delay.wasm',
      '/plugins/eq.wasm',
      '/plugins/distortion.wasm',
    ];
  }

  /**
   * Categorize plugin based on its parameters and metadata
   */
  private static categorizePlugin(vstModule: VSTModule): VSTPluginInfo['category'] {
    const category = vstModule.metadata.category.toLowerCase();
    
    if (category.includes('instrument') || category.includes('synth')) {
      return 'Instrument';
    }
    if (category.includes('analyzer') || category.includes('meter')) {
      return 'Analyzer';
    }
    if (category.includes('utility') || category.includes('tool')) {
      return 'Utility';
    }
    
    return 'Effect';
  }

  /**
   * Generate searchable tags for a plugin
   */
  private static generateTags(vstModule: VSTModule): string[] {
    const tags: string[] = [];
    const name = vstModule.metadata.name.toLowerCase();
    
    // Common effect types
    const effectTypes = [
      'reverb', 'delay', 'echo', 'chorus', 'flanger', 'phaser',
      'distortion', 'overdrive', 'compressor', 'limiter', 'gate',
      'eq', 'equalizer', 'filter', 'dynamics', 'modulation',
    ];

    effectTypes.forEach(type => {
      if (name.includes(type)) {
        tags.push(type);
      }
    });

    return tags;
  }

  /**
   * Get cached plugin info
   */
  static getCachedPlugin(id: string): VSTPluginInfo | undefined {
    return this.cachedPlugins.get(id);
  }

  /**
   * Get all cached plugins
   */
  static getAllCachedPlugins(): VSTPluginInfo[] {
    return Array.from(this.cachedPlugins.values());
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cachedPlugins.clear();
  }

  /**
   * Save plugin database to localStorage
   */
  static saveToStorage(): void {
    const plugins = Array.from(this.cachedPlugins.values());
    localStorage.setItem('vst-plugin-database', JSON.stringify(plugins));
  }

  /**
   * Load plugin database from localStorage
   */
  static loadFromStorage(): void {
    const stored = localStorage.getItem('vst-plugin-database');
    if (stored) {
      try {
        const plugins = JSON.parse(stored) as VSTPluginInfo[];
        plugins.forEach(plugin => {
          this.cachedPlugins.set(plugin.id, plugin);
        });
      } catch (error) {
        console.error('Failed to load plugin database:', error);
      }
    }
  }
}