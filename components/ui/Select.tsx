import { SelectHTMLAttributes } from 'react'
import { ChevronDown } from './icons'

// Layout props (className/style) go to the wrapper; the rest to the inner <select>.
type Props = SelectHTMLAttributes<HTMLSelectElement>

export default function Select({ className, style, children, ...selectProps }: Props) {
  return (
    <div className={className ? `select-wrap ${className}` : 'select-wrap'} style={style}>
      <select {...selectProps}>{children}</select>
      <ChevronDown className="select-chevron" aria-hidden />
    </div>
  )
}
