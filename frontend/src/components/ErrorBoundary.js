import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console and potentially to a logging service
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="error-boundary-container">
          <div className="error-card">
            <h2>Something went wrong</h2>
            <p>We apologize for the inconvenience. Please try refreshing the page.</p>
            {process.env.NODE_ENV !== 'production' && (
              <details style={{ whiteSpace: 'pre-wrap' }}>
                <summary>Error details (developers only)</summary>
                <p>{this.state.error && this.state.error.toString()}</p>
                <p>Component Stack:</p>
                <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
              </details>
            )}
            <button 
              className="error-reset-button"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary; 