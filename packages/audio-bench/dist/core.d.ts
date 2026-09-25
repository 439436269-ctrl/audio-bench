/** Encode mono Float32 samples as a 16-bit PCM WAV blob-safe Uint8Array (no DOM needed). */
export declare function encodeWavBytes(samples: Float32Array, sampleRate: number): Uint8Array;
export interface SampleChunk {
    index: number;
    startSec: number;
    endSec: number;
    samples: Float32Array;
}
/** Split mono samples into fixed-length chunks (pure math, Node-safe). */
export declare function sliceSamples(samples: Float32Array, sampleRate: number, chunkSec: number): SampleChunk[];
