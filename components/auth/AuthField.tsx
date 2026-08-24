import { useId } from 'react'

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
  // El <label> y el <input> estaban sin asociar: ningún lector de pantalla anunciaba el campo y
  // el foco no saltaba al hacer clic en la etiqueta. useId da un id estable entre servidor y
  // cliente (nada de contadores propios, que rompen la hidratación).
  const id = useId()

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
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
