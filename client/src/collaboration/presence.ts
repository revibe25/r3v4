import {
  createClient,
  type BaseUserMeta,
  type JsonObject
} from '@liveblocks/client'

export interface PresenceShape extends JsonObject {
  cursor: { x: number; y: number } | null
  color:  string
  name:   string
}

// Initialise once — call connectRoom() after mount, not at module level
export const liveblocksClient = createClient({
  publicApiKey: process.env['LIVEBLOCKS_PUBLIC_KEY'] ?? ''
})

export function connectRoom(roomId: string) {
  return liveblocksClient.enterRoom<PresenceShape, Record<string, never>, BaseUserMeta, Record<string, string | number | boolean | undefined>>(
    roomId,
    { initialPresence: { cursor: null, color: '#7c5cff', name: 'Anonymous' } }
  )
}

/** Linear interpolation helper */
export function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha
}
