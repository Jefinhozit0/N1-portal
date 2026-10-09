/**
 * Small helpers for the portal's motion. Animations are CSS-first (see the "Motion" section of
 * index.css); these cover the few cases CSS cannot trigger on its own.
 */

/** True when the visitor asked the system to reduce motion (or the browser cannot tell us). */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Replays a short fade/slide on elements that stay mounted but change content
 * (e.g. the login card switching between "entrar", "criar login" and "redefinir senha").
 * Uses the Web Animations API, so nothing is remounted and focus is untouched.
 */
export function playEnter(elements: Iterable<Element>, { distance = 6, duration = 240, stagger = 30 } = {}) {
  if (prefersReducedMotion()) return;
  let index = 0;
  for (const element of Array.from(elements)) {
    if (typeof (element as HTMLElement).animate !== "function") return;
    (element as HTMLElement).animate(
      [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: "none" }],
      { duration, delay: index * stagger, easing: "cubic-bezier(.2, .7, .2, 1)", fill: "backwards" },
    );
    index += 1;
  }
}
