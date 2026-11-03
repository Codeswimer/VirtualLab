import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Title shown in the fallback. */
  title?: string;
  /** Optional custom fallback renderer. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[vlab] render error', error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-center">
        <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h2 className="text-sm font-semibold text-ink-900">
          {this.props.title ?? 'This apparatus could not start'}
        </h2>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-600">
          Your saved readings are safe. Try reloading the apparatus; if it keeps failing, submit what
          you have or choose another practical.
        </p>
        <button type="button" className="btn-secondary btn-sm mt-3" onClick={this.reset}>
          <RotateCcw className="h-3.5 w-3.5" /> Reload apparatus
        </button>
        <p className="mt-2 font-mono text-[9px] text-ink-400">{error.message}</p>
      </div>
    );
  }
}
