import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
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

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>오류가 발생했습니다</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
            페이지를 새로고침하거나 아래 버튼을 눌러주세요.
          </p>
          <button
            className="btn btn-primary"
            onClick={this.handleReset}
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
