// client/src/audio/fx/vst-scanner.ts
import { VSTLoader } from './vst-loader';
export class VSTScanner {
    /**
     * Scan a directory for VST plugins
     */
    static async scanDirectory(directoryPath, audioCtx) {
        if (this.scanInProgress) {
            throw new Error('Scan already in progress');
        }
        this.scanInProgress = true;
        const startTime = Date.now();
        const plugins = [];
        const errors = [];
        try {
            // In a real implementation, you'd use the File System Access API
            // For now, we'll scan a predefined list of plugin paths
            const pluginPaths = await this.getPluginPaths(directoryPath);
            for (const path of pluginPaths) {
                try {
                    const pluginInfo = await this.scanPlugin(path, audioCtx);
                    plugins.push(pluginInfo);
                    this.cachedPlugins.set(pluginInfo.id, pluginInfo);
                }
                catch (error) {
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
        }
        finally {
            this.scanInProgress = false;
        }
    }
    /**
     * Scan a single plugin file
     */
    static async scanPlugin(path, audioCtx) {
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
        }
        catch (error) {
            console.error(`Failed to scan plugin: ${path}`, error);
            throw error;
        }
    }
    /**
     * Get list of plugin paths (mock - replace with actual FS scan)
     */
    static async getPluginPaths(directoryPath) {
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
    static categorizePlugin(vstModule) {
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
    static generateTags(vstModule) {
        const tags = [];
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
    static getCachedPlugin(id) {
        return this.cachedPlugins.get(id);
    }
    /**
     * Get all cached plugins
     */
    static getAllCachedPlugins() {
        return Array.from(this.cachedPlugins.values());
    }
    /**
     * Clear cache
     */
    static clearCache() {
        this.cachedPlugins.clear();
    }
    /**
     * Save plugin database to localStorage
     */
    static saveToStorage() {
        const plugins = Array.from(this.cachedPlugins.values());
        localStorage.setItem('vst-plugin-database', JSON.stringify(plugins));
    }
    /**
     * Load plugin database from localStorage
     */
    static loadFromStorage() {
        const stored = localStorage.getItem('vst-plugin-database');
        if (stored) {
            try {
                const plugins = JSON.parse(stored);
                plugins.forEach(plugin => {
                    this.cachedPlugins.set(plugin.id, plugin);
                });
            }
            catch (error) {
                console.error('Failed to load plugin database:', error);
            }
        }
    }
}
VSTScanner.cachedPlugins = new Map();
VSTScanner.scanInProgress = false;
