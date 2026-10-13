import { useState } from "react";
import { Download, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { isInstalledApp, isIosSafari, useInstallPrompt } from "@/lib/installPrompt";

const DISMISSED_KEY = "n1-install-card-dismissed";

function wasDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
}

/** Invites the client to install the portal as an app. Hidden once installed or dismissed. */
export function InstallAppCard() {
  const { canPrompt, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const ios = isIosSafari();
  if (dismissed || isInstalledApp() || (!canPrompt && !ios)) return null;

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* only a convenience */ }
  }

  return (
    <section className="client-portal-card install-app-card">
      <button type="button" className="icon-button install-app-close" onClick={dismiss} aria-label="Fechar"><X size={16} /></button>
      <span className="install-app-icon" aria-hidden="true"><Smartphone size={20} /></span>
      <div>
        <h2>Tenha o portal como aplicativo</h2>
        {ios ? (
          <p>No Safari, toque em <b><Share size={14} className="install-inline-icon" /> Compartilhar</b> e depois em <b><SquarePlus size={14} className="install-inline-icon" /> Adicionar à Tela de Início</b>. O ícone da N1 aparece junto com seus outros apps.</p>
        ) : (
          <p>Instale para abrir o acompanhamento do seu processo com um toque, direto da tela inicial ou da área de trabalho.</p>
        )}
        {!ios && <button type="button" className="primary-button install-app-button" onClick={() => void install()}><Download size={16} /> Instalar app</button>}
      </div>
    </section>
  );
}
