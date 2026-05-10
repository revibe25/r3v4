import * as Y from 'yjs'

// Shared CRDT document — single instance per session
export const ydoc = new Y.Doc()

// Shared types
export const yTracks    = ydoc.getArray<Y.Map<unknown>>('tracks')
export const yTimeline  = ydoc.getMap<unknown>('timeline')
export const yUndoMgr   = new Y.UndoManager([yTracks, yTimeline])
