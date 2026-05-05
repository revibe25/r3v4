/**
 * useCollabSocket.ts
 * Real-time collaboration via WebSocket (ws@8.19.0 server at server/ws/).
 *
 * Protocol messages (JSON):
 *   { type: 'join',         userId, name, color, roomId }
 *   { type: 'leave',        userId }
 *   { type: 'presence',     userId, cursorBeat, activeTrackId }
 *   { type: 'action',       userId, action: DAWAction }
 *   { type: 'users',        users: CollabUser[] }
 *   { type: 'ping' / 'pong' }
 *
 * The hook manages connection lifecycle: connect on room join, heartbeat,
 * reconnect-with-backoff on disconnect.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { CollabUser } from './useDAWStore';
import { useDAWStore } from './useDAWStore';

const WS_URL =
  (import.meta.env?.VITE_WS_URL as string | undefined) ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
    : 'ws://localhost:3001/ws');

export interface CollabAPI {
  joinRoom: (roomId: string, userId: string, name: string, color: string) => void;
  leaveRoom: () => void;
  broadcastCursor: (beat: number, trackId: string | null) => void;
  broadcastAction: (action: Record<string, unknown>) => void;
  isConnected: () => boolean;
}

export function useCollabSocket(): CollabAPI {
  const wsRef        = useRef<WebSocket | null>(null);
  const _reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const backoffRef   = useRef(1000);
  const activeRef    = useRef(false);
  const sessionRef   = useRef<{ userId: string; name: string; color: string; roomId: string } | null>(null);

  const _connect = useCallback((roomId: string, userId: string, name: string, color: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const _ws = new WebSocket(`${WS_URL}?room=${encodeURIComponent(roomId)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000;
      useDAWStore.getState().setCollabConnected(true);
      ws.send(JSON.stringify({ type: 'join', userId, name, color, roomId }));

      // Heartbeat
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 25_000);
    };

    ws.onmessage = (evt) => {
      try {
        const _msg = JSON.parse(evt.data as string) as Record<string, unknown>;
        const _store = useDAWStore.getState();

        switch (msg.type) {
          case 'users':
            store.setCollabUsers((msg.users as CollabUser[]) || []);
            break;
          case 'join':
            store.upsertCollabUser({
              id: msg.userId as string,
              name: msg.name as string,
              color: msg.color as string,
              cursorBeat: null,
              activeTrackId: null,
              joinedAt: Date.now(),
            });
            break;
          case 'leave':
            store.removeCollabUser(msg.userId as string);
            break;
          case 'presence':
            store.upsertCollabUser({
              id: msg.userId as string,
              name: msg.name as string,
              color: msg.color as string,
              cursorBeat: (msg.cursorBeat as number) ?? null,
              activeTrackId: (msg.activeTrackId as string) ?? null,
              joinedAt: Date.now(),
            });
            break;
          case 'action':
            // Apply remote store actions (e.g. track mute toggled by peer)
            applyRemoteAction(msg.action as Record<string, unknown>);
            break;
          case 'pong':
            break;
        }
      } catch { /* malformed message */ }
    };

    ws.onerror = () => {
      useDAWStore.getState().setCollabConnected(false);
    };

    ws.onclose = () => {
      useDAWStore.getState().setCollabConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);

      // Reconnect if still active
      if (activeRef.current && sessionRef.current) {
        reconnectRef.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 1.5, 30_000);
          const _s = sessionRef.current!;
          connect(s.roomId, s.userId, s.name, s.color);
        }, backoffRef.current);
      }
    };
  }, []);

  const _applyRemoteAction = (action: Record<string, unknown>) => {
    const _store = useDAWStore.getState();
    // Only apply non-destructive remote actions (mute/solo/gain/pan)
    switch (action.type) {
      case 'trackMute':
        store.updateTrack(action.trackId as string, { mute: action.value as boolean });
        break;
      case 'trackGain':
        store.updateTrack(action.trackId as string, { gain: action.value as number });
        break;
      case 'bpm':
        store.setBpm(action.value as number);
        break;
    }
  };

  const _joinRoom = useCallback((roomId: string, userId: string, name: string, color: string) => {
    activeRef.current = true;
    sessionRef.current = { roomId, userId, name, color };
    useDAWStore.getState().setCollabRoom(roomId);
    useDAWStore.getState().setCollabEnabled(true);
    connect(roomId, userId, name, color);
  }, [connect]);

  const _leaveRoom = useCallback(() => {
    activeRef.current = false;
    sessionRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const _userId = useDAWStore.getState().collabUsers.find(u => u.id)?.id;
      if (userId) wsRef.current.send(JSON.stringify({ type: 'leave', userId }));
      wsRef.current.close();
    }
    if (pingRef.current)    clearInterval(pingRef.current);
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    useDAWStore.getState().setCollabEnabled(false);
    useDAWStore.getState().setCollabConnected(false);
    useDAWStore.getState().setCollabRoom(null);
    useDAWStore.getState().setCollabUsers([]);
  }, []);

  const _broadcastCursor = useCallback((beat: number, trackId: string | null) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const _s = sessionRef.current;
    if (!s) return;
    wsRef.current.send(JSON.stringify({
      type: 'presence',
      userId: s.userId,
      name: s.name,
      color: s.color,
      cursorBeat: beat,
      activeTrackId: trackId,
    }));
  }, []);

  const _broadcastAction = useCallback((action: Record<string, unknown>) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const _s = sessionRef.current;
    if (!s) return;
    wsRef.current.send(JSON.stringify({ type: 'action', userId: s.userId, action }));
  }, []);

  const _isConnected = useCallback(() =>
    wsRef.current?.readyState === WebSocket.OPEN,
  []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      wsRef.current?.close();
      if (pingRef.current)    clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, []);

  return { joinRoom, leaveRoom, broadcastCursor, broadcastAction, isConnected };
}
