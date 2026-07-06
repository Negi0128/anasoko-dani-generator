import { useEffect, useState } from 'react'
import type { Song } from '../../../shared/types/song'

interface SongPickerModalProps {
  onSelect: (song: Song) => void
  onClose: () => void
}

function SongPickerModal({ onSelect, onClose }: SongPickerModalProps): JSX.Element {
  const [songs, setSongs] = useState<Song[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.songLibrary.list().then(setSongs)
  }, [])

  const handleImportNew = async (): Promise<void> => {
    setError(null)
    setBusy(true)
    try {
      const tjaPath = await window.api.dialogs.pickTjaFile()
      if (!tjaPath) return
      const song = await window.api.songLibrary.importFiles(tjaPath)
      onSelect(song)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const filtered = songs.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>曲を選択</h3>
        <button onClick={handleImportNew} disabled={busy}>
          + 新しい曲をインポート(.tjaを選ぶだけでOK)
        </button>
        {error && <p className="error">{error}</p>}
        <input
          type="text"
          placeholder="曲名で絞り込み"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="song-picker-list">
          {filtered.map((song) => (
            <li key={song.id}>
              <button onClick={() => onSelect(song)}>
                {song.title}
                {song.bpm ? ` (BPM ${song.bpm})` : ''}
              </button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <p>登録済みの曲がありません。新規インポートしてください。</p>}
        <button onClick={onClose}>閉じる</button>
      </div>
    </div>
  )
}

export default SongPickerModal
