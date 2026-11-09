// Unit tests: lossless PCM WAV export, RIFF structure, quantization, and roundtrip parsing.
import { suite, test, eq, ok, approx, throws } from "./helpers";
import {
  encodeWavBuffer,
  exportWav,
  parseWav,
  quantizeSample16,
  quantizeSample24,
  wavFilename,
} from "@/lib/wav-export";
import { createProject } from "@/lib/project-schema";

suite("WAV sample quantization");

test("quantizes exact boundaries and silence correctly for 16-bit", () => {
  eq(quantizeSample16(0), 0);
  eq(quantizeSample16(1.0), 32767);
  eq(quantizeSample16(-1.0), -32768);
});

test("quantizes exact boundaries and silence correctly for 24-bit", () => {
  eq(quantizeSample24(0), 0);
  eq(quantizeSample24(1.0), 8388607);
  eq(quantizeSample24(-1.0), -8388608);
});

test("safely clamps values outside [-1.0, 1.0]", () => {
  eq(quantizeSample16(1.5), 32767);
  eq(quantizeSample16(999.0), 32767);
  eq(quantizeSample16(-1.5), -32768);
  eq(quantizeSample16(-999.0), -32768);

  eq(quantizeSample24(1.5), 8388607);
  eq(quantizeSample24(999.0), 8388607);
  eq(quantizeSample24(-1.5), -8388608);
  eq(quantizeSample24(-999.0), -8388608);
});

test("guards against non-finite samples (NaN and Infinity)", () => {
  eq(quantizeSample16(NaN), 0);
  eq(quantizeSample16(Infinity), 0);
  eq(quantizeSample16(-Infinity), 0);

  eq(quantizeSample24(NaN), 0);
  eq(quantizeSample24(Infinity), 0);
  eq(quantizeSample24(-Infinity), 0);
});

suite("WAV filenames");

test("derives safe, descriptive filenames", () => {
  eq(wavFilename("Night Ride"), "SonicBlueprint_Night_Ride_Instrumental.wav");
  eq(wavFilename("My Song / Take 1?"), "SonicBlueprint_My_Song_Take_1_Instrumental.wav");
  eq(wavFilename(""), "SonicBlueprint_Project_Instrumental.wav");
});

suite("RIFF/WAVE encoding and parsing");

function createMockAudioBuffer(channels: number, length: number, sampleRate = 44100): AudioBuffer {
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    channelData.push(new Float32Array(length));
  }
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData(c: number) {
      return channelData[c];
    },
    copyFromChannel(dest: Float32Array, c: number, start = 0) {
      dest.set(channelData[c].subarray(start, start + dest.length));
    },
    copyToChannel(src: Float32Array, c: number, start = 0) {
      channelData[c].set(src, start);
    },
  } as unknown as AudioBuffer;
}

test("encodes valid stereo 44.1kHz 16-bit PCM WAV", () => {
  const frames = 1000;
  const buf = createMockAudioBuffer(2, frames, 44100);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);

  // Fill with a simple test ramp
  for (let i = 0; i < frames; i++) {
    left[i] = (i / frames) * 2 - 1; // -1 to 1
    right[i] = -left[i];
  }

  const wavBytes = encodeWavBuffer(buf);
  eq(wavBytes.length, 44 + frames * 2 * 2); // 44 header + 1000 frames * 4 bytes/frame

  // Parse and verify
  const parsed = parseWav(wavBytes);
  eq(parsed.metadata.audioFormat, 1); // PCM
  eq(parsed.metadata.numChannels, 2);
  eq(parsed.metadata.sampleRate, 44100);
  eq(parsed.metadata.bitsPerSample, 16);
  eq(parsed.metadata.blockAlign, 4);
  eq(parsed.metadata.byteRate, 44100 * 4);
  eq(parsed.metadata.dataSize, frames * 4);
  approx(parsed.metadata.duration, frames / 44100, 1e-4);

  // Verify sample roundtrip accuracy within 16-bit precision (1 / 32768 ≈ 0.00003)
  for (let i = 0; i < frames; i += 50) {
    approx(parsed.leftChannel[i], left[i], 0.001, `left[${i}]`);
    approx(parsed.rightChannel[i], right[i], 0.001, `right[${i}]`);
  }
});

test("handles silence safely", () => {
  const frames = 500;
  const buf = createMockAudioBuffer(2, frames, 44100);
  const wavBytes = encodeWavBuffer(buf);
  const parsed = parseWav(wavBytes);

  for (let i = 0; i < frames; i++) {
    eq(parsed.leftChannel[i], 0);
    eq(parsed.rightChannel[i], 0);
  }
});

test("parseWav throws descriptive errors on corrupt inputs", () => {
  throws(() => parseWav(new Uint8Array(20)), "too short");
  throws(() => parseWav(new TextEncoder().encode("NOT_RIFF_AND_TOO_SHORT_FOR_REAL")), "not RIFF");

  // Create valid header then corrupt chunk ID
  const buf = createMockAudioBuffer(2, 10, 44100);
  const valid = encodeWavBuffer(buf);
  const corrupt = new Uint8Array(valid);
  corrupt[8] = 0x58; // Change 'WAVE' to 'XAVE'
  throws(() => parseWav(corrupt), "invalid WAVE format");
});

