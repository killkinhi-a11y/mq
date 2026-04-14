/**
 * Shared Audio Engine
 * Provides a single AudioContext, AnalyserNode, and source for the entire app.
 * PlayerBar creates the audio element; FullTrackView and PiPPlayer reuse the analyser.
 * 
 * Includes a CORS fallback: if the analyser returns all zeros (cross-origin audio),
 * a simulated frequency visualization is generated based on playback state.
 */

let _audioCtx: AudioContext | null = null;
let _analyser: AnalyserNode | null = null;
let _source: MediaElementAudioSourceNode | null = null;
let _audio: HTMLAudioElement | null = null;
let _corsBlocked = false;

// Track whether we've already detected CORS blocking
let _zerosCheckCount = 0;
let _lastNonZeroFrame = 0;

export function getAudioElement(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.crossOrigin = "anonymous";
    _audio.preload = "auto";
  }
  return _audio;
}

export function getAnalyser(): AnalyserNode | null {
  return _analyser;
}

export function getAudioContext(): AudioContext | null {
  return _audioCtx;
}

export function isCorsBlocked(): boolean {
  return _corsBlocked;
}

/**
 * Called once by PlayerBar to set up the Web Audio pipeline.
 * idempotent — safe to call multiple times.
 */
export function initAudioEngine(audio: HTMLAudioElement): AnalyserNode | null {
  if (_analyser) return _analyser;

  try {
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    _audioCtx = ctx;
    _analyser = analyser;
    _source = source;
    _audio = audio;

    return analyser;
  } catch {
    return null;
  }
}

export function resumeAudioContext(): void {
  if (_audioCtx?.state === "suspended") {
    _audioCtx.resume().catch(() => {});
  }
}

/**
 * Get frequency data with CORS fallback.
 * If analyser returns all zeros for many frames (CORS blocked),
 * returns simulated data based on time.
 */
export function getFrequencyData(dataArray: Uint8Array): Uint8Array {
  if (!_analyser || !dataArray.length) return dataArray;

  _analyser.getByteFrequencyData(dataArray);

  // Check if we got real data or zeros
  let hasNonZero = false;
  const len = Math.min(dataArray.length, 32); // Check first 32 bins
  for (let i = 0; i < len; i++) {
    if (dataArray[i] > 0) {
      hasNonZero = true;
      break;
    }
  }

  if (hasNonZero) {
    _lastNonZeroFrame = Date.now();
    _zerosCheckCount = 0;
    _corsBlocked = false;
    return dataArray;
  }

  // Accumulate zero frames
  _zerosCheckCount++;

  // After 15 consecutive zero frames (~250ms), assume CORS blocked
  if (_zerosCheckCount > 15) {
    _corsBlocked = true;
  }

  // If recently had non-zero data, don't simulate yet (might be silence)
  if (Date.now() - _lastNonZeroFrame < 1500) {
    return dataArray;
  }

  // Generate simulated visualization data
  const audio = _audio;
  if (!audio || audio.paused || audio.ended) return dataArray;

  const now = Date.now() / 1000;
  const bufLen = dataArray.length;

  for (let i = 0; i < bufLen; i++) {
    const freq = i / bufLen;
    // Create a pleasing frequency curve: bass heavy, treble light
    const bass = Math.max(0, 1 - freq * 3) * (0.5 + 0.5 * Math.sin(now * 4 + i * 0.1));
    const mid = Math.max(0, 1 - Math.abs(freq - 0.3) * 5) * (0.3 + 0.3 * Math.sin(now * 6 + i * 0.2));
    const high = Math.max(0, freq - 0.5) * 2 * (0.2 + 0.2 * Math.sin(now * 8 + i * 0.3));
    // Add some randomness
    const noise = 0.15 * Math.sin(now * 13.7 + i * 1.7);
    const value = Math.max(0, Math.min(255, (bass + mid + high + noise) * 200));
    dataArray[i] = Math.floor(value);
  }

  return dataArray;
}
