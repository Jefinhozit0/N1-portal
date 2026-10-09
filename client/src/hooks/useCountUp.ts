import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Animates a number from its previous value to `target` (from 0 on the first load).
 * The last frame is always exactly `target`, so the formatted text ends identical to the
 * static value. With "reduzir movimento" (or no browser) it returns `target` right away.
 */
export function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  // What is on screen right now, so a change in the middle of an animation continues from there.
  const shown = useRef(value);

  useEffect(() => {
    const from = shown.current;
    if (from === target || !Number.isFinite(target) || prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      shown.current = target;
      setValue(target);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = progress === 1 ? target : from + (target - from) * eased;
      shown.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
