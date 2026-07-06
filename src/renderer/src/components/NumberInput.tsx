import { useEffect, useState } from 'react'

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

/**
 * A controlled number input that allows the field to go fully blank while
 * editing (so the leading digit can be deleted to retype), only falling
 * back to 0 once the field is blurred still empty.
 */
function NumberInput({ value, onChange, className }: NumberInputProps): JSX.Element {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  return (
    <input
      type="number"
      className={className}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        if (raw === '') return
        const parsed = Number(raw)
        if (!Number.isNaN(parsed)) onChange(parsed)
      }}
      onBlur={() => {
        if (text === '') {
          setText('0')
          onChange(0)
        }
      }}
    />
  )
}

export default NumberInput
