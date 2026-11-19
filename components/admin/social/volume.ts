import {
  ALL_FORMATS,
  AudioSample,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

export function scaleSample(s: AudioSample, gain: number): AudioSample {
  const frames = s.numberOfFrames;
  const data = new Float32Array(frames * s.numberOfChannels);
  for (let c = 0; c < s.numberOfChannels; c++)
    s.copyTo(data.subarray(c * frames, (c + 1) * frames), {
      planeIndex: c,
      format: "f32-planar",
    });
  for (let i = 0; i < data.length; i++)
    data[i] = Math.max(-1, Math.min(1, data[i] * gain));
  return new AudioSample({
    data,
    format: "f32-planar",
    numberOfChannels: s.numberOfChannels,
    sampleRate: s.sampleRate,
    timestamp: s.timestamp,
  });
}

export async function withVolume(
  file: Blob,
  gain: number,
  onProgress: (fraction: number) => void,
): Promise<Blob> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const conversion = await Conversion.init({
    input,
    output,
    audio: { process: (s) => scaleSample(s, gain) },
  });
  if (!conversion.isValid || conversion.discardedTracks.length)
    throw new Error("this browser can't re-encode the video's sound");
  conversion.onProgress = onProgress;
  await conversion.execute();
  return new Blob([output.target.buffer!], { type: "video/mp4" });
}
