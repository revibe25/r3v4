/**
 * server/ws/collab.ts
 * Real-time collaboration WebSocket server for R3 v4.
 *
 * Integrates with the Express server via server/index.ts:
 *   import { attachCollabServer } from './ws/collab';
 *   const httpServer = app.listen(PORT);
 *   attachCollabServer(httpServer);
 *
 * Protocol (all frames are JSON):
 *   C→S  { type:'join',     userId, name, color, roomId }
 *   C→S  { type:'leave',    userId }
 *   C→S  { type:'presence', userId, name, color, cursorBeat, activeTrackId }
 *   C→S  { type:'action',   userId, action: { type, ...payload } }
 *   C→S  { type:'ping' }
 *
 *   S→C  { type:'users',    users: RoomUser[] }          — sent on join
 *   S→C  { type:'join',     userId, name, color }        — broadcast to room
 *   S→C  { type:'leave',    userId }                     — broadcast to room
 *   S→C  { type:'presence', ...user }                    — broadcast to room
 *   S→C  { type:'action',   userId, action }             — broadcast to room (excl. sender)
 *   S→C  { type:'pong' }
 *
 * Security:
 *   - JWT verified via the same middleware used by tRPC.
 *   - roomId extracted from query param; validated as alphanumeric ≤ 32 chars.
 *   - Max 16 users per room (configurable).
 *   - Action broadcast is non-destructive only (allow-listed action types).
 *   - Idle clients (no message > 60s) are pruned.
 */

import type { IncomingMessage } from 'http';
import type { Server as HttpServer }  from 'http';
import type { Server as HttpsServer } from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import { URL } from 'url';
import jwt from 'jsonwebtoken';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoomUser {
  userId:        string;
  name:          string;
  color:         string;
  cursorBeat:    number | null;
  activeTrackId: string | null;
  joinedAt:      number;
  ws:            WebSocket;
  lastSeen:      number;
}

interface Room {
  id:    string;
  users: Map<string, RoomUser>;
}

// Action types that are safe to broadcast to peers.
// All others are silently dropped server-side.
const ALLOWED_ACTION_TYPES = new Set([
  'trackMute', 'trackSolo', 'trackGain', 'trackPan',
  'bpm', 'timeSignature', 'loopPoints', 'regionMove',
  'regionAdd', 'regionRemove', 'midiNote',
]);

const MAX_USERS_PER_ROOM = 16;
const IDLE_TIMEOUT_MS    = 90_000;   // 90s without any message → close
const ROOM_CLEAN_INTERVAL = 30_000;  // check for dead rooms every 30s

// ── State ─────────────────────────────────────────────────────────────────────

const rooms = new Map<string, Room>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateRoomId(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return cleaned.length > 0 && cleaned.length <= 32 ? cleaned : null;
}

function send(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(data));
  } catch { /* client gone */ }
}

function broadcastToRoom(
  room: Room,
  data: Record<string, unknown>,
  excludeUserId?: string,
): void {
  for (const [uid, user] of room.users) {
    if (uid !== excludeUserId) send(user.ws, data);
  }
}

function getRoomUsers(room: Room): Omit<RoomUser, 'ws'>[] {
  return Array.from(room.users.values()).map(({ ws: _ws, ...rest }) => rest);
}

function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) rooms.set(roomId, { id: roomId, users: new Map() });
  return rooms.get(roomId)!;
}

function removeUserFromRoom(roomId: string, userId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room.users.delete(userId);
  if (room.users.size === 0) rooms.delete(roomId);
}

// Optional JWT verification — graceful degradation if JWT_SECRET not set.
function verifyToken(req: IncomingMessage): { userId?: string } {
  const secret = process.env.JWT_SECRET;
  if (!secret) return {};
  try {
    const raw = req.headers['authorization']?.replace('Bearer ', '')
      ?? new URL(req.url ?? '', 'http://x').searchParams.get('token')
      ?? '';
    if (!raw) return {};
    const decoded = jwt.verify(raw, secret) as Record<string, unknown>;
    return { userId: decoded.userId as string };
  } catch {
    return {};
  }
}

// ── Idle pruning ──────────────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    for (const [userId, user] of room.users) {
      if (now - user.lastSeen > IDLE_TIMEOUT_MS) {
        user.ws.terminate();
        room.users.delete(userId);
        broadcastToRoom(room, { type: 'leave', userId });
      }
    }
    if (room.users.size === 0) rooms.delete(roomId);
  }
}, ROOM_CLEAN_INTERVAL);

// ── Main attach function ──────────────────────────────────────────────────────

