import { create } from 'zustand';
const EMPTY_METER = {
    peakLeft: 0,
    peakRight: 0,
    rmsLeft: 0,
    rmsRight: 0,
    timestamp: 0,
};
export const useMeterStore = create((set, get) => ({
    meters: {},
    updateMeter: (id, meter) => {
        set((s) => ({ meters: { ...s.meters, [id]: meter } }));
    },
    getMeter: (id) => get().meters[id],
    // Components written against an older API called readMeter — forward to getMeter
    readMeter: (id) => get().meters[id],
    clearMeter: (id) => {
        set((s) => {
            const copy = { ...s.meters };
            delete copy[id];
            return { meters: copy };
        });
    },
    resetMeter: (id) => {
        if (get().meters[id]) {
            set((s) => ({
                meters: { ...s.meters, [id]: { ...EMPTY_METER, timestamp: Date.now() } },
            }));
        }
    },
}));
