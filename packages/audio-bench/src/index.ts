export { processAudio } from "./browser.js";
export type { ProcessOptions } from "./browser.js";
export { encodeWavBytes, sliceSamples } from "./core.js";
export type { SampleChunk } from "./core.js";
export type { Chunk, ProcessResult, SliceProgress } from "./types.js";

/** Default chunk length in seconds — safe for virtually every ASR service. */
export const CHUNK_SEC = 85;
