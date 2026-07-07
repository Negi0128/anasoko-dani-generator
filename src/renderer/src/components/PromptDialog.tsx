import { useState } from 'react'

interface PromptDialogProps {
  title: string
  message?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

/** Electron does not implement window.prompt(), so text-input dialogs need
 * their own modal instead of relying on it. */
function PromptDialog({
  title,
  message,
  defaultValue = '',
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  onConfirm,
  onCancel
}: PromptDialogProps): JSX.Element {
  const [value, setValue] = useState(defaultValue)
  const trimmed = value.trim()

  const submit = (): void => {
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{title}</h3>
        {message && <p>{message}</p>}
        <input
          type="text"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
        />
        <div className="confirm-dialog-actions">
          <button onClick={onCancel}>{cancelLabel}</button>
          <button className="primary-button" onClick={submit} disabled={!trimmed}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PromptDialog
