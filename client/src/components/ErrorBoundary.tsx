import { cn } from "@/lib/utils";
import { isStaleVersionError, reloadForNewVersion } from "@/lib/staleVersion";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** The portal was updated while this tab was open. */
  newVersion: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, newVersion: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, newVersion: isStaleVersionError(error) };
  }

  componentDidCatch(error: Error) {
    // Usually fixed by loading the new version; the screen below only stays if that already failed.
    if (isStaleVersionError(error)) reloadForNewVersion();
  }

  render() {
    if (this.state.hasError) {
      const { newVersion } = this.state;
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-2">{newVersion ? "O portal foi atualizado" : "Algo deu errado"}</h2>
            <p className="text-sm text-muted-foreground mb-6 text-center">
              {newVersion
                ? "Esta aba ainda estava com a versão anterior. Recarregue a página para continuar."
                : "Recarregue a página. Se o erro continuar, envie o texto abaixo para o suporte."}
            </p>

            {!newVersion && (
              <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
                <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error?.stack}
                </pre>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
