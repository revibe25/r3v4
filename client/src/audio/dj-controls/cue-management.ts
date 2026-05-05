// DJ Hot Cue Management System
import type { HotCue, HotCuesState, CueColor} from '@shared/dj.types';
import { DJ_CONSTRAINTS, CUE_COLOR_MAP } from '@shared/dj.types';
import { v4 as uuidv4 } from 'uuid';

export class CueManager {
  private state: HotCuesState;
  private listener: Set<(state: HotCuesState) => void> = new Set();

  constructor(trackId: string) {
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
  private getDefaultColor(index: number): string {
    const colors: CueColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white'];
    return CUE_COLOR_MAP[colors[index % colors.length]];
  }

  /**
   * Set hot cue at specific index (1-8)
   */
  setCue(index: number, position: number, label?: string): HotCue {
    if (index < 1 || index > DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
      throw new Error(`Invalid cue index: ${index}. Must be 1-${DJ_CONSTRAINTS.HOT_CUES_PER_DECK}`);
    }

    const cueIdx = index - 1;
    const cue = this.state.cues[cueIdx];

    cue.position = Math.max(0, position);
    cue.isActive = true;
    if (label) cue.label = label;

    this.notifyListeners();
    return { ...cue };
  }

  /**
   * Delete hot cue
   */
  deleteCue(index: number): void {
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
  jumpToCue(index: number): number {
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
  setCueColor(index: number, color: string): void {
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
  setCueLabel(index: number, label: string): void {
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
  getCue(index: number): HotCue | null {
    if (index < 1 || index > DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
      return null;
    }

    const cue = this.state.cues[index - 1];
    return cue.isActive ? { ...cue } : null;
  }

  /**
   * Get all active cues
   */
  getActiveCues(): HotCue[] {
    return this.state.cues.filter((cue) => cue.isActive).map((cue) => ({ ...cue }));
  }

  /**
   * Get cue state
   */
  getState(): HotCuesState {
    return {
      ...this.state,
      cues: this.state.cues.map((cue) => ({ ...cue })),
    };
  }

  /**
   * Clear all cues
   */
  clearAll(): void {
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
  loadPreset(cues: Array<{ index: number; position: number; label?: string; color?: string }>): void {
    this.clearAll();

    cues.forEach(({ index, position, label, color }) => {
      if (index >= 1 && index <= DJ_CONSTRAINTS.HOT_CUES_PER_DECK) {
        const cueIdx = index - 1;
        const cue = this.state.cues[cueIdx];

        cue.position = position;
        cue.isActive = true;
        if (label) cue.label = label;
        if (color) cue.color = color;
      }
    });

    this.notifyListeners();
  }

  /**
   * Export cues as JSON
   */
  export(): object {
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
  import(data: any): void {
    if (!Array.isArray(data.cues)) {
      throw new Error('Invalid cue data format');
    }

    this.loadPreset(data.cues);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: HotCuesState) => void): () => void {
    this.listener.add(callback);
    return () => this.listener.delete(callback);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listener.forEach((callback) => callback(this.getState()));
  }

  /**
   * Get cue count
   */
  getActiveCueCount(): number {
    return this.state.cues.filter((cue) => cue.isActive).length;
  }

  /**
   * Check if cue index is set
   */
  isCueSet(index: number): boolean {
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
] as const;