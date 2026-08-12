import * as Y from 'yjs';
// Shared CRDT document — single instance per session
export const ydoc = new Y.Doc();
// Shared types
export const yTracks = ydoc.getArray('tracks');
export const yTimeline = ydoc.getMap('timeline');
export const yUndoMgr = new Y.UndoManager([yTracks, yTimeline]);
