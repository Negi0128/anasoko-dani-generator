import type { ValidationReport } from '../../../shared/types/validationReport'

interface ExportValidationModalProps {
  report: ValidationReport
  onClose: () => void
}

function ExportValidationModal({ report, onClose }: ExportValidationModalProps): JSX.Element {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>エクスポートできません</h3>
        <p>曲が割り当てられていない項目があります:</p>
        <ul className="song-picker-list">
          {report.issues.map((issue, i) => (
            <li key={i}>
              {issue.rankIndex},{issue.rankName} の{issue.slotIndex + 1}曲目
            </li>
          ))}
        </ul>
        <button onClick={onClose}>閉じる</button>
      </div>
    </div>
  )
}

export default ExportValidationModal
