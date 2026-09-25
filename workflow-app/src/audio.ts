export interface Chunk {
  index: number;
  startSec: number;
  endSec: number;
  blob: Blob;
  url: string;
  bytes: number;
}

export interface ProcessResult {
  durationSec: number;
  chunkSec: number;
  chunks: Chunk[];
}

export const CHUNK_SEC = 85;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

export function isAudioFile(name: string, type: string): boolean {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const okExt = ["mp3", "m4a", "wav", "aac", "flac", "ogg", "opus", "amr", "mp4", "3gp", "webm", "wma"];
  if (okExt.includes(ext)) return true;
  return type.startsWith("audio/");
}

/** Decode any browser-supported audio container into an AudioBuffer. */
export async function decodeAudio(file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(data);
  } finally {
    void ctx.close();
  }
}

/** Downmix to mono 16 kHz so chunks match a typical ASR input. */
export async function toMono16k(buffer: AudioBuffer): Promise<AudioBuffer> {
  const rate = 16000;
  const frames = Math.max(1, Math.ceil(buffer.duration * rate));
  const offline = new OfflineAudioContext(1, frames, rate);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start();
  return offline.startRendering();
}

/** Encode mono Float32 samples as a 16-bit PCM WAV blob. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
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
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export interface SliceProgress {
  phase: "decoding" | "slicing";
  done: number;
  total: number;
}

/** Full pipeline: decode → mono/16k → slice into WAV chunks. */
export async function processAudio(
  file: File,
  chunkSec: number,
  onProgress: (p: SliceProgress) => void,
): Promise<ProcessResult> {
  onProgress({ phase: "decoding", done: 0, total: 1 });
  const decoded = await decodeAudio(file);
  const mono = await toMono16k(decoded);
  const samples = mono.getChannelData(0);
  const rate = mono.sampleRate;
  const duration = mono.duration;
  const total = Math.max(1, Math.ceil(duration / chunkSec));

  const chunks: Chunk[] = [];
  for (let i = 0; i < total; i++) {
    const start = i * chunkSec;
    const end = Math.min((i + 1) * chunkSec, duration);
    const from = Math.floor(start * rate);
    const to = Math.min(Math.floor(end * rate), samples.length);
    const slice = samples.subarray(from, to);
    const blob = encodeWav(slice, rate);
    chunks.push({
      index: i,
      startSec: start,
      endSec: end,
      blob,
      url: URL.createObjectURL(blob),
      bytes: blob.size,
    });
    onProgress({ phase: "slicing", done: i + 1, total });
    // yield to UI between chunks so progress paints
    await new Promise((r) => setTimeout(r, 0));
  }
  return { durationSec: duration, chunkSec, chunks };
}

export function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\.[^.]+$/, "");
}

export interface Manifest {
  tool: "audio-bench";
  createdAt: string;
  source: string;
  durationSec: number;
  chunkSec: number;
  sampleRate: 16000;
  channels: 1;
  chunks: { file: string; startSec: number; endSec: number; bytes: number }[];
  asrHint: string;
}

export function buildManifest(source: string, result: ProcessResult, fileNames: string[]): Manifest {
  return {
    tool: "audio-bench",
    createdAt: new Date().toISOString(),
    source,
    durationSec: result.durationSec,
    chunkSec: result.chunkSec,
    sampleRate: 16000,
    channels: 1,
    chunks: result.chunks.map((c, i) => ({
      file: fileNames[i],
      startSec: Math.round(c.startSec * 100) / 100,
      endSec: Math.round(c.endSec * 100) / 100,
      bytes: c.bytes,
    })),
    asrHint: "每块均为 16kHz 单声道 WAV，≤90s，可直接送任意 ASR。",
  };
}

/** Pick a folder and write every chunk + manifest; returns target folder name. */
export async function saveChunks(
  items: { name: string; result: ProcessResult }[],
): Promise<string | null> {
  const anyWin = window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
  };
  if (!anyWin.showDirectoryPicker) {
    // fallback: sequential downloads
    for (const { name, result } of items) {
      const base = safeName(name);
      triggerDownload(buildManifest(name, result, result.chunks.map((c) => `chunk_${String(c.index).padStart(3, "0")}.wav`)), `${base}-manifest.json`);
      for (const c of result.chunks) {
        triggerBlobDownload(c.blob, `${base}-chunk_${String(c.index).padStart(3, "0")}.wav`);
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    return "（浏览器下载）";
  }

  const root = await anyWin.showDirectoryPicker({ mode: "readwrite" });
  for (const { name, result } of items) {
    const base = safeName(name);
    const dir = await root.getDirectoryHandle(`${base}-chunks`, { create: true });
    const fileNames = result.chunks.map((c) => `chunk_${String(c.index).padStart(3, "0")}.wav`);
    const manifest = buildManifest(name, result, fileNames);
    await writeText(dir, "manifest.json", JSON.stringify(manifest, null, 2));
    for (let i = 0; i < result.chunks.length; i++) {
      await writeBlob(dir, fileNames[i], result.chunks[i].blob);
    }
  }
  return root.name;
}

function triggerDownload(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerBlobDownload(blob, filename);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function writeText(dir: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}

async function writeBlob(dir: FileSystemDirectoryHandle, name: string, blob: Blob): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}
