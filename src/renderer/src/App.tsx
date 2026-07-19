import { useState } from 'react'
import SetLibraryScreen from './screens/SetLibraryScreen'
import SetEditorScreen from './screens/SetEditorScreen'
import SettingsScreen from './screens/SettingsScreen'
import PackPasswordDialog from './components/PackPasswordDialog'
import PackMakerModal from './components/PackMakerModal'
import { PACK_MAKER_PASSWORD } from './packMakerPassword'

type Screen = { type: 'library' } | { type: 'editor'; setId: string } | { type: 'settings' }

function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>({ type: 'library' })
  const [packMakerUnlocked, setPackMakerUnlocked] = useState(false)
  const [showPackPassword, setShowPackPassword] = useState(false)
  const [packPasswordError, setPackPasswordError] = useState<string | null>(null)
  const [showPackMaker, setShowPackMaker] = useState(false)

  const handleOpenPackMaker = (): void => {
    setPackPasswordError(null)
    if (packMakerUnlocked) {
      setShowPackMaker(true)
    } else {
      setShowPackPassword(true)
    }
  }

  const handlePackPasswordConfirm = (password: string): void => {
    if (password === PACK_MAKER_PASSWORD) {
      setPackMakerUnlocked(true)
      setShowPackPassword(false)
      setShowPackMaker(true)
    } else {
      setPackPasswordError('パスワードが違います')
    }
  }

  const packMakerOverlays = (
    <>
      {showPackPassword && (
        <PackPasswordDialog
          onConfirm={handlePackPasswordConfirm}
          onCancel={() => setShowPackPassword(false)}
          error={packPasswordError}
        />
      )}
      {showPackMaker && <PackMakerModal onClose={() => setShowPackMaker(false)} />}
    </>
  )

  if (screen.type === 'editor') {
    return (
      <>
        <SetEditorScreen setId={screen.setId} onBack={() => setScreen({ type: 'library' })} />
        {packMakerOverlays}
      </>
    )
  }

  if (screen.type === 'settings') {
    return (
      <>
        <SettingsScreen onBack={() => setScreen({ type: 'library' })} />
        {packMakerOverlays}
      </>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>Anasoko 段位道場ジェネレーター</h1>
        <div className="app-header-actions">
          <button onClick={handleOpenPackMaker}>楽曲解禁パックを作成</button>
          <button onClick={() => setScreen({ type: 'settings' })}>⚙ 設定</button>
        </div>
      </div>
      <SetLibraryScreen onOpenSet={(setId) => setScreen({ type: 'editor', setId })} />
      {packMakerOverlays}
    </div>
  )
}

export default App
