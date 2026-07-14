type PhoneFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  hint?: string
}

// Country dial code + numeric-only body, e.g. "584121234567". Kept as a single
// string in the parent (matches the `phone_whatsapp` text column), split internally.
const DIAL_CODES = [
  { code: '58', country: 'Venezuela' },
  { code: '57', country: 'Colombia' },
  { code: '34', country: 'España' },
  { code: '56', country: 'Chile' },
  { code: '54', country: 'Argentina' },
  { code: '51', country: 'Perú' },
  { code: '593', country: 'Ecuador' },
  { code: '52', country: 'México' },
  { code: '1', country: 'EE. UU. / Rep. Dominicana' },
  { code: '507', country: 'Panamá' },
  { code: '598', country: 'Uruguay' },
  { code: '39', country: 'Italia' },
  { code: '351', country: 'Portugal' },
  { code: '45', country: 'Dinamarca' }
]

function splitValue(value: string) {
  const match = DIAL_CODES.filter((d) => value.startsWith(d.code)).sort(
    (a, b) => b.code.length - a.code.length
  )[0]
  if (!match) return { code: '58', number: value }
  return { code: match.code, number: value.slice(match.code.length) }
}

export default function PhoneField({ label, value, onChange, required, hint }: PhoneFieldProps) {
  const { code, number } = splitValue(value)

  const emit = (nextCode: string, nextNumber: string) => {
    onChange(nextNumber ? `${nextCode}${nextNumber}` : '')
  }

  return (
    <div>
      <label className="label">
        {label} {required && '*'}
      </label>
      <div className="input-group">
        <select value={code} onChange={(e) => emit(e.target.value, number)}>
          {DIAL_CODES.map((d) => (
            <option key={d.code} value={d.code}>
              +{d.code}
            </option>
          ))}
        </select>
        <input
          inputMode="numeric"
          value={number}
          onChange={(e) => emit(code, e.target.value.replace(/\D/g, '').slice(0, 11))}
          placeholder="Ej. 4121234567"
        />
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}
