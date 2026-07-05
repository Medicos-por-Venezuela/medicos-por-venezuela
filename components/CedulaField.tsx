import { useState } from 'react'

type CedulaFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  hint?: string
}

// Combined "V/E" prefix + numeric-only body, e.g. "V-12345678". Kept as a single
// string in the parent (matches the `cedula` text column), split internally.
export default function CedulaField({ label, value, onChange, required, hint }: CedulaFieldProps) {
  const [prefix, setPrefix] = useState<'V' | 'E'>(value.startsWith('E-') ? 'E' : 'V')
  const number = value.includes('-') ? value.slice(value.indexOf('-') + 1) : value

  const emit = (nextPrefix: string, nextNumber: string) => {
    onChange(nextNumber ? `${nextPrefix}-${nextNumber}` : '')
  }

  return (
    <div>
      <label className="label">
        {label} {required && '*'}
      </label>
      <div className="input-group">
        <select
          value={prefix}
          onChange={(e) => {
            const next = e.target.value as 'V' | 'E'
            setPrefix(next)
            emit(next, number)
          }}
        >
          <option value="V">V</option>
          <option value="E">E</option>
        </select>
        <input
          inputMode="numeric"
          value={number}
          onChange={(e) => emit(prefix, e.target.value.replace(/\D/g, '').slice(0, 9))}
          placeholder="Ej. 12345678"
        />
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}
