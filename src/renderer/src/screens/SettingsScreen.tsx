import { useEffect, useState } from 'react'
import type { AppSettings } from '../../../shared/types/settings'
import { SHORT_ROLL_COMP_LABELS, type ShortRollComp } from '../../../shared/types/rollSpeed'

interface SettingsScreenProps {
  onBack: () => void
}

function SettingsScreen({ onBack }: SettingsScreenProps): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
  }, [])

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> => {
    const updated = await window.api.settings.update({ [key]: value })
    setSettings(updated)
  }

  const handlePickSongFolder = async (): Promise<void> => {
    const folder = await window.api.dialogs.pickFolder('デフォルトの楽曲フォルダを選択')
    if (folder) updateSetting('defaultSongFolder', folder)
  }

  const handlePickDaniFolder = async (): Promise<void> => {
    const folder = await window.api.dialogs.pickFolder('デフォルトの段位(Dani)フォルダを選択')
    if (folder) updateSetting('defaultDaniFolder', folder)
  }

  return (
    <div className="settings-screen">
      <div className="rank-editor-topbar">
        <button onClick={onBack}>← 段位道場一覧</button>
      </div>

      <h2>設定</h2>

      {!settings ? (
        <p>読み込み中...</p>
      ) : (
        <div className="settings-form">
          <label className="settings-row">
            <input
              type="checkbox"
              checked={settings.audioPreviewEnabled}
              onChange={(e) => updateSetting('audioPreviewEnabled', e.target.checked)}
            />
            音源プレビューを有効にする
          </label>

          <label className="settings-row">
            出力形式の初期値
            <select
              value={settings.defaultExportFormat}
              onChange={(e) =>
                updateSetting('defaultExportFormat', e.target.value as AppSettings['defaultExportFormat'])
              }
            >
              <option value="folder">フォルダ</option>
              <option value="zip">ZIP</option>
            </select>
          </label>

          <label className="settings-row">
            デフォルトの楽曲フォルダ
            <span className="settings-folder-value">{settings.defaultSongFolder ?? '(未設定)'}</span>
            <button onClick={handlePickSongFolder}>参照</button>
          </label>

          <label className="settings-row">
            デフォルトの段位(Dani)フォルダ
            <span className="settings-folder-value">{settings.defaultDaniFolder ?? '(未設定)'}</span>
            <button onClick={handlePickDaniFolder}>参照</button>
          </label>

          <label className="settings-row">
            連打速度(1秒あたりの打数)
            <input
              type="number"
              min={1}
              max={100}
              value={settings.rollSpeed}
              onChange={(e) => updateSetting('rollSpeed', Number(e.target.value))}
            />
          </label>

          <label className="settings-row">
            短い連打の補正方式
            <select
              value={settings.shortRollComp}
              onChange={(e) => updateSetting('shortRollComp', e.target.value as ShortRollComp)}
            >
              {Object.entries(SHORT_ROLL_COMP_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

export default SettingsScreen
