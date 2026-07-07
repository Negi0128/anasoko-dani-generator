export interface ValidationIssue {
  rankIndex: number
  rankName: string
  slotIndex: number
  reason: string
}

export interface ValidationReport {
  isValid: boolean
  issues: ValidationIssue[]
}
