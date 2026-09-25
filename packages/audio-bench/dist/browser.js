import { encodeWavBytes, sliceSamples } from "./core.js";
/**
 * Browser pipeline: decode any browser-supported audio container
 * (mp3/m4a/wav/flac/ogg…) → downmix mono @ sampleRate → slice → WAV Blobs.
 */
export async function processAudio(file, options = {}) {
    const chunkSec = options.chunkSec ?? 85;
    const targetRate = options.sampleRate ?? 16000;
    const onProgress = options.onProgress ?? (() => { });
    onProgress({ phase: "decoding", done: 0, total: 1 });
    const data = await file.arrayBuffer();
    const ctx = new AudioContext();
    let decoded;
    try {
        decoded = await ctx.decodeAudioData(data);
    }
    finally {
        void ctx.close();
    }
    const frames = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const offline = new OfflineAudioContext(1, frames, targetRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const mono = await offline.startRendering();
    const samples = mono.getChannelData(0);
    const parts = sliceSamples(samples, targetRate, chunkSec);
    const chunks = [];
    for (const part of parts) {
        const bytes = encodeWavBytes(part.samples, targetRate);
        chunks.push({
            index: part.index,
            startSec: part.startSec,
            endSec: part.endSec,
            blob: new Blob([bytes], { type: "audio/wav" }),
            bytes: bytes.byteLength,
        });
        onProgress({ phase: "slicing", done: part.index + 1, total: parts.length });
        // yield so progress paints in UI hosts
        await new Promise((r) => setTimeout(r, 0));
    }
    return { durationSec: mono.duration, chunkSec, sampleRate: targetRate, channels: 1, chunks };
}
