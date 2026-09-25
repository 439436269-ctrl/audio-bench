/** Encode mono Float32 samples as a 16-bit PCM WAV blob-safe Uint8Array (no DOM needed). */
export function encodeWavBytes(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign(bytesPerSample), true);
  view.setUint16(32, blockAlign(bytesPerSample), true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }
  return new Uint8Array(buffer);
}

const blockAlign = (bytesPerSample: number) => bytesPerSample;

export interface SampleChunk {
  index: number;
  startSec: number;
  endSec: number;
  samples: Float32Array;
}

/** Split mono samples into fixed-length chunks (pure math, Node-safe). */
export function sliceSamples(
  samples: Float32Array,
  sampleRate: number,
  chunkSec: number,
): SampleChunk[] {
  const duration = samples.length / sampleRate;
  const total = Math.max(1, Math.ceil(duration / chunkSec));
  const out: SampleChunk[] = [];
  for (let i = 0; i < total; i++) {
    const startSec = i * chunkSec;
    const endSec = Math.min((i + 1) * chunkSec, duration);
    const from = Math.floor(startSec * sampleRate);
    const to = Math.min(Math.floor(endSec * sampleRate), samples.length);
    out.push({
      index: i,
      startSec,
      endSec,
      samples: samples.subarray(from, to),
    });
  }
  return out;
}
