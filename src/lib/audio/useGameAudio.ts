"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MUTE_KEY = "jingling.audio.muted";

/**
 * 用 Web Audio API 合成短音效，不依赖任何资源文件。
 * - playPlace: 落子"哒"声（短促高频）
 * - playWin / playLose: 胜负小段旋律
 * 静音偏好持久化到 localStorage。
 */
export function useGameAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(typeof window !== "undefined" && localStorage.getItem(MUTE_KEY) === "1");
  }, []);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") {
      return null;
    }
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback(
    (
      freq: number,
      duration: number,
      kind: OscillatorType = "triangle",
      delay = 0,
      gain = 0.15,
    ) => {
      if (muted) return;
      const ctx = ensureCtx();
      if (!ctx) return;
      try {
        const t0 = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = kind;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.connect(g).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duration);
      } catch {
        // ignore audio errors silently
      }
    },
    [muted, ensureCtx],
  );

  const playPlace = useCallback(() => {
    playTone(1400, 0.07, "triangle", 0, 0.18);
  }, [playTone]);

  const playWin = useCallback(() => {
    // C5 E5 G5 C6 上行小段
    [523, 659, 784, 1047].forEach((f, i) => {
      playTone(f, 0.22, "triangle", i * 0.12, 0.18);
    });
  }, [playTone]);

  const playLose = useCallback(() => {
    // E5 D5 B4 下行
    [659, 587, 494].forEach((f, i) => {
      playTone(f, 0.3, "sine", i * 0.16, 0.14);
    });
  }, [playTone]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (typeof window !== "undefined") {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  return { muted, playPlace, playWin, playLose, toggleMute };
}
