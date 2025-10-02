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