import { Chunk, ProcessResult, SliceProgress } from "./types.js";
export type { Chunk, ProcessResult, SliceProgress };
export interface ProcessOptions {
    /** chunk length in seconds (default 85, safe for most ASR) */
    chunkSec?: number;
    /** target sample rate for output WAV (default 16000) */
    sampleRate?: number;
    onProgress?: (p: SliceProgress) => void;
}
/**
 * Browser pipeline: decode any browser-supported audio container
 * (mp3/m4a/wav/flac/ogg…) → downmix mono @ sampleRate → slice → WAV Blobs.
 */
export declare function processAudio(file: Blob, options?: ProcessOptions): Promise<ProcessResult>;
