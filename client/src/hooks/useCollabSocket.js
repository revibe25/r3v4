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
import { useDAWStore } from './useDAWStore';
const WS_URL = import.meta.env?.VITE_WS_URL ||
    (typeof window !== 'undefined'
        ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
        : 'ws://localhost:3001/ws');
export function useCollabSocket() {
    const wsRef = useRef(null);
    const reconnectRef = useRef(null);
    const pingRef = useRef(null);
    const backoffRef = useRef(1000);
    const activeRef = useRef(false);
    const sessionRef = useRef(null);
    const connect = useCallback((roomId, userId, name, color) => {
        if (wsRef.current?.readyState === WebSocket.OPEN)
            return;
        const ws = new WebSocket(`${WS_URL}?room=${encodeURIComponent(roomId)}`);
        wsRef.current = ws;
        ws.onopen = () => {
            backoffRef.current = 1000;
            useDAWStore.getState().setCollabConnected(true);
            ws.send(JSON.stringify({ type: 'join', userId, name, color, roomId }));
            // Heartbeat
            pingRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN)
                    ws.send(JSON.stringify({ type: 'ping' }));
            }, 25000);
        };
        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                const store = useDAWStore.getState();
                switch (msg.type) {
                    case 'users':
                        store.setCollabUsers(msg.users || []);
                        break;
                    case 'join':
                        store.upsertCollabUser({
                            id: msg.userId,
                            name: msg.name,
                            color: msg.color,
                            cursorBeat: null,
                            activeTrackId: null,
                            joinedAt: Date.now(),
                        });
                        break;
                    case 'leave':
                        store.removeCollabUser(msg.userId);
                        break;
                    case 'presence':
                        store.upsertCollabUser({
                            id: msg.userId,
                            name: msg.name,
                            color: msg.color,
                            cursorBeat: msg.cursorBeat ?? null,
                            activeTrackId: msg.activeTrackId ?? null,
                            joinedAt: Date.now(),
                        });
                        break;
                    case 'action':
                        // Apply remote store actions (e.g. track mute toggled by peer)
                        applyRemoteAction(msg.action);
                        break;
                    case 'pong':
                        break;
                }
            }
            catch { /* malformed message */ }
        };
        ws.onerror = () => {
            useDAWStore.getState().setCollabConnected(false);
        };
        ws.onclose = () => {
            useDAWStore.getState().setCollabConnected(false);
            if (pingRef.current)
                clearInterval(pingRef.current);
            // Reconnect if still active
            if (activeRef.current && sessionRef.current) {
                reconnectRef.current = setTimeout(() => {
                    backoffRef.current = Math.min(backoffRef.current * 1.5, 30000);
                    const s = sessionRef.current;
                    connect(s.roomId, s.userId, s.name, s.color);
                }, backoffRef.current);
            }
        };
    }, []);
    const applyRemoteAction = (action) => {
        const store = useDAWStore.getState();
        // Only apply non-destructive remote actions (mute/solo/gain/pan)
        switch (action.type) {
            case 'trackMute':
                store.updateTrack(action.trackId, { mute: action.value });
                break;
            case 'trackGain':
                store.updateTrack(action.trackId, { gain: action.value });
                break;
            case 'bpm':
                store.setBpm(action.value);
                break;
        }
    };
    const joinRoom = useCallback((roomId, userId, name, color) => {
        activeRef.current = true;
        sessionRef.current = { roomId, userId, name, color };
        useDAWStore.getState().setCollabRoom(roomId);
        useDAWStore.getState().setCollabEnabled(true);
        connect(roomId, userId, name, color);
    }, [connect]);
    const leaveRoom = useCallback(() => {
        activeRef.current = false;
        sessionRef.current = null;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const userId = useDAWStore.getState().collabUsers.find(u => u.id)?.id;
            if (userId)
                wsRef.current.send(JSON.stringify({ type: 'leave', userId }));
            wsRef.current.close();
        }
        if (pingRef.current)
            clearInterval(pingRef.current);
        if (reconnectRef.current)
            clearTimeout(reconnectRef.current);
        useDAWStore.getState().setCollabEnabled(false);
        useDAWStore.getState().setCollabConnected(false);
        useDAWStore.getState().setCollabRoom(null);
        useDAWStore.getState().setCollabUsers([]);
    }, []);
    const broadcastCursor = useCallback((beat, trackId) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN)
            return;
        const s = sessionRef.current;
        if (!s)
            return;
        wsRef.current.send(JSON.stringify({
            type: 'presence',
            userId: s.userId,
            name: s.name,
            color: s.color,
            cursorBeat: beat,
            activeTrackId: trackId,
        }));
    }, []);
    const broadcastAction = useCallback((action) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN)
            return;
        const s = sessionRef.current;
        if (!s)
            return;
        wsRef.current.send(JSON.stringify({ type: 'action', userId: s.userId, action }));
    }, []);
    const isConnected = useCallback(() => wsRef.current?.readyState === WebSocket.OPEN, []);
    useEffect(() => {
        return () => {
            activeRef.current = false;
            wsRef.current?.close();
            if (pingRef.current)
                clearInterval(pingRef.current);
            if (reconnectRef.current)
                clearTimeout(reconnectRef.current);
        };
    }, []);
    return { joinRoom, leaveRoom, broadcastCursor, broadcastAction, isConnected };
}
