// @ts-nocheck
// client/src/audio/fx/vst-project-serializer.ts
import { FXChain } from './fx-chain';
import { VSTFXNode } from './vst-fx-node';
export class VSTProjectSerializer {
    /**
     * Serialize an FX chain to JSON
     */
    static serializeChain(chain, channelId) {
        const effects = [];
        chain.effects.forEach(fx => {
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
            }
            else {
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
    static serializeProject(chains, sidechainRouter, audioContext) {
        const serializedChains = [];
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
    static async deserializeProject(data, audioContext) {
        if (data.version !== this.VERSION) {
            console.warn(`Project version mismatch: ${data.version} vs ${this.VERSION}`);
        }
        const chains = new Map();
        for (const chainData of data.chains) {
            const chain = new FXChain();
            for (const effectData of chainData.effects) {
                if (effectData.type === 'vst' && effectData.vstUrl) {
                    try {
                        const vstNode = await VSTFXNode.deserialize(effectData, audioContext);
                        chain.addFX(vstNode);
                    }
                    catch (error) {
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
    static exportToFile(data, filename = 'project.vstchain') {
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
    static async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = e.target?.result;
                    const data = JSON.parse(json);
                    resolve(data);
                }
                catch (error) {
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
    static createBackup(data, name = 'backup') {
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
    static getBackups() {
        const stored = localStorage.getItem('vst-project-backups');
        if (!stored)
            return [];
        try {
            return JSON.parse(stored);
        }
        catch {
            return [];
        }
    }
    /**
     * Restore from backup
     */
    static restoreBackup(index) {
        const backups = this.getBackups();
        return backups[index]?.data || null;
    }
}
VSTProjectSerializer.VERSION = '1.0.0';
