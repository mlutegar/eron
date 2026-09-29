import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

// Captura erros de render da UI e mostra um fallback em vez de tela branca.
// No go-live, encaminhar para Sentry no componentDidCatch.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // TODO(go-live): Sentry.captureException(error, { extra: info })
    console.error("UI error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <div className="font-display text-xl text-danger">Algo deu errado na interface</div>
          <p className="mt-2 max-w-md text-sm text-fg-muted">{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg border border-line px-4 py-2 text-sm text-fg-muted hover:text-fg"
          >
            Recarregar pagina
          </button>
        </div>
      </div>
    );
  }
}
