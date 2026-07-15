import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../errorReporting'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/** Without this, a render-time throw unmounts the whole tree and leaves the
 * user staring at a blank window with no idea what happened. */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const withComponentStack =
      info.componentStack != null
        ? new Error(error.message, { cause: `${error.stack ?? ''}\n${info.componentStack}` })
        : error
    reportError('画面のエラー', withComponentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="app-shell">
        <h2>エラーが発生しました</h2>
        <p className="error">{this.state.error.message}</p>
        <p>詳細はエラーダイアログを確認してください。</p>
        <button onClick={() => this.setState({ error: null })}>再表示を試す</button>
      </div>
    )
  }
}

export default ErrorBoundary
