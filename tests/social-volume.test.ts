import { describe, expect, it } from "vitest";
import { AudioSample } from "mediabunny";
import { scaleSample } from "../components/admin/social/volume";

describe("scaleSample", () => {
  it("scales each channel and clips at full scale", () => {
    const s = new AudioSample({
      data: new Float32Array([0.1, -0.2, 0.6, 0.3, -0.4, 0.9]),
      format: "f32-planar",
      numberOfChannels: 2,
      sampleRate: 48000,
      timestamp: 1.5,
    });
    const out = scaleSample(s, 2);
    const right = new Float32Array(3);
    out.copyTo(right, { planeIndex: 1, format: "f32-planar" });
    expect(Array.from(right)).toEqual([
      Math.fround(0.6),
      Math.fround(-0.8),
      1,
    ]);
    expect(out.timestamp).toBe(1.5);
    expect(out.numberOfFrames).toBe(3);
  });
});
