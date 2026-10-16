import { useEffect, useRef, useState } from "react";
import { isInstalledApp } from "@/lib/installPrompt";
import { currentPushState, pushSupported, subscribeToPush, type PushState, type SubscriptionPayload } from "@/lib/pushNotifications";

type Save = (device: SubscriptionPayload & { instalado: boolean }) => Promise<unknown>;

/**
 * App notifications on this device, for the client portal and for the team area alike: the state
 * (null while it is being read), and enable() for the button. `publicKey` and `save` are the
 * chaveNotificacoes / ativarNotificacoes routes of each side.
 */
export function usePushDevice(publicKey: string | undefined, save: Save) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synced = useRef(false);

  useEffect(() => { void currentPushState().then(setState); }, []);

  // Notices already on: send the device again once per visit, so the server keeps it even if its
  // copy was lost (or the keys changed and the browser had to subscribe anew).
  useEffect(() => {
    if (state !== "on" || synced.current || !publicKey) return;
    synced.current = true;
    void subscribeToPush(publicKey)
      .then((subscription) => subscription && save({ ...subscription, instalado: isInstalledApp() }))
      .catch(() => undefined);
  }, [state, publicKey]);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      const subscription = await subscribeToPush(publicKey);
      if (!subscription) {
        setState(await currentPushState());
        return;
      }
      await save({ ...subscription, instalado: isInstalledApp() });
      setState("on");
    } catch (failure) {
      // The browser's own errors come in English; the server's (tRPC) are already in Portuguese.
      const message = failure instanceof Error && failure.name === "TRPCClientError" ? failure.message : null;
      setError(message ?? "Não foi possível ativar as notificações agora. Tente novamente em alguns minutos.");
    } finally {
      setBusy(false);
    }
  }

  return { state, busy, error, enable, supported: pushSupported() };
}
