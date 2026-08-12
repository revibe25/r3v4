/// <reference lib="webworker" />
self.onmessage = (e) => {
    if (e.data.type !== 'compute')
        return;
    const { samples, width } = e.data;
    const peaks = new Float32Array(width);
    const blockSize = Math.floor(samples.length / width);
    for (let i = 0; i < width; i++) {
        let max = 0;
        const offset = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
            const abs = Math.abs(samples[offset + j] ?? 0);
            if (abs > max)
                max = abs;
        }
        peaks[i] = max;
    }
    // Transfer buffer back — zero-copy
    const result = { type: 'result', peaks };
    self.postMessage(result, [peaks.buffer]);
};
export {};
