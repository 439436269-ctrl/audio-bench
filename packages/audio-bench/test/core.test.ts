import { describe, expect, it } from "vitest";
import { encodeWavBytes, sliceSamples } from "../src/core";

describe("sliceSamples", () => {
  it("splits 3 min of 16k mono into 85s chunks (2 full + 1 tail)", () => {
    const rate = 16000;
    const samples = new Float32Array(rate * 180); // 180 s
    const chunks = sliceSamples(samples, rate, 85);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].startSec).toBe(0);
    expect(chunks[0].endSec).toBe(85);
    expect(chunks[1].startSec).toBe(85);
    expect(chunks[1].endSec).toBe(170);
    expect(chunks[2].startSec).toBe(170);
    expect(chunks[2].endSec).toBe(180);
    // no samples lost
    const sum = chunks.reduce((s, c) => s + c.samples.length, 0);
    expect(sum).toBe(samples.length);
  });

  it("returns a single chunk for short audio", () => {
    const rate = 16000;
    const chunks = sliceSamples(new Float32Array(rate * 10), rate, 85);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].endSec).toBe(10);
  });
});

describe("encodeWavBytes", () => {
  it("writes a valid 44-byte PCM header", () => {
    const rate = 16000;
    const pcm = encodeWavBytes(new Float32Array(rate), rate);
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    expect(String.fromCharCode(...pcm.subarray(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...pcm.subarray(8, 12))).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(rate); // sample rate
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint16(34, true)).toBe(16); // bits
    expect(pcm.byteLength).toBe(44 + rate * 2);
  });

  it("clamps out-of-range samples", () => {
    const pcm = encodeWavBytes(new Float32Array([2, -2, 0.5]), 8000);
    const view = new DataView(pcm.buffer, 44, 6);
    expect(view.getInt16(0, true)).toBe(0x7fff);
    expect(view.getInt16(2, true)).toBe(-0x8000);
    expect(view.getInt16(4, true)).toBeGreaterThan(0);
  });
});
