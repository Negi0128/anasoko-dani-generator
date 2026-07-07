import type { ExportedRankSummary, ExportFolderConflict } from '../../../shared/types/exportConflict'

interface ExportOverwriteModalProps {
  conflict: ExportFolderConflict
  onOverwrite: () => void
  onExportAsNew: () => void
  onCancel: () => void
}

function RankSummaryList({ ranks }: { ranks: ExportedRankSummary[] }): JSX.Element {
  if (ranks.length === 0) return <p className="empty-state">(データなし)</p>
  return (
    <ul className="song-picker-list">
      {ranks.map((rank) => (
        <li key={rank.rankIndex}>
          <strong>
            {rank.rankIndex},{rank.rankName}
          </strong>
          {rank.title && <span> ({rank.title})</span>}
          <div className="export-conflict-rank-detail">
            曲: {rank.songTitles.join(' / ')}
            <br />
            魂ゲージ: 赤{rank.gauge.red} 金{rank.gauge.gold} / 条件: {rank.statKindLabels.join(', ') || 'なし'}
          </div>
        </li>
      ))}
    </ul>
  )
}

function ExportOverwriteModal({
  conflict,
  onOverwrite,
  onExportAsNew,
  onCancel
}: ExportOverwriteModalProps): JSX.Element {
  return (
    <div className="modal-overlay">
      <div className="modal export-overwrite-modal">
        <h3>同じ名前のフォルダが既にあります</h3>
        <p>
          「{conflict.folderName}」が出力先に既に存在します。上書きしますか、それとも新しい連番フォルダに書き出しますか?
        </p>
        <div className="export-conflict-compare">
          <div>
            <h4>上書き前(既存)</h4>
            <RankSummaryList ranks={conflict.before} />
          </div>
          <div>
            <h4>上書き後(今回の内容)</h4>
            <RankSummaryList ranks={conflict.after} />
          </div>
        </div>
        <div className="confirm-dialog-actions">
          <button onClick={onCancel}>キャンセル</button>
          <button onClick={onExportAsNew}>新しいフォルダに書き出す</button>
          <button className="danger-button" onClick={onOverwrite}>
            上書きする
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportOverwriteModal
