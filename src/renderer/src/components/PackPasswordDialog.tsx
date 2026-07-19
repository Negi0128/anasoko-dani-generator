import { useState } from 'react'

interface PackPasswordDialogProps {
  onConfirm: (password: string) => void
  onCancel: () => void
  error?: string | null
}

/** Password gate for the pack maker screen. Mirrors PromptDialog's look but masks input. */
function PackPasswordDialog({ onConfirm, onCancel, error }: PackPasswordDialogProps): JSX.Element {
  const [value, setValue] = useState('')

  const submit = (): void => {
    if (value) onConfirm(value)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>解禁パック作成のパスワード</h3>
        <p>身内配布用のツールです。パスワードを入力してください。</p>
        <input
          type="password"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
        />
        {error && <p className="error">{error}</p>}
        <div className="confirm-dialog-actions">
          <button onClick={onCancel}>キャンセル</button>
          <button className="primary-button" onClick={submit} disabled={!value}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

export default PackPasswordDialog
