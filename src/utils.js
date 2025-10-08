export function lerp(start, end, delta) {
    return start + (end - start) * delta;
}

export function getAvgFromArray(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function getMedianFromArray(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

// Root Mean Square
export function getRMS(analyser) {
    const node = analyser.analyser;            // underlying AnalyserNode
    const N = node.fftSize;

    // Prefer float API if available
    if (node.getFloatTimeDomainData) {
        const buf = new Float32Array(N);
        node.getFloatTimeDomainData(buf);        // values in [-1, 1]
        let sum = 0;
        for (let i = 0; i < N; i++) sum += buf[i] * buf[i];
        return Math.sqrt(sum / N);               // 0..1 (≈0.707 for full-scale sine)
    } else {
        // Fallback: bytes 0..255, convert to [-1,1]
        const bytes = new Uint8Array(N);
        node.getByteTimeDomainData(bytes);
        let sum = 0;
        for (let i = 0; i < N; i++) {
            const v = (bytes[i] - 128) / 128;
            sum += v * v;
        }
        return Math.sqrt(sum / N);
    }
}

export function getMaxFromArray(arr) {
    return Math.max(...arr);
}

// Normalize x from [min, max] to an integer byte 0..255
function toByte(x, min, max) {
    if (min === max) return 0;
    const t = (x - min) / (max - min);
    const u = Math.max(0, Math.min(1, t));
    return Math.round(u * 255);
}

export function toFloat(x, min, max) {
    if (min === max) return 0;
    return Math.max(0, Math.min(1, (x - min) / (max - min)));
}

export function getByteAvgFromArray(arr, min, max) {
    return toByte(getAvgFromArray(arr), min, max);
}