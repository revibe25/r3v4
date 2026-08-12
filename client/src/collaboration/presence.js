import { createClient } from '@liveblocks/client';
// Initialise once — call connectRoom() after mount, not at module level
export const liveblocksClient = createClient({
    publicApiKey: process.env['LIVEBLOCKS_PUBLIC_KEY'] ?? ''
});
export function connectRoom(roomId) {
    return liveblocksClient.enterRoom(roomId, { initialPresence: { cursor: null, color: '#7c5cff', name: 'Anonymous' } });
}
/** Linear interpolation helper */
export function lerp(a, b, alpha) {
    return a + (b - a) * alpha;
}
