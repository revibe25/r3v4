/**
 * useMIDIDevices — Web MIDI API integration for R3 v4.
 * Enumerates inputs, subscribes to state changes, and forwards
 * MIDI messages to a user-supplied callback.
 */
import { useState, useEffect, useRef, useCallback } from "react";

export interface MIDIDeviceInfo {
  id:           string;
  name:         string;
  manufacturer: string;
  state:        "connected" | "disconnected";
}

export interface MIDIMessage {
  type:       "noteOn" | "noteOff" | "cc" | "pitchBend" | "clock" | "other";
  channel:    number;
  note?:      number;
  velocity?:  number;
  controller?: number;
  value?:     number;
  bend?:      number;
  raw:        Uint8Array;
  timestamp:  number;
}

export interface UseMIDIDevicesReturn {
  supported:  boolean;
  inputs:     MIDIDeviceInfo[];
  activeIds:  Set<string>;
  enable:     (id: string) => void;
  disable:    (id: string) => void;
  enableAll:  () => void;
  disableAll: () => void;
  error:      string | null;
}

function parseMIDI(data: Uint8Array, timestamp: number): MIDIMessage {
  const status  = data[0];
  const channel = status & 0x0f;
  const type    = (status >> 4) & 0x0f;

  switch (type) {
    case 0x9:
      return data[2] > 0
        ? { type: "noteOn",  channel, note: data[1], velocity: data[2], raw: data, timestamp }
        : { type: "noteOff", channel, note: data[1], velocity: 0,       raw: data, timestamp };
    case 0x8:
      return { type: "noteOff", channel, note: data[1], velocity: data[2], raw: data, timestamp };
    case 0xb:
      return { type: "cc", channel, controller: data[1], value: data[2], raw: data, timestamp };
    case 0xe: {
      const bend = ((data[2] << 7) | data[1]) - 8192;
      return { type: "pitchBend", channel, bend, raw: data, timestamp };
    }
    case 0xf:
      return { type: "clock", channel: 0, raw: data, timestamp };
    default:
      return { type: "other", channel, raw: data, timestamp };
  }
}

export function useMIDIDevices(
  onMessage?: (msg: MIDIMessage) => void,
): UseMIDIDevicesReturn {
  const [inputs,    setInputs]    = useState<MIDIDeviceInfo[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [error,     setError]     = useState<string | null>(null);
  const accessRef   = useRef<MIDIAccess | null>(null);
  const listenersRef = useRef<Map<string, (e: MIDIMessageEvent) => void>>(new Map());
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const supported = typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;

  const refreshInputs = useCallback((access: MIDIAccess) => {
    const list: MIDIDeviceInfo[] = [];
    access.inputs.forEach(input => {
      list.push({
        id:           input.id,
        name:         input.name ?? "Unknown Device",
        manufacturer: input.manufacturer ?? "",
        state:        input.state as "connected" | "disconnected",
      });
    });
    setInputs(list);
  }, []);

  const attachListener = useCallback((input: MIDIInput) => {
    if (listenersRef.current.has(input.id)) return;
    const listener = (e: MIDIMessageEvent) => {
      if (!e.data) return;
      const msg = parseMIDI(e.data, e.timeStamp);
      onMessageRef.current?.(msg);
    };
    input.addEventListener("midimessage", listener);
    listenersRef.current.set(input.id, listener);
  }, []);

  const detachListener = useCallback((input: MIDIInput) => {
    const listener = listenersRef.current.get(input.id);
    if (!listener) return;
    input.removeEventListener("midimessage", listener);
    listenersRef.current.delete(input.id);
  }, []);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    navigator.requestMIDIAccess({ sysex: false })
      .then(access => {
        if (cancelled) return;
        accessRef.current = access;
        refreshInputs(access);

        access.onstatechange = () => {
          if (!cancelled) refreshInputs(access);
        };
      })
      .catch(err => {
        if (!cancelled) setError(`MIDI access denied: ${err?.message ?? err}`);
      });

    return () => {
      cancelled = true;
      // Detach all listeners on unmount
      accessRef.current?.inputs.forEach(input => detachListener(input));
    };
  }, [supported, refreshInputs, detachListener]);

  const enable = useCallback((id: string) => {
    const input = accessRef.current?.inputs.get(id);
    if (!input) return;
    attachListener(input);
    setActiveIds(prev => new Set([...prev, id]));
  }, [attachListener]);

  const disable = useCallback((id: string) => {
    const input = accessRef.current?.inputs.get(id);
    if (input) detachListener(input);
    setActiveIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, [detachListener]);

  const enableAll = useCallback(() => {
    accessRef.current?.inputs.forEach(input => {
      attachListener(input);
      setActiveIds(prev => new Set([...prev, input.id]));
    });
  }, [attachListener]);

  const disableAll = useCallback(() => {
    accessRef.current?.inputs.forEach(input => detachListener(input));
    setActiveIds(new Set());
  }, [detachListener]);

  return { supported, inputs, activeIds, enable, disable, enableAll, disableAll, error };
}
