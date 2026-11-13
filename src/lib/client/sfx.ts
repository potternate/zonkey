const STORAGE_KEY = "zonkey-sound";

type Sfx = "tick" | "match" | "miss";

let context: AudioContext | null = null;
let chosen: boolean | null = null;

export function soundEnabled(): boolean {
  if (chosen !== null) return chosen;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  chosen = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {}
  if (on) unlockAudio();
}

/** Must run inside a user gesture at least once, or browsers keep audio suspended. */
export function unlockAudio() {
  if (typeof window === "undefined" || !soundEnabled()) return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  context ??= new Ctor();
  if (context.state === "suspended") void context.resume();
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, volume = 0.04) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  const at = ctx.currentTime + start;
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + duration);
}

export function playSfx(name: Sfx) {
  if (!context || context.state !== "running" || !soundEnabled()) return;
  if (name === "tick") tone(context, 900 + Math.random() * 500, 0, 0.03, 0.015);
  if (name === "match") [523, 659, 784, 1047].forEach((f, i) => tone(context!, f, i * 0.08, 0.14));
  if (name === "miss") [392, 311].forEach((f, i) => tone(context!, f, i * 0.12, 0.16, 0.035));
}

function iosTap(times: number) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  label.style.display = "none";
  document.body.appendChild(label);
  for (let i = 0; i < times; i++) setTimeout(() => label.click(), i * 110);
  setTimeout(() => label.remove(), times * 110 + 50);
}

export function haptic(kind: "light" | "success") {
  if (typeof navigator === "undefined" || !soundEnabled()) return;
  if (typeof navigator.vibrate === "function") navigator.vibrate(kind === "success" ? [25, 50, 25] : 15);
  else iosTap(kind === "success" ? 2 : 1);
}
