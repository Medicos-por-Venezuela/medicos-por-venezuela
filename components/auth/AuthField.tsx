type AuthFieldProps = {
  label: string
  type?: string
  value: string
  autoComplete?: string
  onChange: (value: string) => void
  onEnter?: () => void
}

export default function AuthField({
  label,
  type = 'text',
  value,
  autoComplete,
  onChange,
  onEnter
}: AuthFieldProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.()
        }}
      />
    </div>
  )
}
