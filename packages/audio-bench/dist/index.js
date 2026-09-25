export { processAudio } from "./browser.js";
export { encodeWavBytes, sliceSamples } from "./core.js";
/** Default chunk length in seconds — safe for virtually every ASR service. */
export const CHUNK_SEC = 85;
