import { Home } from "lucide-react";
import { useLocation } from "wouter";
import { N1Logo } from "@/components/N1Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <main className="client-portal-center">
      <ThemeToggle className="login-theme-toggle" />
      <div className="login-panel-inner">
        <N1Logo size="md" />

        <span className="not-found-code" aria-hidden="true">404</span>

        <h2>Page Not Found</h2>

        <p className="login-subtitle">
          Sorry, the page you are looking for doesn't exist.
          <br />
          It may have been moved or deleted.
        </p>

        <div id="not-found-button-group" className="not-found-actions">
          <button type="button" onClick={handleGoHome} className="primary-button login-button">
            Go Home
            <Home size={18} />
          </button>
        </div>
      </div>
    </main>
  );
}