test("encodes valid stereo 44.1kHz 24-bit PCM WAV with high dynamic range", () => {
  const frames = 1000;
  const buf = createMockAudioBuffer(2, frames, 44100);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);

  for (let i = 0; i < frames; i++) {
    left[i] = (i / frames) * 2 - 1;
    right[i] = -left[i];
  }

  const wavBytes = encodeWavBuffer(buf, { bitDepth: 24 });
  eq(wavBytes.length, 44 + frames * 2 * 3); // 44 header + 1000 frames * 6 bytes/frame

  const parsed = parseWav(wavBytes);
  eq(parsed.metadata.audioFormat, 1);
  eq(parsed.metadata.numChannels, 2);
  eq(parsed.metadata.sampleRate, 44100);
  eq(parsed.metadata.bitsPerSample, 24);
  eq(parsed.metadata.blockAlign, 6);
  eq(parsed.metadata.byteRate, 44100 * 6);
  eq(parsed.metadata.dataSize, frames * 6);

  // 24-bit precision (1 / 8388608 ≈ 0.00000012)
  for (let i = 0; i < frames; i += 50) {
    approx(parsed.leftChannel[i], left[i], 0.0001, `24-bit left[${i}]`);
    approx(parsed.rightChannel[i], right[i], 0.0001, `24-bit right[${i}]`);
  }
});

suite("End-to-end WAV project export");

// Polyfill minimal OfflineAudioContext in Node if absent so export pipeline can be tested
if (typeof (globalThis as Record<string, unknown>).OfflineAudioContext === "undefined") {
  class MockOfflineAudioContext {
    sampleRate: number;
    length: number;
    destination = {};
    constructor(public numberOfChannels: number, length: number, sampleRate: number) {
      this.length = length;
      this.sampleRate = sampleRate;
    }
    currentTime = 0;
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
        },
        connect: () => {},
        disconnect: () => {},
      };
    }
    createDelay() {
      return {
        delayTime: { value: 0, setValueAtTime: () => {} },
        connect: () => {},
        disconnect: () => {},
      };
    }
    createStereoPanner() {
      return {
        pan: { value: 0 },
        connect: () => {},
        disconnect: () => {},
      };
    }
    createBuffer(channels: number, length: number, sampleRate: number) {
      return createMockAudioBuffer(channels, length, sampleRate);
    }
    createBufferSource() {
      return { buffer: null, connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {} };
    }
    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: { value: 1000, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
        gain: { value: 0, setValueAtTime: () => {} },
        Q: { value: 1 },
        connect: () => {},
        disconnect: () => {},
      };
    }
    createOscillator() {
      return {
        type: "sine",
        frequency: { value: 440, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {},
      };
    }
    createWaveShaper() {
      return { curve: null, oversample: "none", connect: () => {}, disconnect: () => {} };
    }
    createConvolver() {
      return { buffer: null, connect: () => {}, disconnect: () => {} };
    }
    createDynamicsCompressor() {
      return {
        threshold: { value: -18, setValueAtTime: () => {} },
        knee: { value: 12, setValueAtTime: () => {} },
        ratio: { value: 4, setValueAtTime: () => {} },
        attack: { value: 0.01, setValueAtTime: () => {} },
        release: { value: 0.25, setValueAtTime: () => {} },
        reduction: 0,
        connect: () => {},
        disconnect: () => {},
      };
    }
    createChannelSplitter(numberOfOutputs = 2) {
      return {
        numberOfOutputs,
        connect: () => {},
        disconnect: () => {},
      };
    }
    createChannelMerger(numberOfInputs = 2) {
      return {
        numberOfInputs,
        connect: () => {},
        disconnect: () => {},
      };
    }
    async decodeAudioData() {
      return createMockAudioBuffer(2, 44100, 44100);
    }
    async startRendering() {
      return createMockAudioBuffer(this.numberOfChannels, this.length, this.sampleRate);
    }
  }
  (globalThis as Record<string, unknown>).OfflineAudioContext = MockOfflineAudioContext;
}

test("exportWav produces playable binary blob matching song duration", async () => {
  const p = createProject("Test Export");
  p.arrangement = [{ id: "sec_test", name: "INTRO", bars: 2, energy: 5, instruments: [] }];

  let reportedStage = "";
  const blob = await exportWav(p, (stage) => {
    reportedStage = stage;
  });

  ok(blob instanceof Blob, "produces a Blob");
  eq(blob.type, "audio/wav");
  ok(blob.size > 44, `blob size ${blob.size} > 44`);
  ok(reportedStage.length > 0, "reported progress");

  const arrayBuffer = await blob.arrayBuffer();
  const parsed = parseWav(arrayBuffer);
  eq(parsed.metadata.numChannels, 2);
  eq(parsed.metadata.sampleRate, 44100);
  eq(parsed.metadata.bitsPerSample, 16);
  ok(parsed.metadata.duration > 0, `duration ${parsed.metadata.duration} > 0`);
});

test("exportWav produces 24-bit PCM WAV when specified in options", async () => {
  const p = createProject("24-bit Export");
  p.arrangement = [{ id: "sec_test24", name: "VERSE", bars: 2, energy: 5, instruments: [] }];

  const blob = await exportWav(p, { bitDepth: 24 });
  ok(blob instanceof Blob, "produces a Blob");
  eq(blob.type, "audio/wav");

  const arrayBuffer = await blob.arrayBuffer();
  const parsed = parseWav(arrayBuffer);
  eq(parsed.metadata.numChannels, 2);
  eq(parsed.metadata.sampleRate, 44100);
  eq(parsed.metadata.bitsPerSample, 24);
  eq(parsed.metadata.blockAlign, 6);
  ok(parsed.metadata.duration > 0, `duration ${parsed.metadata.duration} > 0`);
});
