import { useState } from 'react'
import SetLibraryScreen from './screens/SetLibraryScreen'
import SetEditorScreen from './screens/SetEditorScreen'
import SettingsScreen from './screens/SettingsScreen'

type Screen = { type: 'library' } | { type: 'editor'; setId: string } | { type: 'settings' }

function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>({ type: 'library' })

  if (screen.type === 'editor') {
    return <SetEditorScreen setId={screen.setId} onBack={() => setScreen({ type: 'library' })} />
  }

  if (screen.type === 'settings') {
    return <SettingsScreen onBack={() => setScreen({ type: 'library' })} />
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>Anasoko 段位道場ジェネレーター</h1>
        <button onClick={() => setScreen({ type: 'settings' })}>⚙ 設定</button>
      </div>
      <SetLibraryScreen onOpenSet={(setId) => setScreen({ type: 'editor', setId })} />
    </div>
  )
}

export default App
