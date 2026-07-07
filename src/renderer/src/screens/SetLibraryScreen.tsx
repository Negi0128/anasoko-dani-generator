import { useCallback, useEffect, useState } from 'react'
import type { DaniSetSummary } from '../../../shared/types/daniSet'
import type { ValidationReport } from '../../../shared/types/validationReport'
import type { ExportFolderConflict } from '../../../shared/types/exportConflict'
import ExportValidationModal from '../components/ExportValidationModal'
import ExportOverwriteModal from '../components/ExportOverwriteModal'
import PromptDialog from '../components/PromptDialog'

interface SetLibraryScreenProps {
  onOpenSet: (setId: string) => void
}

function SetLibraryScreen({ onOpenSet }: SetLibraryScreenProps): JSX.Element {
  const [sets, setSets] = useState<DaniSetSummary[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null)
  const [duplicateTarget, setDuplicateTarget] = useState<{ id: string; currentTitle: string } | null>(null)
  const [exportConflict, setExportConflict] = useState<{
    id: string
    conflict: ExportFolderConflict
    destDir: string
  } | null>(null)

  const refresh = useCallback(() => {
    window.api.sets.list().then(setSets)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreate = async (): Promise<void> => {
    const title = newTitle.trim()
    if (!title) return
    const nextIndex = sets.reduce((max, s) => Math.max(max, s.index), -1) + 1
    const created = await window.api.sets.create({ title, index: nextIndex })
    setNewTitle('')
    refresh()
    onOpenSet(created.id)
  }

  const handleDuplicate = (id: string, currentTitle: string): void => {
    setDuplicateTarget({ id, currentTitle })
  }

  const handleDuplicateConfirm = async (title: string): Promise<void> => {
    if (!duplicateTarget) return
    setDuplicateTarget(null)
    await window.api.sets.duplicate(duplicateTarget.id, title)
    refresh()
  }

  const handleDelete = async (id: string, title: string): Promise<void> => {
    if (!window.confirm(`「${title}」を削除しますか?`)) return
    await window.api.sets.remove(id)
    refresh()
  }

  const handleExportFolder = async (id: string): Promise<void> => {
    setExportError(null)
    try {
      const report = await window.api.sets.validate(id)
      if (!report.isValid) {
        setValidationReport(report)
        return
      }
      const settings = await window.api.settings.get()
      const destDir = settings.defaultDaniFolder ?? (await window.api.dialogs.pickSaveFolder())
      if (!destDir) return
      const conflict = await window.api.sets.checkExportFolderConflict(id, destDir)
      if (conflict) {
        setExportConflict({ id, conflict, destDir })
        return
      }
      const exportReport = await window.api.sets.exportToFolder(id, destDir)
      window.alert(`エクスポート完了: ${exportReport.ranksExported}段位を書き出しました`)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    }
  }

  const resolveExportConflict = async (mode: 'overwrite' | 'new'): Promise<void> => {
    if (!exportConflict) return
    const { id, conflict, destDir } = exportConflict
    setExportConflict(null)
    try {
      const exportReport = await window.api.sets.exportToFolder(
        id,
        destDir,
        mode === 'overwrite' ? conflict.folderName : undefined
      )
      window.alert(`エクスポート完了: ${exportReport.ranksExported}段位を書き出しました`)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleExportZip = async (id: string, title: string): Promise<void> => {
    setExportError(null)
    try {
      const report = await window.api.sets.validate(id)
      if (!report.isValid) {
        setValidationReport(report)
        return
      }
      const destZip = await window.api.dialogs.pickSaveZip(title)
      if (!destZip) return
      const exportReport = await window.api.sets.exportToZip(id, destZip)
      window.alert(`エクスポート完了: ${exportReport.ranksExported}段位を書き出しました`)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    }
  }

  const reportImportResult = (report: {
    ranksImported: number
    songsImported: number
    warnings: string[]
  }): void => {
    const lines = [
      `${report.ranksImported}段位をインポートしました`,
      `取り込んだ曲: ${report.songsImported}`
    ]
    if (report.warnings.length > 0) {
      lines.push('', '警告:', ...report.warnings)
    }
    window.alert(lines.join('\n'))
  }

  const handleImportFolder = async (): Promise<void> => {
    setExportError(null)
    try {
      const sourceDir = await window.api.dialogs.pickImportFolder()
      if (!sourceDir) return
      const report = await window.api.sets.importFromFolder(sourceDir)
      refresh()
      reportImportResult(report)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleImportZip = async (): Promise<void> => {
    setExportError(null)
    try {
      const sourceZip = await window.api.dialogs.pickImportZip()
      if (!sourceZip) return
      const report = await window.api.sets.importFromZip(sourceZip)
      refresh()
      reportImportResult(report)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="set-library">
      <h2>段位道場セット一覧</h2>

      <div className="set-library-toolbar">
        <input
          type="text"
          placeholder="新しいセットのタイトル"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button className="primary-button" onClick={handleCreate}>
          + 新規作成
        </button>
        <span className="toolbar-divider" />
        <button onClick={handleImportFolder}>フォルダから読み込み</button>
        <button onClick={handleImportZip}>ZIPから読み込み</button>
      </div>

      {validationReport && (
        <ExportValidationModal report={validationReport} onClose={() => setValidationReport(null)} />
      )}

      {duplicateTarget && (
        <PromptDialog
          title="複製後のタイトル"
          defaultValue={`${duplicateTarget.currentTitle} のコピー`}
          onConfirm={handleDuplicateConfirm}
          onCancel={() => setDuplicateTarget(null)}
        />
      )}

      {exportConflict && (
        <ExportOverwriteModal
          conflict={exportConflict.conflict}
          onOverwrite={() => resolveExportConflict('overwrite')}
          onExportAsNew={() => resolveExportConflict('new')}
          onCancel={() => setExportConflict(null)}
        />
      )}

      {exportError && <p className="error">{exportError}</p>}

      <div className="set-grid">
        {sets.map((set) => (
          <div className="set-card" key={set.id}>
            <div className="set-card-header">
              <h3>{set.title}</h3>
              <span className="rank-count-badge">{set.rankCount}段位</span>
            </div>

            <button className="primary-button set-card-open" onClick={() => onOpenSet(set.id)}>
              開く
            </button>

            <div className="set-card-actions">
              <button onClick={() => handleDuplicate(set.id, set.title)}>複製</button>
              <button onClick={() => handleExportFolder(set.id)}>フォルダ出力</button>
              <button onClick={() => handleExportZip(set.id, set.title)}>ZIP出力</button>
              <button className="danger-button" onClick={() => handleDelete(set.id, set.title)}>
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      {sets.length === 0 && (
        <p className="empty-state">まだセットがありません。新規作成するかインポートしてください。</p>
      )}
    </div>
  )
}

export default SetLibraryScreen
