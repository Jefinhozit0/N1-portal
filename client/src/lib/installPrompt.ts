import { useEffect, useState } from "react";

/**
 * "Install app" support. Chrome/Edge/Android fire beforeinstallprompt once, often before the
 * client portal is on screen, so it is captured here as soon as the page loads (imported by main.tsx).
 * Safari on iPhone has no such event: the client adds the page from the Share menu instead.
 */

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPromptEvent | null = null;
// Installed during this visit: the page itself stays in the browser tab, so display-mode does not tell.
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

/** Already running as an installed app (home screen / desktop window). */
export function isInstalledApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad in Safari, where the app is added from the Share button. */
export function isIosSafari(ua = navigator.userAgent) {
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
}

export function useInstallPrompt() {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const update = () => setVersion((v) => v + 1);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return {
    canPrompt: deferred !== null,
    installedNow,
    install: async () => {
      if (!deferred) return false;
      const event = deferred;
      deferred = null;
      notify();
      await event.prompt();
      return (await event.userChoice).outcome === "accepted";
    },
  };
}
