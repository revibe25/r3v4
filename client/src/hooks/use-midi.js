/**
 * use-midi.ts — Web MIDI API input routing for R3 v4
 *
 * v2 WIRING CORRECTIONS (verified against confirmed file reads):
 *
 *   onKey(index, octaveShift, velocity)
 *     Matches piano-keys.tsx onTrigger signature exactly:
 *       onTrigger(index: number, octaveShift: number, velocity: number)
 *     We pass octaveShift=0 — piano-keys manages its own octave state
 *     internally and the component will add its own octave offset on top.
 *
 *   onPad(index, velocity) — OPTIONAL, not wired in instrument.tsx
 *     drum-pads.tsx owns its own midiAccessRef and calls playPadWithFx()
 *     internally. Wiring onPad in instrument.tsx would cause the pad sample
 *     to play twice (once from drum-pads MIDI handler, once from here).
 *     The prop exists for callers that use a pad component WITHOUT built-in
 *     MIDI handling, or for routing to a custom handler that skips drum-pads.
 *
 * Note mapping:
 *   Pads  → MIDI notes 36–51  (C2–D#3,  16 pads)
 *   Keys  → MIDI notes 60–83  (C4–B5,   24 keys)
 */
import { useEffect, useRef, useCallback, useState } from 'react';
const PAD_MIN = 36;
const PAD_MAX = 51;
const KEY_MIN = 60;
const KEY_MAX = 83;
export function useMidi({ onPad, onKey, enabled = true } = {}) {
    const accessRef = useRef(null);
    const [midiStatus, setStatus] = useState('idle');
    const [midiInputCount, setCount] = useState(0);
    // Stable refs — callback identity changes don't re-subscribe the device
    const onPadRef = useRef(onPad);
    const onKeyRef = useRef(onKey);
    useEffect(() => { onPadRef.current = onPad; });
    useEffect(() => { onKeyRef.current = onKey; });
    const handleMessage = useCallback((event) => {
        const { data } = event;
        if (!data || data.length < 3)
            return;
        const cmd = data[0] & 0xf0;
        const note = data[1];
        const velocity = data[2];
        // Note-on only (velocity 0 = note-off in running status)
        if (cmd !== 0x90 || velocity === 0)
            return;
        const vel = velocity / 127;
        if (note >= PAD_MIN && note <= PAD_MAX) {
            onPadRef.current?.(note - PAD_MIN, vel);
        }
        else if (note >= KEY_MIN && note <= KEY_MAX) {
            // piano-keys.tsx onTrigger(index, octaveShift, velocity) — 3 params
            // octaveShift=0: the piano component manages its own octave offset
            onKeyRef.current?.(note - KEY_MIN, 0, vel);
        }
    }, []);
    const wireInput = useCallback((input) => {
        input.onmidimessage = handleMessage;
    }, [handleMessage]);
    useEffect(() => {
        if (!enabled)
            return;
        if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
            setStatus('unavailable');
            return;
        }
        let cancelled = false;
        navigator.requestMIDIAccess({ sysex: false })
            .then((access) => {
            if (cancelled)
                return;
            accessRef.current = access;
            access.inputs.forEach(wireInput);
            setCount(access.inputs.size);
            setStatus(access.inputs.size > 0 ? 'active' : 'idle');
            access.onstatechange = (e) => {
                const port = e.port;
                if (port && port.type === 'input') {
                    if (port && port.state === 'connected')
                        wireInput(port);
                    else
                        port.onmidimessage = null;
                }
                setCount(access.inputs.size);
                setStatus(access.inputs.size > 0 ? 'active' : 'idle');
            };
        })
            .catch(() => { if (!cancelled)
            setStatus('denied'); });
        return () => {
            cancelled = true;
            if (accessRef.current) {
                accessRef.current.inputs.forEach(input => {
                    input.onmidimessage = null;
                });
                accessRef.current.onstatechange = null;
                accessRef.current = null;
            }
        };
    }, [enabled, wireInput]);
    return { midiStatus, midiInputCount };
}
