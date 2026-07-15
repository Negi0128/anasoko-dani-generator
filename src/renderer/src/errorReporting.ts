/** Unwraps Error.cause chains — the root cause is usually the only part that
 * says what actually went wrong. */
function describeCauseChain(error: unknown): string[] {
  const lines: string[] = []
  let current: unknown = error
  let depth = 0
  while (current instanceof Error && current.cause !== undefined && depth < 5) {
    current = current.cause
    depth++
    const text = current instanceof Error ? `${current.name}: ${current.message}` : String(current)
    lines.push(`原因${depth > 1 ? depth : ''}: ${text}`)
  }
  return lines
}

export function describeError(error: unknown): { message: string; detail: string } {
  if (error instanceof Error) {
    const parts = [...describeCauseChain(error)]
    if (error.stack) parts.push('', error.stack)
    return { message: `${error.name}: ${error.message}`, detail: parts.join('\n') }
  }
  return { message: String(error), detail: '' }
}

/** Surfaces an error to the user via the main process's error dialog, so no
 * failure is left to a console the user never opens. */
export function reportError(context: string, error: unknown): void {
  const { message, detail } = describeError(error)
  console.error(`[${context}]`, error)
  window.api.app.reportError(context, message, detail)
}

/** Catches renderer failures that no local try/catch saw — without these an
 * uncaught render error just leaves a blank window. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    reportError('画面のエラー', event.error ?? event.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportError('未処理のPromiseエラー', event.reason)
  })
}
