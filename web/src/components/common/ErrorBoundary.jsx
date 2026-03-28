import React, { Component } from 'react';

/**
 * Error Boundary component that catches JavaScript errors in child components
 * and displays a fallback UI instead of crashing the whole app
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Store error info for display
    this.setState({ errorInfo });

    // In production, you might want to log to an error reporting service
    // logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <div className="error-boundary__icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="error-boundary__title">Something went wrong</h2>
            <p className="error-boundary__message">
              We're sorry, but something unexpected happened. Please try again.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-boundary__details">
                <summary>Error details</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}
            <div className="error-boundary__actions">
              <button
                onClick={this.handleRetry}
                className="error-boundary__button error-boundary__button--primary"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="error-boundary__button error-boundary__button--secondary"
              >
                Go Home
              </button>
            </div>
          </div>

          <style>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              padding: 2rem;
            }
            .error-boundary__content {
              text-align: center;
              max-width: 500px;
            }
            .error-boundary__icon {
              width: 64px;
              height: 64px;
              margin: 0 auto 1.5rem;
              color: var(--icon-danger);
            }
            .error-boundary__icon svg {
              width: 100%;
              height: 100%;
            }
            .error-boundary__title {
              font-size: 1.5rem;
              font-weight: 600;
              color: var(--text-primary);
              margin: 0 0 0.5rem;
            }
            .error-boundary__message {
              color: var(--text-tertiary);
              margin: 0 0 1.5rem;
            }
            .error-boundary__details {
              text-align: left;
              background: var(--surface-secondary);
              border: 1px solid var(--border-primary);
              border-radius: 8px;
              padding: 1rem;
              margin-bottom: 1.5rem;
            }
            .error-boundary__details summary {
              cursor: pointer;
              font-weight: 500;
              margin-bottom: 0.5rem;
            }
            .error-boundary__details pre {
              font-size: 0.75rem;
              overflow-x: auto;
              white-space: pre-wrap;
              word-wrap: break-word;
              margin: 0;
              color: var(--text-danger);
            }
            .error-boundary__actions {
              display: flex;
              gap: 1rem;
              justify-content: center;
            }
            .error-boundary__button {
              padding: 0.75rem 1.5rem;
              border-radius: 8px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
            }
            .error-boundary__button--primary {
              background: var(--interactive-success);
              color: var(--text-on-success);
              border: none;
            }
            .error-boundary__button--primary:hover {
              background: var(--interactive-success-hover);
            }
            .error-boundary__button--secondary {
              background: var(--surface-secondary);
              color: var(--text-primary);
              border: 1px solid var(--border-primary);
            }
            .error-boundary__button--secondary:hover {
              background: var(--surface-tertiary);
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
