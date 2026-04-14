/**
 * Shared Audio Engine
 * Provides a single AudioContext, AnalyserNode, and source for the entire app.
 * PlayerBar creates the audio element; FullTrackView and PiPPlayer reuse the analyser.
 *
 * Since SoundCloud streams never include CORS headers, the AnalyserNode always
 * returns zeros. We use a simulated frequency visualization that responds to
 * playback state and provides a pleasing visual effect.
 */

let _audioCtx: AudioContext | null = null;
let _analyser: AnalyserNode | null = null;
let _source: MediaElementAudioSourceNode | null = null;
let _audio: HTMLAudioElement | null = null;

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

export function getAudioElementRef(): HTMLAudioElement | null {
  return _audio;
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
 * Get frequency data — always uses simulation since CORS blocks real data.
 * Generates a dynamic, music-like visualization that responds to playback.
 */
export function getFrequencyData(dataArray: Uint8Array): Uint8Array {
  if (!dataArray.length) return dataArray;

  const audio = _audio;
  if (!audio || audio.paused || audio.ended) {
    // Fade out when paused
    for (let i = 0; i < dataArray.length; i++) {
      dataArray[i] = Math.floor(dataArray[i] * 0.85);
    }
    return dataArray;
  }

  const now = performance.now() / 1000;
  const bufLen = dataArray.length;
  const progress = audio.duration > 0 ? audio.currentTime / audio.duration : 0;

  // Use audio currentTime for phase variation so it looks different per track position
  const t = now + audio.currentTime * 0.3;

  for (let i = 0; i < bufLen; i++) {
    const freq = i / bufLen;

    // Bass frequencies (0-0.15): strong, pulsing
    const bassEnvelope = Math.max(0, 1 - freq * 7);
    const bassPulse = 0.6 + 0.4 * Math.sin(t * 3.5 + Math.floor(t * 2.2) * 1.7);
    const bass = bassEnvelope * bassPulse;

    // Low-mid (0.1-0.35): medium presence
    const lowMidEnv = Math.max(0, Math.min(1, (freq - 0.1) * 5)) * Math.max(0, 1 - (freq - 0.15) * 4);
    const lowMid = lowMidEnv * (0.4 + 0.3 * Math.sin(t * 5.3 + i * 0.15));

    // High-mid (0.3-0.6): moderate, varied
    const highMidEnv = Math.max(0, Math.min(1, (freq - 0.3) * 4)) * Math.max(0, 1 - (freq - 0.4) * 5);
    const highMid = highMidEnv * (0.3 + 0.25 * Math.sin(t * 7.1 + i * 0.25));

    // Treble (0.6-1.0): subtle shimmer
    const trebleEnv = Math.max(0, freq - 0.6) * 2.5;
    const treble = trebleEnv * (0.15 + 0.15 * Math.sin(t * 11.3 + i * 0.4));

    // Combine all bands
    const combined = bass + lowMid + highMid + treble;

    // Add subtle noise for organic feel
    const noise = 0.06 * Math.sin(t * 17.3 + i * 2.1) + 0.04 * Math.sin(t * 23.7 + i * 3.3);

    // Occasional "beat drops" — random peaks
    const beatPhase = (t * 2.2) % 1;
    const beat = beatPhase < 0.08 ? (1 - beatPhase / 0.08) * 0.3 * bassEnvelope : 0;

    const value = Math.max(0, Math.min(255, (combined + noise + beat) * 220));
    dataArray[i] = Math.floor(value);
  }

  return dataArray;
}
