import Dexie from 'dexie';
import type { Clip } from '@/types/daw.types'; // shared type

// Browser database for client-side storage
export class ClipDB extends Dexie {
  clips!: Dexie.Table<Clip, string>;

  constructor() {
    super('ClipDB');

    // Define object stores
    this.version(1).stores({
      clips: 'id, trackId, startTime, duration'
    });
  }
}

// Single instance to import anywhere in the client
export const _clipDB = new ClipDB();
