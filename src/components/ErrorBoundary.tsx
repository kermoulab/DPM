import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold mb-2">Une erreur temporaire est survenue</h2>
          <p className="text-slate-400 text-xs max-w-md mb-6 leading-relaxed">
            L'application a rencontré un problème inattendu mais votre session et vos données sont protégées.
          </p>
          {this.state.error && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-red-400 font-mono max-w-lg mb-6 text-left overflow-auto max-h-32 w-full">
              {this.state.error.message}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Actualiser la page</span>
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <Home size={14} />
              <span>Retour à l'accueil</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

