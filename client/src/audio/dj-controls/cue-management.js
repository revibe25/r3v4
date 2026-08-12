import { DJ_CONSTRAINTS, CUE_COLOR_MAP } from '@shared/dj.types';
import { v4 as uuidv4 } from 'uuid';
export class CueManager {
    constructor(trackId) {
        this.listener = new Set();
        this.state = {
            cues: [],
            selectedCue: undefined,
            trackId,
        };
        // Initialize 8 empty cue slots
        for (let i = 0; i < DJ_CONSTRAINTS.HOT_CUES_PER_DECK; i++) {
            this.state.cues.push({
                id: uuidv4(),
                index: i + 1,
                position: 0,
                isActive: false,
                color: this.getDefaultColor(i),
            });
        }
    }
    /**
     * Get default color for cue index
     */
    getDefaultColor(index) {
        const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white'];
        return CUE_COLOR_MAP[colors[index % colors.length]];
    }
    /**
     * Set hot cue at specific index (1-8)
     */
    setCue(index, position, label) {
        if (index < 1 || index > DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
            throw new Error(`Invalid cue index: ${index}. Must be 1-${DJ_CONSTRAINTS.HOT_CUES_PER_DECK}`);
        }
        const cueIdx = index - 1;
        const cue = this.state.cues[cueIdx];
        cue.position = Math.max(0, position);
        cue.isActive = true;
        if (label)
            cue.label = label;
        this.notifyListeners();
        return { ...cue };
    }
    /**
     * Delete hot cue
     */
    deleteCue(index) {
        if (index < 1 || index > DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
            throw new Error(`Invalid cue index: ${index}`);
        }
        const cueIdx = index - 1;
        const cue = this.state.cues[cueIdx];
        cue.isActive = false;
        cue.position = 0;
        delete cue.label;
        if (this.state.selectedCue === cue.id) {
            this.state.selectedCue = undefined;
        }
        this.notifyListeners();
    }
    /**
     * Jump to hot cue
     */
    jumpToCue(index) {
        if (index < 1 || index > DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
            throw new Error(`Invalid cue index: ${index}`);
        }
        const cue = this.state.cues[index - 1];
        if (!cue.isActive) {
            throw new Error(`Cue ${index} is not set`);
        }
        this.state.selectedCue = cue.id;
        this.notifyListeners();
        return cue.position;
    }
    /**
     * Update cue color
     */
    setCueColor(index, color) {
        if (index < 1 || index > DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
            throw new Error(`Invalid cue index: ${index}`);
        }
        const cue = this.state.cues[index - 1];
        cue.color = color;
        this.notifyListeners();
    }
    /**
     * Update cue label
     */
    setCueLabel(index, label) {
        if (index < 1 || index > DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
            throw new Error(`Invalid cue index: ${index}`);
        }
        const cue = this.state.cues[index - 1];
        cue.label = label;
        this.notifyListeners();
    }
    /**
     * Get cue at index
     */
    getCue(index) {
        if (index < 1 || index > DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
            return null;
        }
        const cue = this.state.cues[index - 1];
        return cue.isActive ? { ...cue } : null;
    }
    /**
     * Get all active cues
     */
    getActiveCues() {
        return this.state.cues.filter((cue) => cue.isActive).map((cue) => ({ ...cue }));
    }
    /**
     * Get cue state
     */
    getState() {
        return {
            ...this.state,
            cues: this.state.cues.map((cue) => ({ ...cue })),
        };
    }
    /**
     * Clear all cues
     */
    clearAll() {
        this.state.cues.forEach((cue) => {
            cue.isActive = false;
            cue.position = 0;
            delete cue.label;
        });
        this.state.selectedCue = undefined;
        this.notifyListeners();
    }
    /**
     * Load cues from preset
     */
    loadPreset(cues) {
        this.clearAll();
        cues.forEach(({ index, position, label, color }) => {
            if (index >= 1 && index <= DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
                const cueIdx = index - 1;
                const cue = this.state.cues[cueIdx];
                cue.position = position;
                cue.isActive = true;
                if (label)
                    cue.label = label;
                if (color)
                    cue.color = color;
            }
        });
        this.notifyListeners();
    }
    /**
     * Export cues as JSON
     */
    export() {
        return {
            trackId: this.state.trackId,
            cues: this.state.cues
                .filter((cue) => cue.isActive)
                .map(({ index, position, label, color }) => ({
                index,
                position,
                label,
                color,
            })),
        };
    }
    /**
     * Import cues from JSON
     */
    import(data) {
        if (!Array.isArray(data.cues)) {
            throw new Error('Invalid cue data format');
        }
        this.loadPreset(data.cues);
    }
    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.listener.add(callback);
        return () => this.listener.delete(callback);
    }
    /**
     * Notify all listeners
     */
    notifyListeners() {
        this.listener.forEach((callback) => callback(this.getState()));
    }
    /**
     * Get cue count
     */
    getActiveCueCount() {
        return this.state.cues.filter((cue) => cue.isActive).length;
    }
    /**
     * Check if cue index is set
     */
    isCueSet(index) {
        if (index < 1 || index > DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
            return false;
        }
        return this.state.cues[index - 1].isActive;
    }
}
/**
 * Cue color options for UI
 */
export const CUE_COLORS_OPTIONS = [
    { color: 'red', label: 'Red', hex: CUE_COLOR_MAP.red },
    { color: 'orange', label: 'Orange', hex: CUE_COLOR_MAP.orange },
    { color: 'yellow', label: 'Yellow', hex: CUE_COLOR_MAP.yellow },
    { color: 'green', label: 'Green', hex: CUE_COLOR_MAP.green },
    { color: 'blue', label: 'Blue', hex: CUE_COLOR_MAP.blue },
    { color: 'purple', label: 'Purple', hex: CUE_COLOR_MAP.purple },
    { color: 'pink', label: 'Pink', hex: CUE_COLOR_MAP.pink },
    { color: 'white', label: 'White', hex: CUE_COLOR_MAP.white },
];
