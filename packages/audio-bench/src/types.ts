export interface Chunk {
  index: number;
  startSec: number;
  endSec: number;
  blob: Blob;
  bytes: number;
}

export interface ProcessResult {
  durationSec: number;
  chunkSec: number;
  sampleRate: number;
  channels: number;
  chunks: Chunk[];
}

export interface SliceProgress {
  phase: "decoding" | "slicing";
  done: number;
  total: number;
}
