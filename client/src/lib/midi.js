// FILE: client/src/lib/midi.ts
const MIDI_CMD = {
    NOTE_OFF: 0x80,
    NOTE_ON: 0x90,
    AFTERTOUCH: 0xA0,
    CC: 0xB0,
    PROGRAM: 0xC0,
    CHAN_PRESS: 0xD0,
    PITCH_BEND: 0xE0,
    CLOCK: 0xF8,
    START: 0xFA,
    STOP: 0xFC,
};
function parseMessage(data, deviceName) {
    const statusByte = data[0];
    const isChannelMsg = statusByte < 0xF0;
    const cmdByte = isChannelMsg ? statusByte & 0xF0 : statusByte;
    const channel = isChannelMsg ? (statusByte & 0x0F) + 1 : 0; // 1-indexed
    const base = {
        type: 'unknown',
        channel,
        rawData: data,
        deviceName,
        timestamp: performance.now(),
    };
    switch (cmdByte) {
        case MIDI_CMD.NOTE_ON: {
            const vel = data[2];
            // Some devices send NOTE_ON with vel=0 as NOTE_OFF
            if (vel === 0) {
                return { ...base, type: 'noteOff', note: data[1], velocity: 0 };
            }
            return { ...base, type: 'noteOn', note: data[1], velocity: vel / 127 };
        }
        case MIDI_CMD.NOTE_OFF:
            return { ...base, type: 'noteOff', note: data[1], velocity: data[2] / 127 };
        case MIDI_CMD.CC:
            return { ...base, type: 'cc', controller: data[1], value: data[2] / 127 };
        case MIDI_CMD.PITCH_BEND: {
            // 14-bit value, center = 8192
            const raw = (data[2] << 7) | data[1];
            const normalized = (raw - 8192) / 8192;
            return { ...base, type: 'pitchBend', pitchBend: normalized };
        }
        case MIDI_CMD.AFTERTOUCH:
        case MIDI_CMD.CHAN_PRESS:
            return { ...base, type: 'aftertouch', pressure: data[1] / 127 };
        case MIDI_CMD.CLOCK:
        case MIDI_CMD.START:
        case MIDI_CMD.STOP:
            return { ...base, type: 'clock' };
        default:
            return base;
    }
}
function deviceFromPort(port) {
    return {
        id: port.id,
        name: port.name ?? 'Unknown Device',
        manufacturer: port.manufacturer ?? 'Unknown',
        state: port.state,
        connection: port.connection,
    };
}
export function initMIDI(options) {
    const isSupported = typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;
    if (!isSupported) {
        options.onError?.(new Error('Web MIDI API is not supported in this browser.'));
        return { getDevices: () => [], destroy: () => { }, isSupported: false };
    }
    let access = null;
    const { onPad, onMessage, onCC, onPitchBend, onNoteOff, onDeviceChange, onError, channels = [], padMapper = (note) => note % 16, sysex = false, } = options;
    const channelSet = new Set(channels);
    // Returns a snapshot of currently connected inputs as MIDIDevice[]
    const getDevices = () => {
        if (!access)
            return [];
        const devices = [];
        access.inputs.forEach((input) => devices.push(deviceFromPort(input)));
        return devices;
    };
    const handleMessage = (input) => (msg) => {
        if (!msg.data || msg.data.length === 0)
            return;
        const event = parseMessage(msg.data, input.name ?? 'Unknown');
        // Channel filter — skip if we're filtering and this channel isn't in the set
        if (channelSet.size > 0 && event.channel > 0 && !channelSet.has(event.channel))
            return;
        // Route to specific callbacks
        switch (event.type) {
            case 'noteOn':
                onPad?.(padMapper(event.note), event.velocity, event.channel);
                break;
            case 'noteOff':
                onNoteOff?.(event.note, event.channel);
                break;
            case 'cc':
                onCC?.(event.controller, event.value, event.channel);
                break;
            case 'pitchBend':
                onPitchBend?.(event.pitchBend, event.channel);
                break;
        }
        // Always fire the raw handler
        onMessage?.(event);
    };
    // Attach listeners to all current inputs
    const bindInputs = () => {
        if (!access)
            return;
        access.inputs.forEach((input) => {
            input.onmidimessage = handleMessage(input);
        });
    };
    // Re-bind when devices are added/removed
    const handleStateChange = () => {
        bindInputs();
        onDeviceChange?.(getDevices());
    };
    navigator.requestMIDIAccess({ sysex }).then((midiAccess) => {
        access = midiAccess;
        access.onstatechange = handleStateChange;
        bindInputs();
        onDeviceChange?.(getDevices());
    }).catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(error);
    });
    const destroy = () => {
        if (!access)
            return;
        access.inputs.forEach((input) => { input.onmidimessage = null; });
        access.onstatechange = null;
        access = null;
    };
    return { getDevices, destroy, isSupported: true };
}
