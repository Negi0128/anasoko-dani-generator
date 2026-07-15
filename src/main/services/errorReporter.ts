import { dialog } from 'electron'

/** Unwraps `Error.cause` chains into readable lines, since the root cause is
 * usually the only part that says what actually went wrong. */
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

/** Shows the error to the user instead of letting it either crash the app with
 * Electron's default dialog or vanish into the console. */
export function reportError(context: string, error: unknown): void {
  const { message, detail } = describeError(error)
  console.error(`[${context}]`, error)
  dialog.showErrorBox(`エラー: ${context}`, detail ? `${message}\n\n${detail}` : message)
}

/** Catches what would otherwise be an unhandled crash in the main process. */
export function installGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    reportError('予期しないエラー', error)
  })
  process.on('unhandledRejection', (reason) => {
    reportError('未処理のPromiseエラー', reason)
  })
}
