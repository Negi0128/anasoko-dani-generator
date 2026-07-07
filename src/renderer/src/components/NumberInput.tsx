import { useEffect, useState } from 'react'

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  min?: number
  max?: number
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value
  if (min !== undefined) result = Math.max(min, result)
  if (max !== undefined) result = Math.min(max, result)
  return result
}

/**
 * A controlled number input that allows the field to go fully blank while
 * editing (so the leading digit can be deleted to retype), only falling
 * back to 0 once the field is blurred still empty. Values are clamped to
 * [min, max] once they resolve to a number.
 */
function NumberInput({ value, onChange, className, min, max }: NumberInputProps): JSX.Element {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  return (
    <input
      type="number"
      className={className}
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        if (raw === '') return
        const parsed = Number(raw)
        if (!Number.isNaN(parsed)) onChange(clamp(parsed, min, max))
      }}
      onBlur={() => {
        if (text === '') {
          setText('0')
          onChange(clamp(0, min, max))
          return
        }
        const parsed = Number(text)
        if (!Number.isNaN(parsed)) {
          const clamped = clamp(parsed, min, max)
          if (clamped !== parsed) {
            setText(String(clamped))
            onChange(clamped)
          }
        }
      }}
    />
  )
}

export default NumberInput
