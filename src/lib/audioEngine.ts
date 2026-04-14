/**
 * Shared Audio Engine
 * Provides a single AudioContext, AnalyserNode, and source for the entire app.
 * PlayerBar creates the audio element; FullTrackView and PiPPlayer reuse the analyser.
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