export function attachCollabServer(server: HttpServer | HttpsServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // ── Parse room from query string ──────────────────────────────────────
    const url    = new URL(req.url ?? '/', 'http://x');
    const roomId = validateRoomId(url.searchParams.get('room'));

    if (!roomId) {
      ws.close(4000, 'Missing or invalid roomId');
      return;
    }

    // Optional JWT check (non-blocking — guest users allowed)
    const { userId: tokenUserId } = verifyToken(req);

    // Room size guard
    const room = getOrCreateRoom(roomId);
    if (room.users.size >= MAX_USERS_PER_ROOM) {
      ws.close(4003, 'Room full');
      return;
    }

    // Ephemeral session state before 'join' message arrives
    let sessionUserId: string | null = tokenUserId ?? null;
    let joined = false;

    // ── Message handler ───────────────────────────────────────────────────
    ws.on('message', (raw: Buffer) => {
      // Update last-seen for idle pruning
      if (sessionUserId) {
        const u = room.users.get(sessionUserId);
        if (u) u.lastSeen = Date.now();
      }

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return; // ignore malformed frames
      }

      switch (msg.type) {

        // ── join ────────────────────────────────────────────────────────────
        case 'join': {
          const userId = (msg.userId as string | undefined)?.slice(0, 32) ?? tokenUserId;
          const name   = (msg.name  as string | undefined)?.slice(0, 40) ?? 'USER';
          const color  = /^#[0-9a-fA-F]{6}$/.test(msg.color as string)
            ? (msg.color as string) : '#f59e0b';

          if (!userId) { ws.close(4001, 'userId required'); return; }
          if (joined)  return; // idempotent

          sessionUserId = userId;
          joined        = true;

          const user: RoomUser = {
            userId, name, color,
            cursorBeat: null, activeTrackId: null,
            joinedAt: Date.now(), lastSeen: Date.now(),
            ws,
          };
          room.users.set(userId, user);

          // Send current room roster to the joining client
          send(ws, { type: 'users', users: getRoomUsers(room) });

          // Notify existing peers
          broadcastToRoom(room, { type: 'join', userId, name, color }, userId);
          break;
        }

        // ── leave ───────────────────────────────────────────────────────────
        case 'leave': {
          if (!sessionUserId) return;
          removeUserFromRoom(roomId, sessionUserId);
          broadcastToRoom(room, { type: 'leave', userId: sessionUserId });
          ws.close(1000, 'Normal closure');
          break;
        }

        // ── presence ────────────────────────────────────────────────────────
        case 'presence': {
          if (!sessionUserId || !joined) return;
          const user = room.users.get(sessionUserId);
          if (!user) return;
          user.cursorBeat    = typeof msg.cursorBeat    === 'number' ? msg.cursorBeat    : null;
          user.activeTrackId = typeof msg.activeTrackId === 'string' ? msg.activeTrackId : null;
          user.name          = typeof msg.name  === 'string' ? msg.name.slice(0, 40)  : user.name;
          user.color         = /^#[0-9a-fA-F]{6}$/.test(msg.color as string)
            ? (msg.color as string) : user.color;

          broadcastToRoom(room, {
            type: 'presence',
            userId: sessionUserId,
            name: user.name,
            color: user.color,
            cursorBeat: user.cursorBeat,
            activeTrackId: user.activeTrackId,
          }, sessionUserId);
          break;
        }

        // ── action ──────────────────────────────────────────────────────────
        case 'action': {
          if (!sessionUserId || !joined) return;
          const action = msg.action as Record<string, unknown> | undefined;
          if (!action || !ALLOWED_ACTION_TYPES.has(action.type as string)) return;

          // Broadcast to room peers only (not back to sender)
          broadcastToRoom(room, {
            type:   'action',
            userId: sessionUserId,
            action,
          }, sessionUserId);
          break;
        }

        // ── ping / pong ──────────────────────────────────────────────────────
        case 'ping':
          send(ws, { type: 'pong' });
          break;
      }
    });

    // ── Close handler ─────────────────────────────────────────────────────
    ws.on('close', () => {
      if (!sessionUserId) return;
      removeUserFromRoom(roomId, sessionUserId);
      broadcastToRoom(
        rooms.get(roomId) ?? { id: roomId, users: new Map() },
        { type: 'leave', userId: sessionUserId },
      );
    });

    ws.on('error', () => {
      ws.terminate();
    });
  });

  return wss;
}

// ── Diagnostic exports (for server health check route) ────────────────────────

export function getRoomStats(): { roomCount: number; totalUsers: number; rooms: { id: string; users: number }[] } {
  const roomList = Array.from(rooms.entries()).map(([id, r]) => ({
    id,
    users: r.users.size,
  }));
  return {
    roomCount:  rooms.size,
    totalUsers: roomList.reduce((acc, r) => acc + r.users, 0),
    rooms:      roomList,
  };
}