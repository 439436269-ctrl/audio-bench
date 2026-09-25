# audio-bench

**Slice any browser-decodable audio into ASR-friendly mono 16 kHz WAV chunks.**
Zero dependencies · pure WebAudio · works offline.

Part of [audio-bench](../../README.md) (drag-and-drop web tool). This package is the
slicing core as a library.

## Install

```bash
npm install audio-bench
```

## Use

```ts
import { processAudio } from "audio-bench";

// file: any Blob the browser can decode (mp3 / m4a / wav / flac / ogg…)
const { durationSec, chunks } = await processAudio(file, {
  chunkSec: 85,            // default 85 s — safe for virtually every ASR
  sampleRate: 16000,       // default 16 kHz mono
  onProgress: (p) => console.log(`${p.phase} ${p.done}/${p.total}`),
});

for (const c of chunks) {
  // c.blob is a 16-bit PCM WAV (mono, ≤ chunkSec long) — ready for any ASR
  await asr(c.blob);
}
```

Pure helpers also exported (Node-safe, no WebAudio needed):

```ts
import { encodeWavBytes, sliceSamples } from "audio-bench";

const chunks = sliceSamples(monoFloat32, 16000, 85); // → [{index,startSec,endSec,samples}]
const wav = encodeWavBytes(chunks[0].samples, 16000); // → Uint8Array
```

> `processAudio` uses `AudioContext` / `OfflineAudioContext`, so it runs in browsers
> (and Electron). For Node pipelines, decode with your own decoder and use the pure
> helpers above.

## API

| Export | Kind | Notes |
|--------|------|-------|
| `processAudio(file, opts?)` | browser | Blob → `{durationSec, chunkSec, sampleRate, channels, chunks[]}` |
| `sliceSamples(samples, rate, chunkSec)` | pure | fixed-length sample slicing |
| `encodeWavBytes(samples, rate)` | pure | mono Float32 → 16-bit PCM WAV `Uint8Array` |
| `CHUNK_SEC` | const | `85` |

## License

MIT
