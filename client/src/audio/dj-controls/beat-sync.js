export class BeatSync {
    constructor(masterBpm = 120) {
        this.beatGrid = null;
        this.listener = new Set();
        this.masterBpm = masterBpm;
        this.config = {
            enabled: true,
            masterBpm: masterBpm,
            beatDivision: 1,
            snapThreshold: 50, // milliseconds
            autoSync: true,
        };
    }
    /**
     * Set beat sync configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Generate beat grid from BPM and duration
     */
    generateBeatGrid(durationSeconds, offset = 0) {
        const beatDuration = (60 / this.masterBpm) * 1000; // milliseconds
        const markers = [];
        let position = offset / 1000; // Convert offset to seconds
        let beatNumber = 0;
        while (position < durationSeconds) {
            markers.push({
                position,
                beatNumber,
                isMajorBeat: beatNumber % 4 === 0, // Major beat every 4 beats (bar)
            });
            position += beatDuration / 1000; // Convert back to seconds
            beatNumber++;
        }
        this.beatGrid = {
            bpm: this.masterBpm,
            downbeatOffset: offset,
            markers,
        };
        this.notifyListeners();
        return this.beatGrid;
    }
    /**
     * Detect beat grid from audio (simplified - would use onset detection in production)
     */
    async detectBeatGrid(audioBuffer) {
        // Placeholder for actual beat detection
        // In production, use algorithms like:
        // - Onset detection (find transients)
        // - Spectral flux (energy changes)
        // - Autocorrelation (periodic patterns)
        // For now, generate grid based on estimated BPM
        const _estimatedBpm = this.masterBpm; // Would be detected from audio
        return this.generateBeatGrid(audioBuffer.duration);
    }
    /**
     * Snap time position to nearest beat
     */
    snapToBeat(timeSeconds) {
        if (!this.beatGrid) {
            return timeSeconds;
        }
        const markers = this.beatGrid.markers;
        let closestMarker = markers[0];
        let minDistance = Math.abs(timeSeconds - closestMarker.position);
        for (const marker of markers) {
            const distance = Math.abs(timeSeconds - marker.position);
            if (distance < minDistance) {
                minDistance = distance;
                closestMarker = marker;
            }
        }
        // Only snap if within threshold
        if (minDistance < this.config.snapThreshold / 1000) {
            return closestMarker.position;
        }
        return timeSeconds;
    }
    /**
     * Snap time position to specific beat division
     */
    snapToBeatDivision(timeSeconds, division = this.config.beatDivision) {
        const beatDuration = (60 / this.masterBpm) * division; // seconds
        const snappedTime = Math.round(timeSeconds / beatDuration) * beatDuration;
        return snappedTime;
    }
    /**
     * Calculate time to next beat
     */
    timeToNextBeat(timeSeconds) {
        const beatDuration = 60 / this.masterBpm;
        const beatPosition = timeSeconds % beatDuration;
        return beatDuration - beatPosition;
    }
    /**
     * Calculate time to next major beat (bar)
     */
    timeToNextMajorBeat(timeSeconds) {
        const beatDuration = 60 / this.masterBpm;
        const barDuration = beatDuration * 4;
        const barPosition = timeSeconds % barDuration;
        return barDuration - barPosition;
    }
    /**
     * Get beat number at position
     */
    getBeatNumber(timeSeconds) {
        const beatDuration = 60 / this.masterBpm;
        return Math.floor(timeSeconds / beatDuration);
    }
    /**
     * Get bar number at position
     */
    getBarNumber(timeSeconds) {
        const beatDuration = 60 / this.masterBpm;
        const beatNumber = Math.floor(timeSeconds / beatDuration);
        return Math.floor(beatNumber / 4);
    }
    /**
     * Calculate loop length in beats
     */
    calculateLoopLength(startTime, endTime) {
        const beatDuration = 60 / this.masterBpm;
        return (endTime - startTime) / beatDuration;
    }
    /**
     * Align time to nearest beat boundary
     */
    alignToGrid(timeSeconds) {
        if (!this.config.enabled) {
            return timeSeconds;
        }
        return this.snapToBeatDivision(timeSeconds, this.config.beatDivision);
    }
    /**
     * Get beat markers within time range
     */
    getMarkersInRange(startTime, endTime) {
        if (!this.beatGrid) {
            return [];
        }
        return this.beatGrid.markers.filter((marker) => marker.position >= startTime && marker.position <= endTime);
    }
    /**
     * Get current beat grid
     */
    getBeatGrid() {
        return this.beatGrid ? { ...this.beatGrid } : null;
    }
    /**
     * Update master BPM
     */
    setMasterBpm(bpm) {
        this.masterBpm = bpm;
        this.config.masterBpm = bpm;
        if (this.beatGrid) {
            this.generateBeatGrid(this.beatGrid.markers[this.beatGrid.markers.length - 1].position);
        }
    }
    /**
     * Subscribe to beat grid changes
     */
    subscribe(callback) {
        this.listener.add(callback);
        return () => this.listener.delete(callback);
    }
    /**
     * Notify listeners
     */
    notifyListeners() {
        this.listener.forEach((callback) => callback(this.beatGrid ? { ...this.beatGrid } : null));
    }
    /**
     * Get sync config
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Calculate quantized position
     */
    quantize(timeSeconds, grid = 'beat') {
        const beatDuration = 60 / this.masterBpm;
        let divisor;
        switch (grid) {
            case 'bar':
                divisor = beatDuration * 4;
                break;
            case 'beat':
                divisor = beatDuration;
                break;
            case 'eighth':
                divisor = beatDuration / 2;
                break;
            case 'sixteenth':
                divisor = beatDuration / 4;
                break;
            default:
                divisor = beatDuration;
        }
        return Math.round(timeSeconds / divisor) * divisor;
    }
}
/**
 * Beat grid visualization helpers
 */
export const BEAT_GRID_HELPERS = {
    getBeatLabel(beatNumber) {
        const beatInBar = beatNumber % 4;
        return `${Math.floor(beatNumber / 4) + 1}.${beatInBar + 1}`;
    },
    getGridColor(isMajor) {
        return isMajor ? 'var(--looper-blue)' : 'var(--text-dim)'; // Blue for major, gray for minor
    },
    getGridSize(isMajor) {
        return isMajor ? 8 : 4; // Larger markers for major beats
    },
};
