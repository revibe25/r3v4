import Dexie from 'dexie';
// Browser database for client-side storage
export class ClipDB extends Dexie {
    constructor() {
        super('ClipDB');
        // Define object stores
        this.version(1).stores({
            clips: 'id, trackId, startTime, duration'
        });
    }
}
// Single instance to import anywhere in the client
export const clipDB = new ClipDB();
