let muted = false;
let context: AudioContext | null = null;
let installed = false;

export function setAlertsMuted(value: boolean) {
  muted = value;
}

export function installAudioUnlock() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const unlock = () => {
    const ctx = audioContext();
    if (ctx?.state === "suspended") void ctx.resume();
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
}

export function playAlert(kind: "immediate" | "clear") {
  if (muted) return;
  const ctx = audioContext();
  if (!ctx || ctx.state === "suspended") return;
  const start = ctx.currentTime + 0.02;
  if (kind === "immediate") {
    tone(ctx, 880, start, 0.16, "square", 0.07);
    tone(ctx, 660, start + 0.2, 0.22, "square", 0.07);
    return;
  }
  tone(ctx, 523, start, 0.14, "sine", 0.05);
  tone(ctx, 784, start + 0.16, 0.2, "sine", 0.045);
}

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctx = window.AudioContext;
  if (!Ctx) return null;
  context = new Ctx();
  return context;
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}
