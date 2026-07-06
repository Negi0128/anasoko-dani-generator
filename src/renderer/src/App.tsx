import { useState } from 'react'
import SetLibraryScreen from './screens/SetLibraryScreen'
import SetEditorScreen from './screens/SetEditorScreen'

type Screen = { type: 'library' } | { type: 'editor'; setId: string }

function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>({ type: 'library' })

  if (screen.type === 'editor') {
    return <SetEditorScreen setId={screen.setId} onBack={() => setScreen({ type: 'library' })} />
  }

  return (
    <div className="app-shell">
      <h1>Anasoko 段位道場ジェネレーター</h1>
      <SetLibraryScreen onOpenSet={(setId) => setScreen({ type: 'editor', setId })} />
    </div>
  )
}

export default App
