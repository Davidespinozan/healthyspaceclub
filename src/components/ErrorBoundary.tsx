import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          color: '#1e3330',
          background: '#F6F2EA',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Algo salió mal</h2>
          <p style={{ fontSize: '13px', color: 'rgba(30,51,48,0.6)', margin: 0, maxWidth: '280px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'Error inesperado'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '12px 28px',
              background: '#1e3330',
              color: '#BFA065',
              border: 'none',
              borderRadius: '50px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Recargar app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
