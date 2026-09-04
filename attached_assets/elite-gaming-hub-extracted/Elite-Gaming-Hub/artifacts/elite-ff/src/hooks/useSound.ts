import { useCallback } from "react";

function createOscillator(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  duration: number,
  volume: number,
  startTime: number = 0,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
  osc.start(ctx.currentTime + startTime);
  osc.stop(ctx.currentTime + startTime + duration);
}

export function useSound() {
  const playTap = useCallback(() => {
    try {
      const ctx = new AudioContext();
      createOscillator(ctx, 440, "sine", 0.08, 0.05);
    } catch {}
  }, []);

  const playDelete = useCallback(() => {
    try {
      const ctx = new AudioContext();
      createOscillator(ctx, 300, "sawtooth", 0.05, 0.04);
      createOscillator(ctx, 200, "sawtooth", 0.05, 0.03, 0.05);
      createOscillator(ctx, 100, "sawtooth", 0.05, 0.03, 0.1);
    } catch {}
  }, []);

  const playSuccess = useCallback(() => {
    try {
      const ctx = new AudioContext();
      createOscillator(ctx, 523, "sine", 0.1, 0.06);
      createOscillator(ctx, 659, "sine", 0.1, 0.06, 0.1);
      createOscillator(ctx, 784, "sine", 0.15, 0.06, 0.2);
    } catch {}
  }, []);

  const playNavigation = useCallback(() => {
    try {
      const ctx = new AudioContext();
      createOscillator(ctx, 380, "sine", 0.06, 0.04);
    } catch {}
  }, []);

  const playNotification = useCallback(() => {
    try {
      const ctx = new AudioContext();
      createOscillator(ctx, 600, "sine", 0.08, 0.05);
      createOscillator(ctx, 800, "sine", 0.08, 0.05, 0.1);
    } catch {}
  }, []);

  return { playTap, playDelete, playSuccess, playNavigation, playNotification };
}
